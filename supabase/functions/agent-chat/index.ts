import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Which agent outputs each agent needs as context
const AGENT_DEPENDENCIES: Record<string, string[]> = {
  "AA-D100": [],
  "AO-GO": ["AA-D100"],
  "AJ-AF": ["AA-D100", "AO-GO"],
  "AM-CC": ["AA-D100", "AO-GO"],
  "AC-DC": ["AA-D100", "AO-GO", "AM-CC"],
  "AE-C": ["AA-D100", "AO-GO", "AM-CC", "AJ-AF"],
  "AT-GP": ["AA-D100", "AO-GO", "AM-CC", "AC-DC"],
  "AG-IMG": ["AC-DC"],
  "ACO": ["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC", "AT-GP", "AG-IMG"],
};

// Map agent code → template token used in system prompts
const AGENT_TO_TOKEN: Record<string, string> = {
  "AA-D100": "{{PERSONAS}}",
  "AO-GO":   "{{OFERTAS}}",
  "AJ-AF":   "{{FUNIL}}",
  "AM-CC":   "{{COPY}}",
  "AC-DC":   "{{CRIATIVOS}}",
  "AE-C":    "{{ENGAJAMENTO}}",
  "AT-GP":   "{{TRAFEGO}}",
};

/** Extrai texto legível de um output salvo */
function outputToText(out: { title?: string; output_type?: string; output_data: unknown }): string {
  const header = `[${out.title || out.output_type || "Output"}]`;
  const body = typeof out.output_data === "string"
    ? out.output_data
    : JSON.stringify(out.output_data, null, 2);
  return `${header}\n${body}`;
}

// Agents that generate images
const IMAGE_AGENTS = new Set(["AC-DC", "AG-IMG"]);
const IMAGE_MODEL = "google/gemini-3-pro-image-preview";
const TEXT_MODEL = "google/gemini-3-flash-preview";

// Plan interaction limits (fallback if plans_config unavailable)
const PLAN_LIMITS: Record<string, number> = {
  starter: 100,
  professional: 500,
  scale: 2000,
};

function buildImagePrompt(userMessage: string, systemPrompt: string, agentCode: string): string {
  const systemSummary = systemPrompt.slice(0, 400);
  if (agentCode === "AG-IMG") {
    return `Você é um agente gerador de imagens publicitárias de alta definição especializado. Crie uma imagem profissional, impactante e pronta para veiculação em anúncios digitais. Use alta fidelidade de cores, composição equilibrada e estética premium. ${systemSummary}\n\nPrompt/briefing recebido: ${userMessage}`;
  }
  return `Você é um designer criativo especialista em criativos publicitários de alta conversão. ${systemSummary}\n\nCrie uma imagem publicitária profissional, moderna e impactante para: ${userMessage}`;
}

async function uploadImageToStorage(
  supabase: ReturnType<typeof createClient>,
  base64Data: string,
  agentCode: string,
  projectId?: string
): Promise<string | null> {
  try {
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const fileName = `${agentCode}/${projectId || "general"}/${Date.now()}.png`;

    const { error } = await supabase.storage
      .from("exports")
      .upload(fileName, bytes, { contentType: "image/png", upsert: false });

    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }

    const { data } = supabase.storage.from("exports").getPublicUrl(fileName);
    return data?.publicUrl || null;
  } catch (e) {
    console.error("uploadImageToStorage error:", e);
    return null;
  }
}

/**
 * Verify user's JWT and return their user_id + profile
 */
async function getUserFromAuth(
  supabase: ReturnType<typeof createClient>,
  authHeader: string | null
): Promise<{ userId: string; profile: Record<string, unknown> } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const userId = data.user.id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, plan, interactions_used, interactions_limit, creatives_used, creatives_limit")
    .eq("user_id", userId)
    .single();

  return { userId, profile: profile || {} };
}

/**
 * Increment interactions_used for the user profile
 */
async function incrementUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  agentCode: string,
  projectId?: string,
  isImage = false
): Promise<void> {
  const field = isImage ? "creatives_used" : "interactions_used";

  // Increment the counter
  await supabase.rpc("increment_profile_usage", {
    _user_id: userId,
    _field: field,
  }).catch(() => {
    // Fallback: manual increment
    supabase
      .from("profiles")
      .select(field)
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          supabase
            .from("profiles")
            .update({ [field]: (data as Record<string, number>)[field] + 1 })
            .eq("user_id", userId);
        }
      });
  });

  // Log usage
  await supabase.from("usage_logs").insert({
    user_id: userId,
    project_id: projectId || null,
    agent_code: agentCode,
    action: isImage ? "image_generation" : "chat",
    model_used: isImage ? IMAGE_MODEL : TEXT_MODEL,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, agentName, projectId, projectContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Auth: get user from JWT ─────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userProfile: Record<string, unknown> = {};

    const authResult = await getUserFromAuth(supabase, authHeader);
    if (authResult) {
      userId = authResult.userId;
      userProfile = authResult.profile;
    }

    // ── Usage limit check ───────────────────────────────────────────
    if (userId && userProfile) {
      const isImage = IMAGE_AGENTS.has(agentName);
      const usedField = isImage ? "creatives_used" : "interactions_used";
      const limitField = isImage ? "creatives_limit" : "interactions_limit";
      const used = (userProfile[usedField] as number) || 0;
      const limit = (userProfile[limitField] as number) ||
        PLAN_LIMITS[(userProfile.plan as string) || "starter"] || 100;

      if (used >= limit) {
        return new Response(
          JSON.stringify({
            error: isImage
              ? `Limite de criativos atingido (${used}/${limit}). Faça upgrade para continuar.`
              : `Limite de interações atingido (${used}/${limit}). Faça upgrade para continuar.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 1. Fetch active system prompt ──────────────────────────────
    const { data: promptRow } = await supabase
      .from("agent_prompts")
      .select("system_prompt")
      .eq("agent_code", agentName)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const systemPrompt =
      promptRow?.system_prompt ||
      (agentName === IMAGE_AGENT
        ? "Você é o AC-DC, um agente especialista em design visual e criação de criativos publicitários."
        : "Você é um assistente de IA útil. Responda em português brasileiro.");

    // ── 2. Fetch knowledge base ────────────────────────────────────
    let knowledgeContext = "";
    const { data: kbItems } = await supabase
      .from("knowledge_base")
      .select("title, content, category")
      .eq("agent_code", agentName)
      .eq("is_active", true);

    if (kbItems && kbItems.length > 0) {
      knowledgeContext = "\n\n--- BASE DE CONHECIMENTO ---\n";
      for (const item of kbItems) {
        knowledgeContext += `\n### [${item.category}] ${item.title}\n${item.content}\n`;
      }
      knowledgeContext += "\n--- FIM DA BASE ---\n";
    }

    // ── 3. Fetch approved outputs from dependency agents ───────────
    // Agrupa outputs por agente e interpola tokens {{XYZ}} no system prompt
    const tokenValues: Record<string, string> = {};

    if (projectId) {
      const deps = AGENT_DEPENDENCIES[agentName] || [];
      if (deps.length > 0) {
        const { data: outputs } = await supabase
          .from("agent_outputs")
          .select("agent_name, output_type, title, output_data")
          .eq("project_id", projectId)
          .eq("is_approved", true)
          .in("agent_name", deps)
          .order("created_at", { ascending: false });

        if (outputs && outputs.length > 0) {
          // Agrupar por agente (pegar o mais recente de cada)
          const byAgent: Record<string, string[]> = {};
          for (const out of outputs) {
            if (!byAgent[out.agent_name]) byAgent[out.agent_name] = [];
            byAgent[out.agent_name].push(outputToText(out));
          }

          // Preencher mapa de tokens
          for (const [agentCode, texts] of Object.entries(byAgent)) {
            const token = AGENT_TO_TOKEN[agentCode];
            if (token) {
              tokenValues[token] = texts.join("\n\n");
            }
          }
        }
      }
    }

    // Tokens sem dados disponíveis → substituir por mensagem informativa
    const allTokens = Object.values(AGENT_TO_TOKEN);
    for (const token of allTokens) {
      if (!tokenValues[token]) {
        tokenValues[token] = `[Nenhum output aprovado disponível para este contexto. O usuário ainda não executou ou aprovou o agente responsável por este dado.]`;
      }
    }
    // ── 3b. {{META_ADS_DATA}} — busca dados reais para o AT-GP ───────
    if (agentName === "AT-GP" && projectId) {
      let metaAdsText = "";

      // Buscar status da conexão
      const { data: conn } = await supabase
        .from("meta_ads_connections")
        .select("ad_account_id, page_id, pixel_id, instagram_account_id, connection_status, last_sync_at")
        .eq("project_id", projectId)
        .eq("connection_status", "active")
        .maybeSingle();

      if (conn) {
        metaAdsText += `CONTA META ADS CONECTADA:\n`;
        metaAdsText += `- Ad Account ID: ${conn.ad_account_id}\n`;
        if (conn.page_id)              metaAdsText += `- Page ID: ${conn.page_id}\n`;
        if (conn.pixel_id)             metaAdsText += `- Pixel ID: ${conn.pixel_id}\n`;
        if (conn.instagram_account_id) metaAdsText += `- Instagram Account ID: ${conn.instagram_account_id}\n`;
        if (conn.last_sync_at)         metaAdsText += `- Última sincronização: ${new Date(conn.last_sync_at).toLocaleString("pt-BR")}\n`;

        // Buscar cache de dados (campanhas, insights, etc.)
        const { data: cacheItems } = await supabase
          .from("meta_ads_cache")
          .select("data_type, data, synced_at")
          .eq("project_id", projectId)
          .gt("expires_at", new Date().toISOString())
          .order("synced_at", { ascending: false });

        if (cacheItems && cacheItems.length > 0) {
          metaAdsText += `\nDADOS EM CACHE (sincronizados recentemente):\n`;
          for (const item of cacheItems) {
            metaAdsText += `\n### ${item.data_type.toUpperCase()} (sync: ${new Date(item.synced_at).toLocaleString("pt-BR")}):\n`;
            // Limitar tamanho para não explodir o contexto
            const raw = typeof item.data === "string" ? item.data : JSON.stringify(item.data, null, 2);
            metaAdsText += raw.slice(0, 3000);
            if (raw.length > 3000) metaAdsText += "\n[... dados truncados para economizar contexto]";
            metaAdsText += "\n";
          }
        } else {
          metaAdsText += `\nNenhum cache de campanhas disponível ainda. Sugira ao usuário clicar em "Sincronizar" na integração Meta Ads para carregar os dados.`;
        }
      } else {
        metaAdsText = "Conta Meta Ads NÃO conectada a este projeto. Para acessar dados reais de campanhas, peça ao usuário que conecte a conta em Configurações → Integrações → Meta Ads.";
      }

      tokenValues["{{META_ADS_DATA}}"] = metaAdsText;
    } else {
      // Tokens extras do AT-GP que não vêm de agentes
      tokenValues["{{META_ADS_DATA}}"] = "[Nenhum dado de Meta Ads conectado. Peça ao usuário para conectar a conta na aba de integrações.]";
    }
    // ── 3c. {{DEMANDAS}} — demandas pendentes de/para AT-GP ─────────
    if (agentName === "AT-GP" && projectId) {
      const { data: demands } = await supabase
        .from("agent_demands")
        .select("from_agent, to_agent, demand_type, reason, suggestion, priority, status, created_at")
        .eq("project_id", projectId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);

      if (demands && demands.length > 0) {
        let demandasText = `DEMANDAS PENDENTES (${demands.length}):\n`;
        for (const d of demands) {
          demandasText += `\n- [${d.priority?.toUpperCase() || "MEDIUM"}] De ${d.from_agent} → ${d.to_agent}`;
          demandasText += `\n  Tipo: ${d.demand_type} | Razão: ${d.reason}`;
          if (d.suggestion) demandasText += `\n  Sugestão: ${d.suggestion}`;
        }
        tokenValues["{{DEMANDAS}}"] = demandasText;
      } else {
        tokenValues["{{DEMANDAS}}"] = "[Nenhuma demanda pendente no momento.]";
      }
    } else {
      tokenValues["{{DEMANDAS}}"] = "[Nenhuma demanda pendente no momento.]";
    }


    // ── 4. Build project context note ─────────────────────────────
    const projectInfo = projectContext
      ? `Nicho: ${projectContext.nicho || "não informado"} | Público-alvo: ${projectContext.publico_alvo || "não informado"} | Objetivo: ${projectContext.objetivo || "não informado"} | Faturamento: ${projectContext.faturamento || "não informado"} | Produto: ${projectContext.product_description || "não informado"}`
      : "Informações do projeto não disponíveis.";

    tokenValues["{{PROJETO_INFO}}"] = projectInfo;

    // ── 5. Interpolar todos os tokens no system prompt ─────────────
    let interpolatedPrompt = systemPrompt;
    for (const [token, value] of Object.entries(tokenValues)) {
      interpolatedPrompt = interpolatedPrompt.replaceAll(token, value);
    }

    const fullSystemPrompt = interpolatedPrompt + knowledgeContext;

    // ═══════════════════════════════════════════════════════════════
    // AC-DC / AG-IMG: Image Generation
    // ═══════════════════════════════════════════════════════════════
    if (IMAGE_AGENTS.has(agentName)) {
      const lastUserMessage = messages
        .filter((m: { role: string }) => m.role === "user")
        .pop();

      if (!lastUserMessage) {
        return new Response(
          JSON.stringify({ error: "Nenhuma mensagem do usuário encontrada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const imageMessages = [
        {
          role: "user",
          content: buildImagePrompt(lastUserMessage.content, fullSystemPrompt, agentName),
        },
      ];

      console.log(`${agentName}: generating image for: ${lastUserMessage.content.slice(0, 100)}`);

      const imageAbort = new AbortController();
      const imageTimeout = setTimeout(() => imageAbort.abort(), 55000);

      // Use direct Google AI Studio key if configured, fallback to Lovable gateway
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") ||
        (await supabase.from("api_configs").select("key_value").eq("key_name", "GOOGLE_API_KEY").eq("is_active", true).maybeSingle().then(r => r.data?.key_value || ""));

      let imageResponse: Response;
      try {
        if (GOOGLE_API_KEY) {
          // Direct Google AI Studio call (Banana Pro)
          console.log("AC-DC: using direct Google AI Studio key (Banana Pro)");
          imageResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GOOGLE_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: buildImagePrompt(lastUserMessage.content, fullSystemPrompt) }] }],
                generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
              }),
              signal: imageAbort.signal,
            }
          );
        } else {
          // Fallback: Lovable AI Gateway
          console.log("AC-DC: using Lovable AI Gateway for image (no GOOGLE_API_KEY)");
          imageResponse = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: IMAGE_MODEL,
                messages: imageMessages,
                modalities: ["image", "text"],
              }),
              signal: imageAbort.signal,
            }
          );
        }
      } catch (fetchErr) {
        clearTimeout(imageTimeout);
        const isTimeout =
          fetchErr instanceof Error && fetchErr.name === "AbortError";
        return new Response(
          JSON.stringify({
            error: isTimeout
              ? "A geração de imagem excedeu o tempo limite. Tente uma descrição mais simples."
              : "Erro ao conectar com o serviço de geração de imagens.",
          }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      clearTimeout(imageTimeout);

      if (!imageResponse.ok) {
        if (imageResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (imageResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await imageResponse.text();
        console.error("Image API error:", imageResponse.status, errText);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar imagem" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const imageData = await imageResponse.json();

      // Parse response — Google AI Studio direct vs Lovable gateway have different shapes
      let textContent = "";
      const imageUrls: string[] = [];

      if (GOOGLE_API_KEY) {
        // Google AI Studio response format
        // candidates[0].content.parts[] → { text } or { inlineData: { mimeType, data } }
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> =
          imageData?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.text) textContent += part.text;
          if (part.inlineData?.data) {
            const base64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            const publicUrl = await uploadImageToStorage(supabase, base64, agentName, projectId);
            if (publicUrl) imageUrls.push(publicUrl);
          }
        }
      } else {
        // Lovable gateway response format
        const choice = imageData.choices?.[0]?.message;
        textContent = choice?.content || "";
        const gatewayImages: Array<{ image_url: { url: string } }> = choice?.images || [];
        for (const img of gatewayImages) {
          const rawUrl = img.image_url?.url || "";
          if (rawUrl) {
            const publicUrl = await uploadImageToStorage(supabase, rawUrl, agentName, projectId);
            if (publicUrl) imageUrls.push(publicUrl);
          }
        }
      }

      console.log(`AC-DC: got ${imageUrls.length} image(s)`);

      // Increment creatives usage
      if (userId) {
        await incrementUsage(supabase, userId, agentName, projectId, true);
      }

      return new Response(
        JSON.stringify({
          type: "image_result",
          text: textContent || "Aqui está o criativo gerado! 🎨",
          images: imageUrls,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Response-Type": "image",
          },
        }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // All other agents: Streaming text response
    // ═══════════════════════════════════════════════════════════════
    const apiMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TEXT_MODEL,
          messages: apiMessages,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI Gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro na API de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment interactions usage (fire-and-forget)
    if (userId) {
      incrementUsage(supabase, userId, agentName, projectId, false);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agent-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
