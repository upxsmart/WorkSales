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

const AGENT_TO_TOKEN: Record<string, string> = {
  "AA-D100": "{{PERSONAS}}",
  "AO-GO":   "{{OFERTAS}}",
  "AJ-AF":   "{{FUNIL}}",
  "AM-CC":   "{{COPY}}",
  "AC-DC":   "{{CRIATIVOS}}",
  "AE-C":    "{{ENGAJAMENTO}}",
  "AT-GP":   "{{TRAFEGO}}",
};

function outputToText(out: { title?: string; output_type?: string; output_data: unknown }): string {
  const header = `[${out.title || out.output_type || "Output"}]`;
  const body = typeof out.output_data === "string"
    ? out.output_data
    : JSON.stringify(out.output_data, null, 2);
  return `${header}\n${body}`;
}

// Agents that generate images
const IMAGE_AGENTS = new Set(["AC-DC", "AG-IMG"]);
const TEXT_MODEL = "google/gemini-3-flash-preview";
const IMAGE_MODEL = "google/gemini-2.5-flash-image"; // kept for usage log label only

// ── Image generation via Google AI Studio direct (GOOGLE_API_KEY) ─────────────
const GOOGLE_IMAGE_MODELS = [
  "gemini-2.5-flash-image",           // Nano Banana — primary
  "gemini-3-pro-image-preview",       // Gemini 3 Pro Image Preview — fallback
];

async function generateImageViaGoogleDirect(
  prompt: string,
  googleApiKey: string
): Promise<{ base64: string; mimeType: string } | null> {
  for (const model of GOOGLE_IMAGE_MODELS) {
    try {
      console.log(`Trying Google AI Studio model: ${model}`);
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": googleApiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );
      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`Google AI Studio error (${model}): ${resp.status}`, errText);
        continue;
      }
      const data = await resp.json();
      const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> =
        data?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          console.log(`Image generated successfully via Google AI Studio (${model})`);
          return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
        }
      }
      console.warn(`${model} returned no image data. Trying next...`);
    } catch (e) {
      console.error(`generateImageViaGoogleDirect (${model}) error:`, e);
    }
  }
  return null;
}


// ── Anthropic fallback for text generation ───────────────────────────────────
async function generateTextViaAnthropic(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  anthropicApiKey: string
): Promise<ReadableStream | null> {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 4096,
        system: systemPrompt,
        stream: true,
        messages: messages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
      }),
    });
    if (!resp.ok) {
      console.error("Anthropic API error:", resp.status, await resp.text());
      return null;
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
      const reader = resp.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).replace(/\r$/, "");
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                const chunk = { choices: [{ delta: { content: parsed.delta.text } }] };
                await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              } else if (parsed.type === "message_stop") {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } finally {
        await writer.close();
      }
    })();

    return readable;
  } catch (e) {
    console.error("generateTextViaAnthropic error:", e);
    return null;
  }
}

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

async function incrementUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  agentCode: string,
  projectId?: string,
  isImage = false
): Promise<void> {
  const field = isImage ? "creatives_used" : "interactions_used";
  try {
    await supabase.rpc("increment_profile_usage", { _user_id: userId, _field: field });
  } catch {
    try {
      const { data } = await supabase.from("profiles").select(field).eq("user_id", userId).single();
      if (data) {
        await supabase
          .from("profiles")
          .update({ [field]: (data as Record<string, number>)[field] + 1 })
          .eq("user_id", userId);
      }
    } catch (e) {
      console.error("incrementUsage fallback error:", e);
    }
  }
  supabase.from("usage_logs").insert({
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
    const { messages, agentName, projectId, projectContext, imageCount } = await req.json();
    const numImages = Math.min(Math.max(Number(imageCount) || 1, 1), 4);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Auth ────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userProfile: Record<string, unknown> = {};

    const authResult = await getUserFromAuth(supabase, authHeader);
    if (authResult) {
      userId = authResult.userId;
      userProfile = authResult.profile;
    }

    // ── Usage limit check ───────────────────────────────────────────
    if (userId && userProfile && Object.keys(userProfile).length > 0) {
      const isImage = IMAGE_AGENTS.has(agentName);
      const usedField = isImage ? "creatives_used" : "interactions_used";
      const limitField = isImage ? "creatives_limit" : "interactions_limit";
      const used = (userProfile[usedField] as number) ?? 0;
      const rawLimit = (userProfile[limitField] as number);
      const limit = rawLimit > 0 ? rawLimit : (PLAN_LIMITS[(userProfile.plan as string) || "starter"] ?? 100);

      if (limit > 0 && used >= limit) {
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

    // ── 1. System prompt ────────────────────────────────────────────
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
      (IMAGE_AGENTS.has(agentName)
        ? "Você é um agente especialista em criação de imagens publicitárias de alta definição."
        : "Você é um assistente de IA útil. Responda em português brasileiro.");

    // ── 2. Knowledge base ───────────────────────────────────────────
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

    // ── 3. Dependency outputs / token interpolation ─────────────────
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
          const byAgent: Record<string, string[]> = {};
          for (const out of outputs) {
            if (!byAgent[out.agent_name]) byAgent[out.agent_name] = [];
            byAgent[out.agent_name].push(outputToText(out));
          }
          for (const [agentCode, texts] of Object.entries(byAgent)) {
            const token = AGENT_TO_TOKEN[agentCode];
            if (token) tokenValues[token] = texts.join("\n\n");
          }
        }
      }
    }

    for (const token of Object.values(AGENT_TO_TOKEN)) {
      if (!tokenValues[token]) {
        tokenValues[token] = `[Nenhum output aprovado disponível para este contexto.]`;
      }
    }

    // ── 3b. Meta Ads data for AT-GP ─────────────────────────────────
    if (agentName === "AT-GP" && projectId) {
      let metaAdsText = "";
      const { data: conn } = await supabase
        .from("meta_ads_connections")
        .select("ad_account_id, page_id, pixel_id, instagram_account_id, connection_status, last_sync_at")
        .eq("project_id", projectId)
        .eq("connection_status", "active")
        .maybeSingle();

      if (conn) {
        metaAdsText += `CONTA META ADS CONECTADA:\n- Ad Account ID: ${conn.ad_account_id}\n`;
        if (conn.page_id)              metaAdsText += `- Page ID: ${conn.page_id}\n`;
        if (conn.pixel_id)             metaAdsText += `- Pixel ID: ${conn.pixel_id}\n`;
        if (conn.instagram_account_id) metaAdsText += `- Instagram Account ID: ${conn.instagram_account_id}\n`;
        if (conn.last_sync_at)         metaAdsText += `- Última sincronização: ${new Date(conn.last_sync_at).toLocaleString("pt-BR")}\n`;

        const { data: cacheItems } = await supabase
          .from("meta_ads_cache")
          .select("data_type, data, synced_at")
          .eq("project_id", projectId)
          .gt("expires_at", new Date().toISOString())
          .order("synced_at", { ascending: false });

        if (cacheItems && cacheItems.length > 0) {
          metaAdsText += `\nDADOS EM CACHE:\n`;
          for (const item of cacheItems) {
            metaAdsText += `\n### ${item.data_type.toUpperCase()}:\n`;
            const raw = typeof item.data === "string" ? item.data : JSON.stringify(item.data, null, 2);
            metaAdsText += raw.slice(0, 3000);
            if (raw.length > 3000) metaAdsText += "\n[... truncado]";
            metaAdsText += "\n";
          }
        } else {
          metaAdsText += `\nNenhum cache disponível. Sugira ao usuário clicar em "Sincronizar".`;
        }
      } else {
        metaAdsText = "Conta Meta Ads NÃO conectada a este projeto.";
      }
      tokenValues["{{META_ADS_DATA}}"] = metaAdsText;
    } else {
      tokenValues["{{META_ADS_DATA}}"] = "[Meta Ads não conectado.]";
    }

    // ── 3c. Demandas pendentes para AT-GP ───────────────────────────
    if (agentName === "AT-GP" && projectId) {
      const { data: demands } = await supabase
        .from("agent_demands")
        .select("from_agent, to_agent, demand_type, reason, suggestion, priority")
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
        tokenValues["{{DEMANDAS}}"] = "[Nenhuma demanda pendente.]";
      }
    } else {
      tokenValues["{{DEMANDAS}}"] = "[Nenhuma demanda pendente.]";
    }

    // ── 4. Project context ──────────────────────────────────────────
    const projectInfo = projectContext
      ? `Nicho: ${projectContext.nicho || "não informado"} | Público-alvo: ${projectContext.publico_alvo || "não informado"} | Objetivo: ${projectContext.objetivo || "não informado"} | Faturamento: ${projectContext.faturamento || "não informado"} | Produto: ${projectContext.product_description || "não informado"}`
      : "Informações do projeto não disponíveis.";
    tokenValues["{{PROJETO_INFO}}"] = projectInfo;

    // ── 5. Interpolate tokens ───────────────────────────────────────
    let interpolatedPrompt = systemPrompt;
    for (const [token, value] of Object.entries(tokenValues)) {
      interpolatedPrompt = interpolatedPrompt.replaceAll(token, value);
    }
    const fullSystemPrompt = interpolatedPrompt + knowledgeContext;

    // ═══════════════════════════════════════════════════════════════
    // AC-DC / AG-IMG: Image Generation via Google AI Studio direct
    // Uses GOOGLE_API_KEY with gemini-2.0-flash-exp model
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

      // Get GOOGLE_API_KEY from env or api_configs table
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") ||
        await supabase.from("api_configs").select("key_value").eq("key_name", "GOOGLE_API_KEY").eq("is_active", true).maybeSingle()
          .then(({ data }) => data?.key_value || null);

      if (!GOOGLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "GOOGLE_API_KEY não configurada. Configure no painel de Secrets do Supabase ou na tabela api_configs." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`${agentName}: generating ${numImages} image(s) via Google AI Studio (gemini-2.0-flash-exp)`);

      const imagePrompt = buildImagePrompt(lastUserMessage.content, fullSystemPrompt, agentName);

      let results: Array<{ base64: string; mimeType: string } | null> = [];
      try {
        const requests = Array.from({ length: numImages }, () =>
          generateImageViaGoogleDirect(imagePrompt, GOOGLE_API_KEY as string)
        );
        results = await Promise.all(requests);
      } catch (err) {
        console.error("Google AI Studio batch error:", err);
      }

      const imageUrls: string[] = [];
      for (const result of results) {
        if (result) {
          const publicUrl = await uploadImageToStorage(
            supabase,
            `data:${result.mimeType};base64,${result.base64}`,
            agentName,
            projectId
          );
          imageUrls.push(publicUrl ?? `data:${result.mimeType};base64,${result.base64}`);
        }
      }

      if (imageUrls.length === 0) {
        return new Response(
          JSON.stringify({ error: "Falha ao gerar imagem via Google AI Studio. Verifique se a GOOGLE_API_KEY é válida e se o modelo gemini-2.0-flash-exp está disponível na sua conta." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`${agentName}: got ${imageUrls.length} image(s) from Google AI Studio`);

      if (userId) {
        for (let i = 0; i < numImages; i++) {
          await incrementUsage(supabase, userId, agentName, projectId, true);
        }
      }

      return new Response(
        JSON.stringify({
          type: "image_result",
          text: `Aqui ${imageUrls.length === 1 ? "está o criativo gerado" : `estão os ${imageUrls.length} criativos gerados`} com Google AI Studio! 🎨`,
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
    // All other agents: Streaming text via Lovable AI Gateway
    // Fallback: Anthropic on 402/429
    // ═══════════════════════════════════════════════════════════════
    const apiMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    });

    if (!response.ok) {
      if (response.status === 402 || response.status === 429) {
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        if (ANTHROPIC_API_KEY) {
          console.log(`Gateway returned ${response.status}, falling back to Anthropic`);
          const systemContent = apiMessages.find((m: { role: string }) => m.role === "system")?.content || fullSystemPrompt;
          const userMsgs = apiMessages.filter((m: { role: string }) => m.role !== "system");
          const fallbackStream = await generateTextViaAnthropic(systemContent, userMsgs, ANTHROPIC_API_KEY);
          if (fallbackStream) {
            if (userId) incrementUsage(supabase, userId, agentName, projectId, false);
            return new Response(fallbackStream, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
            });
          }
        }
        return new Response(
          JSON.stringify({ error: response.status === 402 ? "Créditos insuficientes. Adicione créditos ao workspace." : "Limite de requisições excedido. Tente novamente." }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI Gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro na API de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userId) {
      incrementUsage(supabase, userId, agentName, projectId, false);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agent-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
