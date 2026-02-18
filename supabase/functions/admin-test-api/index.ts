import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, api } = await req.json();

    if (action === "test") {
      const results: Record<string, { status: string; latency?: number; error?: string }> = {};

      // Test Anthropic
      if (!api || api === "anthropic") {
        const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (!anthropicKey) {
          results.anthropic = { status: "missing", error: "ANTHROPIC_API_KEY não configurada" };
        } else {
          const start = Date.now();
          try {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5",
                max_tokens: 5,
                messages: [{ role: "user", content: "Olá" }],
              }),
            });
            const latency = Date.now() - start;
            if (res.ok) {
              results.anthropic = { status: "ok", latency };
            } else {
              const err = await res.json();
              results.anthropic = { status: "error", latency, error: err?.error?.message || `HTTP ${res.status}` };
            }
          } catch (e) {
            results.anthropic = { status: "error", error: String(e) };
          }
        }
      }

      // Test Lovable AI Gateway (Nano Banana / Gemini)
      if (!api || api === "lovable_ai") {
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");
        if (!lovableKey) {
          results.lovable_ai = { status: "missing", error: "LOVABLE_API_KEY não configurada" };
        } else {
          const start = Date.now();
          try {
            const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovableKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                max_tokens: 5,
                messages: [{ role: "user", content: "Olá" }],
              }),
            });
            const latency = Date.now() - start;
            if (res.ok) {
              results.lovable_ai = { status: "ok", latency };
            } else {
              const body = await res.text();
              results.lovable_ai = { status: "error", latency, error: `HTTP ${res.status}: ${body.slice(0, 100)}` };
            }
          } catch (e) {
            results.lovable_ai = { status: "error", error: String(e) };
          }
        }
      }

      // Test Stripe
      if (!api || api === "stripe") {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
          results.stripe = { status: "missing", error: "STRIPE_SECRET_KEY não configurada" };
        } else {
          const start = Date.now();
          try {
            const res = await fetch("https://api.stripe.com/v1/balance", {
              headers: { Authorization: `Bearer ${stripeKey}` },
            });
            const latency = Date.now() - start;
            results.stripe = res.ok
              ? { status: "ok", latency }
              : { status: "error", latency, error: `HTTP ${res.status}` };
          } catch (e) {
            results.stripe = { status: "error", error: String(e) };
          }
        }
      }

      // Test Resend
      if (!api || api === "resend") {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) {
          results.resend = { status: "missing", error: "RESEND_API_KEY não configurada" };
        } else {
          const start = Date.now();
          try {
            const res = await fetch("https://api.resend.com/domains", {
              headers: { Authorization: `Bearer ${resendKey}` },
            });
            const latency = Date.now() - start;
            results.resend = res.ok
              ? { status: "ok", latency }
              : { status: "error", latency, error: `HTTP ${res.status}` };
          } catch (e) {
            results.resend = { status: "error", error: String(e) };
          }
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-test-api error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
