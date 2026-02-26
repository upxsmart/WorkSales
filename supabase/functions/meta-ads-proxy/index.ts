import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API_VERSION = "v22.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { project_id, action, params = {} } = await req.json();

    if (!project_id || !action) {
      return new Response(JSON.stringify({ error: "project_id e action são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Buscar credenciais Meta Ads para este projeto
    const { data: connection, error: connErr } = await supabase
      .from("meta_ads_connections")
      .select("*")
      .eq("project_id", project_id)
      .eq("user_id", user.id)
      .eq("connection_status", "active")
      .single();

    // Para ações de conexão (save/test), não precisamos de credenciais existentes
    if (action === "save_connection") {
      const { access_token, ad_account_id, pixel_id, page_id, instagram_account_id, meta_app_id } = params;
      if (!access_token || !ad_account_id) {
        return new Response(JSON.stringify({ error: "access_token e ad_account_id são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Validar token fazendo chamada de teste à API
      const testRes = await fetch(
        `${META_API_BASE}/me?fields=id,name&access_token=${access_token}`
      );
      const testData = await testRes.json();
      if (testData.error) {
        return new Response(JSON.stringify({ error: `Token inválido: ${testData.error.message}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Salvar/atualizar conexão
      const { error: upsertErr } = await supabase
        .from("meta_ads_connections")
        .upsert({
          user_id: user.id,
          project_id,
          access_token,
          ad_account_id: ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`,
          pixel_id: pixel_id || null,
          page_id: page_id || null,
          instagram_account_id: instagram_account_id || null,
          meta_app_id: meta_app_id || null,
          connection_status: "active",
          last_sync_at: new Date().toISOString(),
        }, { onConflict: "user_id,project_id" });

      if (upsertErr) {
        return new Response(JSON.stringify({ error: "Erro ao salvar conexão" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ success: true, meta_user: testData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_connection_status") {
      if (!connection) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({
        connected: true,
        ad_account_id: connection.ad_account_id,
        page_id: connection.page_id,
        last_sync_at: connection.last_sync_at,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disconnect") {
      await supabase.from("meta_ads_connections")
        .update({ connection_status: "disconnected" })
        .eq("project_id", project_id)
        .eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Para ações que requerem credenciais
    if (connErr || !connection) {
      return new Response(JSON.stringify({ error: "Meta Ads não conectado para este projeto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Decrypt access_token if encrypted
    let accessToken = connection.access_token;
    if (accessToken && accessToken.startsWith("enc:")) {
      const { data: decrypted } = await supabase.rpc("decrypt_sensitive", { cipher_text: accessToken });
      accessToken = (decrypted as string) || accessToken;
    }
    const adAccountId = connection.ad_account_id;

    let result: Response;

    switch (action) {
      case "get_campaigns":
        result = await fetch(
          `${META_API_BASE}/${adAccountId}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time&limit=50&access_token=${accessToken}`
        );
        break;

      case "get_adsets":
        result = await fetch(
          `${META_API_BASE}/${params.campaign_id}/adsets?fields=id,name,status,daily_budget,targeting,optimization_goal,billing_event&limit=50&access_token=${accessToken}`
        );
        break;

      case "get_ads":
        result = await fetch(
          `${META_API_BASE}/${params.adset_id}/ads?fields=id,name,status,creative{id,title,body,thumbnail_url}&limit=50&access_token=${accessToken}`
        );
        break;

      case "get_insights": {
        const dateRange = params.date_range || "last_7d";
        const objectId = params.object_id || adAccountId;
        result = await fetch(
          `${META_API_BASE}/${objectId}/insights?fields=impressions,reach,clicks,cpc,cpm,ctr,spend,actions,cost_per_action_type,frequency&date_preset=${dateRange}&access_token=${accessToken}`
        );
        break;
      }

      case "get_account_insights": {
        result = await fetch(
          `${META_API_BASE}/${adAccountId}/insights?fields=impressions,reach,clicks,cpc,cpm,ctr,spend,actions&date_preset=${params.date_range || "last_30d"}&time_increment=1&access_token=${accessToken}`
        );
        break;
      }

      case "create_campaign": {
        result = await fetch(
          `${META_API_BASE}/${adAccountId}/campaigns`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              access_token: accessToken,
              name: params.name,
              objective: params.objective,
              status: "PAUSED", // SEMPRE PAUSED
              special_ad_categories: JSON.stringify(params.special_ad_categories || []),
              ...(params.daily_budget && { daily_budget: String(params.daily_budget) }),
            }),
          }
        );
        break;
      }

      case "create_adset": {
        result = await fetch(
          `${META_API_BASE}/${adAccountId}/adsets`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              access_token: accessToken,
              campaign_id: params.campaign_id,
              name: params.name,
              status: "PAUSED",
              daily_budget: String(params.daily_budget),
              billing_event: params.billing_event || "IMPRESSIONS",
              optimization_goal: params.optimization_goal || "LINK_CLICKS",
              targeting: JSON.stringify(params.targeting || {}),
              start_time: params.start_time || new Date(Date.now() + 3600000).toISOString(),
            }),
          }
        );
        break;
      }

      case "update_status": {
        result = await fetch(
          `${META_API_BASE}/${params.object_id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              access_token: accessToken,
              status: params.status,
            }),
          }
        );
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Ação não reconhecida: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    const data = await result.json();

    // Logar a ação
    if (!["get_campaigns", "get_adsets", "get_ads", "get_insights", "get_account_insights"].includes(action)) {
      await supabase.from("meta_ads_actions").insert({
        project_id,
        user_id: user.id,
        action_type: action,
        meta_object_id: data?.id || params?.object_id || null,
        request_payload: params,
        response_payload: data,
        status: data?.error ? "failed" : "executed",
        error_message: data?.error?.message || null,
        executed_at: new Date().toISOString(),
      });
    }

    // Cache de dados de leitura
    if (["get_campaigns", "get_adsets", "get_ads", "get_insights"].includes(action)) {
      const dataType = action.replace("get_", "");
      await supabase.from("meta_ads_cache").upsert({
        project_id,
        data_type: dataType,
        meta_object_id: params?.object_id || params?.campaign_id || adAccountId,
        data,
        synced_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }, { onConflict: "project_id,data_type,meta_object_id" }).catch(() => {/* ignore cache errors */});
    }

    // Atualizar last_sync_at
    await supabase.from("meta_ads_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("project_id", project_id)
      .eq("user_id", user.id);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("meta-ads-proxy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
