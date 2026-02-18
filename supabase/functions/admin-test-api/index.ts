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

    const body = await req.json();
    const { action, api, key_name, key_value } = body;

    // ── Save key ─────────────────────────────────────────────────────
    if (action === "save_key") {
      if (!key_name || !key_value) {
        return new Response(JSON.stringify({ error: "key_name e key_value são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate key_name is one of the allowed keys
      const ALLOWED_KEYS = ["ANTHROPIC_API_KEY", "STRIPE_SECRET_KEY", "RESEND_API_KEY", "GOOGLE_API_KEY"];
      if (!ALLOWED_KEYS.includes(key_name)) {
        return new Response(JSON.stringify({ error: "key_name inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate key_value length
      if (typeof key_value !== "string" || key_value.length < 8 || key_value.length > 500) {
        return new Response(JSON.stringify({ error: "Valor da chave inválido (8-500 caracteres)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: upsertErr } = await supabase
        .from("api_configs")
        .upsert({ key_name, key_value, is_active: true }, { onConflict: "key_name" });

      if (upsertErr) {
        console.error("save_key upsert error:", upsertErr);
        return new Response(JSON.stringify({ error: "Erro ao salvar chave" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Test APIs ─────────────────────────────────────────────────────
    if (action === "test") {
      // Fetch all keys from db
      const { data: configRows } = await supabase
        .from("api_configs")
        .select("key_name, key_value, is_active");

      const dbKeys: Record<string, string> = {};
      for (const row of configRows || []) {
        if (row.key_value) dbKeys[row.key_name] = row.key_value;
      }

      const results: Record<string, { status: string; latency?: number; error?: string }> = {};

      // ── Anthropic ──────────────────────────────────────────────────
      if (!api || api === "anthropic") {
        const key = dbKeys["ANTHROPIC_API_KEY"] || Deno.env.get("ANTHROPIC_API_KEY");
        if (!key) {
          results.anthropic = { status: "missing", error: "ANTHROPIC_API_KEY não configurada" };
        } else {
          const start = Date.now();
          try {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": key,
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
              await res.text();
              // Update last test status
              await supabase.from("api_configs").update({
                last_tested_at: new Date().toISOString(),
                last_test_status: "ok",
              }).eq("key_name", "ANTHROPIC_API_KEY");
              results.anthropic = { status: "ok", latency };
            } else {
              const err = await res.json();
              await supabase.from("api_configs").update({
                last_tested_at: new Date().toISOString(),
                last_test_status: "error",
              }).eq("key_name", "ANTHROPIC_API_KEY");
              results.anthropic = { status: "error", latency, error: err?.error?.message || `HTTP ${res.status}` };
            }
          } catch (e) {
            results.anthropic = { status: "error", error: String(e) };
          }
        }
      }

      // ── Lovable AI Gateway ────────────────────────────────────────
      if (!api || api === "lovable_ai") {
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");
        if (!lovableKey) {
          results.lovable_ai = { status: "missing", error: "LOVABLE_API_KEY não configurada (gerenciada automaticamente)" };
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
              await res.text();
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

      // ── Google AI Studio (Banana Pro) ─────────────────────────────
      if (!api || api === "google_ai") {
        const key = dbKeys["GOOGLE_API_KEY"] || Deno.env.get("GOOGLE_API_KEY");
        if (!key) {
          results.google_ai = { status: "missing", error: "GOOGLE_API_KEY não configurada" };
        } else {
          const start = Date.now();
          try {
            // Test with a simple text generation call to validate key
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
              { method: "GET" }
            );
            const latency = Date.now() - start;
            if (res.ok) {
              await supabase.from("api_configs").update({
                last_tested_at: new Date().toISOString(),
                last_test_status: "ok",
              }).eq("key_name", "GOOGLE_API_KEY");
              results.google_ai = { status: "ok", latency };
            } else {
              const errBody = await res.json().catch(() => ({}));
              await supabase.from("api_configs").update({
                last_tested_at: new Date().toISOString(),
                last_test_status: "error",
              }).eq("key_name", "GOOGLE_API_KEY");
              results.google_ai = {
                status: "error",
                latency,
                error: errBody?.error?.message || `HTTP ${res.status}`,
              };
            }
          } catch (e) {
            results.google_ai = { status: "error", error: String(e) };
          }
        }
      }

      // ── Stripe ────────────────────────────────────────────────────

      if (!api || api === "stripe") {
        const key = dbKeys["STRIPE_SECRET_KEY"] || Deno.env.get("STRIPE_SECRET_KEY");
        if (!key) {
          results.stripe = { status: "missing", error: "STRIPE_SECRET_KEY não configurada" };
        } else {
          const start = Date.now();
          try {
            const res = await fetch("https://api.stripe.com/v1/balance", {
              headers: { Authorization: `Bearer ${key}` },
            });
            const latency = Date.now() - start;
            await res.text();
            await supabase.from("api_configs").update({
              last_tested_at: new Date().toISOString(),
              last_test_status: res.ok ? "ok" : "error",
            }).eq("key_name", "STRIPE_SECRET_KEY");
            results.stripe = res.ok
              ? { status: "ok", latency }
              : { status: "error", latency, error: `HTTP ${res.status}` };
          } catch (e) {
            results.stripe = { status: "error", error: String(e) };
          }
        }
      }

      // ── Resend ────────────────────────────────────────────────────
      if (!api || api === "resend") {
        const key = dbKeys["RESEND_API_KEY"] || Deno.env.get("RESEND_API_KEY");
        if (!key) {
          results.resend = { status: "missing", error: "RESEND_API_KEY não configurada" };
        } else {
          const start = Date.now();
          try {
            const res = await fetch("https://api.resend.com/domains", {
              headers: { Authorization: `Bearer ${key}` },
            });
            const latency = Date.now() - start;
            await res.text();
            await supabase.from("api_configs").update({
              last_tested_at: new Date().toISOString(),
              last_test_status: res.ok ? "ok" : "error",
            }).eq("key_name", "RESEND_API_KEY");
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
