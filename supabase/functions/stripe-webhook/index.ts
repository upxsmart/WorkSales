import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

// ── Mapeamento de price_id → configuração do plano ────────────────
// Preencha os Price IDs reais do seu painel Stripe
const PRICE_TO_PLAN: Record<string, {
  plan: string;
  interactions_limit: number;
  creatives_limit: number;
  projects_limit: number;
}> = {
  // Starter — R$97/mês
  price_starter_monthly: {
    plan: "starter",
    interactions_limit: 100,
    creatives_limit: 10,
    projects_limit: 1,
  },
  // Professional — R$197/mês
  price_professional_monthly: {
    plan: "professional",
    interactions_limit: 200,
    creatives_limit: 20,
    projects_limit: 3,
  },
  // Scale — R$497/mês
  price_scale_monthly: {
    plan: "scale",
    interactions_limit: 500,
    creatives_limit: 50,
    projects_limit: 999,
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      console.error("Missing Stripe secrets");
      return new Response(JSON.stringify({ error: "Stripe não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Supabase com service role (acesso irrestrito)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Verificar assinatura do webhook ────────────────────────────
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Assinatura ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      console.error("Webhook signature invalid:", err);
      return new Response(
        JSON.stringify({ error: "Assinatura inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Stripe event received: ${event.type}`);

    // ── Processar eventos ──────────────────────────────────────────
    switch (event.type) {

      // ── Assinatura criada ou renovada (pagamento bem-sucedido) ──
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, stripe, subscription, "active");
        break;
      }

      // ── Assinatura cancelada (imediatamente ou ao fim do período) ──
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, stripe, subscription, "cancelled");
        break;
      }

      // ── Pagamento bem-sucedido (renovação mensal) ──
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string,
          );
          await handleSubscriptionChange(supabase, stripe, subscription, "active");
        }
        break;
      }

      // ── Pagamento falhou ──
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          const customerId = invoice.customer as string;
          const { error } = await supabase
            .from("profiles")
            .update({ plan_status: "past_due" })
            .eq("stripe_customer_id", customerId);

          if (error) console.error("Error updating past_due:", error);
          else console.log(`Marked past_due for customer ${customerId}`);
        }
        break;
      }

      // ── Trial terminou sem cartão ──
      case "customer.subscription.trial_will_end": {
        // Apenas loga por ora — pode enviar email aqui futuramente
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Trial ending for subscription ${subscription.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ── Helper: atualiza profile baseado na subscription ──────────────
async function handleSubscriptionChange(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  forcedStatus?: string,
) {
  const customerId = subscription.customer as string;

  // Buscar email do customer no Stripe
  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as Stripe.DeletedCustomer).deleted) {
    console.error("Customer deleted:", customerId);
    return;
  }
  const customerEmail = (customer as Stripe.Customer).email;

  // Descobrir o price_id da assinatura
  const priceId = subscription.items.data[0]?.price?.id;
  const planConfig = priceId ? PRICE_TO_PLAN[priceId] : undefined;

  // Determinar status final
  let planStatus = forcedStatus || subscription.status;
  if (subscription.status === "trialing") planStatus = "trial";
  if (subscription.status === "active") planStatus = "active";
  if (subscription.status === "canceled" || subscription.status === "incomplete_expired") planStatus = "cancelled";
  if (subscription.status === "past_due") planStatus = "past_due";

  // Atualizar por stripe_customer_id (se já existe) ou por email (novo customer)
  const updatePayload: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan_status: planStatus,
    updated_at: new Date().toISOString(),
  };

  // Só atualiza limites se o plano for reconhecido (não cancela tudo se price_id desconhecido)
  if (planConfig) {
    updatePayload.plan = planConfig.plan;
    updatePayload.interactions_limit = planConfig.interactions_limit;
    updatePayload.creatives_limit = planConfig.creatives_limit;
    updatePayload.projects_limit = planConfig.projects_limit;
    // Resetar contador de uso ao renovar
    if (planStatus === "active") {
      updatePayload.interactions_used = 0;
      updatePayload.creatives_used = 0;
    }
  }

  // Se cancelado — rebaixar para plano starter com limites mínimos
  if (planStatus === "cancelled") {
    updatePayload.plan = "starter";
    updatePayload.interactions_limit = 50;
    updatePayload.creatives_limit = 5;
    updatePayload.projects_limit = 1;
  }

  // Tentar atualizar por stripe_customer_id primeiro
  const { data: byCustomer, error: errByCustomer } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("stripe_customer_id", customerId)
    .select("user_id")
    .single();

  if (!errByCustomer && byCustomer) {
    console.log(`Updated profile for customer ${customerId} → plan_status: ${planStatus}`);
    return;
  }

  // Fallback: buscar por email na tabela auth.users via service role
  if (customerEmail) {
    const { data: authUser } = await supabase.auth.admin.listUsers();
    const matchedUser = authUser?.users?.find(
      (u) => u.email?.toLowerCase() === customerEmail.toLowerCase(),
    );

    if (matchedUser) {
      const { error: errByEmail } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("user_id", matchedUser.id);

      if (errByEmail) {
        console.error(`Error updating profile by email ${customerEmail}:`, errByEmail);
      } else {
        console.log(`Updated profile by email ${customerEmail} → plan_status: ${planStatus}`);
      }
    } else {
      console.warn(`No user found for customer ${customerId} / email ${customerEmail}`);
    }
  }
}
