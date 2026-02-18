import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Auth: identificar usuário ─────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;
    let stripeCustomerId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: authData } = await supabase.auth.getUser(token);
      if (authData?.user) {
        userId = authData.user.id;
        userEmail = authData.user.email ?? null;

        // Buscar customer_id salvo no perfil
        const { data: profile } = await supabase
          .from("profiles")
          .select("stripe_customer_id")
          .eq("user_id", userId)
          .single();

        stripeCustomerId = profile?.stripe_customer_id ?? null;
      }
    }

    const { plan_code, price_id, success_url, cancel_url } = await req.json();

    if (!price_id && !plan_code) {
      return new Response(
        JSON.stringify({ error: "price_id ou plan_code é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolver price_id a partir do plan_code se necessário ────
    let resolvedPriceId = price_id as string | undefined;

    if (!resolvedPriceId && plan_code) {
      // Buscar price no Stripe pelo metadata plan_code
      const prices = await stripe.prices.list({
        active: true,
        expand: ["data.product"],
        limit: 100,
      });

      const match = prices.data.find(
        (p) =>
          p.metadata?.plan_code === plan_code ||
          (p.product as Stripe.Product)?.metadata?.plan_code === plan_code
      );

      if (!match) {
        return new Response(
          JSON.stringify({
            error: `Nenhum price ativo encontrado para o plano "${plan_code}". Configure o metadata plan_code no Stripe.`,
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedPriceId = match.id;
    }

    // ── Criar ou reutilizar Stripe Customer ───────────────────────
    if (!stripeCustomerId && userEmail) {
      // Verificar se já existe customer com esse email
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { supabase_user_id: userId ?? "" },
        });
        stripeCustomerId = customer.id;
      }

      // Salvar customer_id no perfil (sem expor no client)
      if (userId) {
        await supabase
          .from("profiles")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("user_id", userId);
      }
    }

    // ── Criar sessão de Checkout ──────────────────────────────────
    const origin = req.headers.get("origin") || "https://build-digital-empire.lovable.app";
    const defaultSuccess = `${origin}/dashboard?checkout=success&plan=${plan_code ?? ""}`;
    const defaultCancel = `${origin}/#pricing`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: success_url || defaultSuccess,
      cancel_url: cancel_url || defaultCancel,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      subscription_data: {
        metadata: { plan_code: plan_code ?? "" },
        trial_period_days: plan_code === "professional" ? 7 : undefined,
      },
    };

    // Pré-preencher customer se identificado
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
    } else if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(
      `✅ Checkout session created: ${session.id} | plan: ${plan_code} | price: ${resolvedPriceId} | customer: ${stripeCustomerId ?? "guest"}`
    );

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("💥 stripe-checkout error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
