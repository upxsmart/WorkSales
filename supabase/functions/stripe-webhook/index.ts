import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// ── Tipos ──────────────────────────────────────────────────────────
interface PlanConfig {
  plan_code: string;
  interactions_limit: number;
  creatives_limit: number;
  projects_limit: number;
  meta_ads_enabled: boolean;
  meta_ads_syncs_per_day: number;
}

interface ProfileUpdate {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_status: string;
  plan?: string;
  interactions_limit?: number;
  creatives_limit?: number;
  projects_limit?: number;
  meta_ads_enabled?: boolean;
  meta_ads_syncs_per_day?: number;
  interactions_used?: number;
  creatives_used?: number;
  updated_at: string;
}

// ── Busca configuração do plano diretamente da plans_config ────────
async function getPlanByCode(
  supabase: ReturnType<typeof createClient>,
  planCode: string,
): Promise<PlanConfig | null> {
  const { data, error } = await supabase
    .from("plans_config")
    .select(
      "plan_code, interactions_limit, creatives_limit, projects_limit, meta_ads_enabled, meta_ads_syncs_per_day",
    )
    .eq("plan_code", planCode)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    console.warn(`Plan not found in plans_config: ${planCode}`);
    return null;
  }
  return data as PlanConfig;
}

// ── Encontra usuário no Supabase pelo customer_id ou email ─────────
async function findUserProfile(
  supabase: ReturnType<typeof createClient>,
  customerId: string,
  customerEmail: string | null,
): Promise<{ userId: string; byCustomerId: boolean } | null> {
  // 1. Tentar por stripe_customer_id (mais rápido)
  const { data: byId } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (byId?.user_id) {
    return { userId: byId.user_id, byCustomerId: true };
  }

  // 2. Fallback por email via auth.admin
  if (!customerEmail) return null;

  const { data: authData } = await supabase.auth.admin.listUsers();
  const matchedUser = authData?.users?.find(
    (u) => u.email?.toLowerCase() === customerEmail.toLowerCase(),
  );

  if (matchedUser?.id) {
    return { userId: matchedUser.id, byCustomerId: false };
  }

  return null;
}

// ── Aplica a atualização no profile ───────────────────────────────
async function updateProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: ProfileUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to update profile (${userId}): ${error.message}`);
  }
  console.log(
    `✅ Profile updated — user: ${userId} | plan_status: ${payload.plan_status} | plan: ${payload.plan ?? "unchanged"}`,
  );
}

// ── Handler principal de mudança de assinatura ─────────────────────
async function handleSubscriptionChange(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  overrideStatus?: string,
): Promise<void> {
  const customerId = subscription.customer as string;

  // Recuperar dados do customer no Stripe
  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as Stripe.DeletedCustomer).deleted) {
    console.error(`Customer ${customerId} was deleted — skipping`);
    return;
  }
  const customerEmail = (customer as Stripe.Customer).email;

  // Descobrir price_id e extrair plan_code via metadata ou description
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const priceMetadata = subscription.items.data[0]?.price?.metadata ?? {};
  const productId = subscription.items.data[0]?.price?.product as string | undefined;

  // plan_code pode vir de: metadata.plan_code no price, metadata no product, ou fallback
  let planCode: string | undefined =
    priceMetadata?.plan_code ||
    subscription.metadata?.plan_code;

  // Se não há metadata, buscar product para verificar metadata lá
  if (!planCode && productId) {
    try {
      const product = await stripe.products.retrieve(productId);
      planCode = product.metadata?.plan_code;
      console.log(`Plan code from product metadata: ${planCode}`);
    } catch {
      console.warn(`Could not retrieve product ${productId}`);
    }
  }

  console.log(
    `Processing subscription ${subscription.id} | customer: ${customerId} | price: ${priceId} | plan_code: ${planCode ?? "unknown"}`,
  );

  // Determinar status final
  let planStatus = overrideStatus ?? subscription.status;
  if (subscription.status === "trialing") planStatus = "trial";
  else if (subscription.status === "active") planStatus = "active";
  else if (
    subscription.status === "canceled" ||
    subscription.status === "incomplete_expired"
  ) planStatus = "cancelled";
  else if (subscription.status === "past_due") planStatus = "past_due";

  // Encontrar usuário
  const userResult = await findUserProfile(supabase, customerId, customerEmail);
  if (!userResult) {
    console.error(
      `❌ No profile found for customer ${customerId} / email ${customerEmail}`,
    );
    return;
  }

  // Montar payload base
  const payload: ProfileUpdate = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan_status: planStatus,
    updated_at: new Date().toISOString(),
  };

  // ── Cancelamento: rebaixar para starter ──────────────────────────
  if (planStatus === "cancelled") {
    const starterPlan = await getPlanByCode(supabase, "starter");
    payload.plan = "starter";
    payload.interactions_limit = starterPlan?.interactions_limit ?? 100;
    payload.creatives_limit = starterPlan?.creatives_limit ?? 10;
    payload.projects_limit = starterPlan?.projects_limit ?? 1;
    payload.meta_ads_enabled = starterPlan?.meta_ads_enabled ?? false;
    payload.meta_ads_syncs_per_day = starterPlan?.meta_ads_syncs_per_day ?? 0;
  }
  // ── Ativação/Renovação: aplicar plano com limites da plans_config ─
  else if (planCode && (planStatus === "active" || planStatus === "trial")) {
    const planConfig = await getPlanByCode(supabase, planCode);
    if (planConfig) {
      payload.plan = planConfig.plan_code;
      payload.interactions_limit = planConfig.interactions_limit;
      payload.creatives_limit = planConfig.creatives_limit;
      payload.projects_limit = planConfig.projects_limit;
      payload.meta_ads_enabled = planConfig.meta_ads_enabled;
      payload.meta_ads_syncs_per_day = planConfig.meta_ads_syncs_per_day;
      // Resetar contadores a cada renovação ativa
      if (planStatus === "active") {
        payload.interactions_used = 0;
        payload.creatives_used = 0;
      }
    } else {
      console.warn(
        `⚠️ plan_code "${planCode}" not found in plans_config — limits not updated`,
      );
    }
  }

  await updateProfile(supabase, userResult.userId, payload);
}

// ── Servidor ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      console.error("❌ Missing Stripe secrets");
      return new Response(JSON.stringify({ error: "Stripe não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Verificar assinatura do webhook ──────────────────────────────
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Stripe-Signature header ausente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error("❌ Webhook signature invalid:", err);
      return new Response(
        JSON.stringify({ error: "Assinatura inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`📨 Stripe event: ${event.type} (id: ${event.id})`);

    // ── Roteamento de eventos ────────────────────────────────────────
    switch (event.type) {

      // Assinatura criada ou atualizada (upgrade, downgrade, reativação)
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, stripe, subscription);
        break;
      }

      // Assinatura cancelada (imediatamente ou ao fim do período)
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, stripe, subscription, "cancelled");
        break;
      }

      // Pagamento bem-sucedido (renovação mensal) — reseta contadores
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription && invoice.billing_reason !== "subscription_create") {
          // Apenas renovações — criação já é tratada por subscription.created
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string,
          );
          await handleSubscriptionChange(supabase, stripe, subscription, "active");
        }
        break;
      }

      // Pagamento falhou — marcar past_due sem alterar plano
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          const customerId = invoice.customer as string;
          const userResult = await findUserProfile(supabase, customerId, null);
          if (userResult) {
            await updateProfile(supabase, userResult.userId, {
              stripe_customer_id: customerId,
              stripe_subscription_id: invoice.subscription as string ?? "",
              plan_status: "past_due",
              updated_at: new Date().toISOString(),
            });
          }
        }
        break;
      }

      // Trial encerrando em 3 dias — logar (futuro: enviar email)
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`⏰ Trial ending in 3 days — subscription: ${subscription.id}`);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true, event: event.type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("💥 Webhook handler error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
