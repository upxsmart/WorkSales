import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Which agent outputs each agent needs as context
const AGENT_DEPENDENCIES: Record<string, string[]> = {
  "AA-D100": [],
  "AO-GO": ["AA-D100"],
  "AJ-AF": ["AA-D100", "AO-GO"],
  "AE-C": ["AA-D100", "AO-GO", "AM-CC"],
  "AM-CC": ["AA-D100", "AO-GO"],
  "AC-DC": ["AA-D100", "AO-GO", "AM-CC"],
  "ACO": ["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC"],
};

// AC-DC: Image generation agent using Nano Banana (fast model to avoid timeout)
const IMAGE_AGENT = "AC-DC";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

/**
 * Build a concise image generation prompt
 */
function buildImagePrompt(userMessage: string, systemPrompt: string): string {
  // Limit system prompt to avoid token bloat and reduce latency
  const systemSummary = systemPrompt.slice(0, 400);
  return `Você é um designer criativo especialista em criativos publicitários de alta conversão. ${systemSummary}\n\nCrie uma imagem publicitária profissional, moderna e impactante para: ${userMessage}`;
}

/**
 * Upload base64 image to Supabase Storage and return public URL
 */
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
      .upload(fileName, bytes, {
        contentType: "image/png",
        upsert: false,
      });

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

    // 1. Fetch active system prompt
    const { data: promptRow } = await supabase
      .from("agent_prompts")
      .select("system_prompt")
      .eq("agent_code", agentName)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const systemPrompt = promptRow?.system_prompt ||
      (agentName === IMAGE_AGENT
        ? "Você é o AC-DC, um agente especialista em design visual e criação de criativos publicitários. Crie imagens profissionais, modernas e impactantes para marketing digital."
        : "Você é um assistente de IA útil. Responda em português brasileiro.");

    // 2. Fetch knowledge base
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

    // 3. Fetch approved outputs from dependency agents
    let crossAgentContext = "";
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
          crossAgentContext = "\n\n--- OUTPUTS APROVADOS DE OUTROS AGENTES ---\n";
          for (const out of outputs) {
            crossAgentContext += `\n### [${out.agent_name}] ${out.title || out.output_type}\n`;
            crossAgentContext += typeof out.output_data === "string"
              ? out.output_data
              : JSON.stringify(out.output_data, null, 2);
            crossAgentContext += "\n";
          }
          crossAgentContext += "\n--- FIM DOS OUTPUTS ---\n\nUse esses outputs como contexto para suas respostas. Referencie-os quando relevante.";
        }
      }
    }

    // 4. Build project context note
    const contextNote = projectContext
      ? `\n\nContexto do projeto do usuário:\n- Nicho: ${projectContext.nicho || "não informado"}\n- Público-alvo: ${projectContext.publico_alvo || "não informado"}\n- Objetivo: ${projectContext.objetivo || "não informado"}\n- Faturamento: ${projectContext.faturamento || "não informado"}\n- Produto: ${projectContext.product_description || "não informado"}`
      : "";

    const fullSystemPrompt = systemPrompt + knowledgeContext + contextNote + crossAgentContext;

    // =============================================
    // AC-DC: Image Generation with Nano Banana
    // =============================================
    if (agentName === IMAGE_AGENT) {
      const lastUserMessage = messages.filter((m: { role: string }) => m.role === "user").pop();

      if (!lastUserMessage) {
        return new Response(JSON.stringify({ error: "Nenhuma mensagem do usuário encontrada" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageMessages = [
        {
          role: "user",
          content: buildImagePrompt(lastUserMessage.content, fullSystemPrompt),
        },
      ];

      console.log(`AC-DC: generating image for prompt: ${lastUserMessage.content.slice(0, 100)}`);

      // Use AbortController with 55s timeout to stay within edge function limits
      const imageAbort = new AbortController();
      const imageTimeout = setTimeout(() => imageAbort.abort(), 55000);

      let imageResponse: Response;
      try {
        imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        });
      } catch (fetchErr) {
        clearTimeout(imageTimeout);
        console.error("Image fetch error:", fetchErr);
        const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
        return new Response(JSON.stringify({
          error: isTimeout
            ? "A geração de imagem excedeu o tempo limite. Tente uma descrição mais simples."
            : "Erro ao conectar com o serviço de geração de imagens."
        }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      clearTimeout(imageTimeout);

      if (!imageResponse.ok) {
        if (imageResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (imageResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await imageResponse.text();
        console.error("Image API error:", imageResponse.status, errText);
        return new Response(JSON.stringify({ error: "Erro ao gerar imagem" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageData = await imageResponse.json();
      console.log("AC-DC: image API response received, processing...");

      const choice = imageData.choices?.[0]?.message;
      const textContent: string = choice?.content || "";
      const generatedImages: Array<{ type: string; image_url: { url: string } }> = choice?.images || [];

      console.log(`AC-DC: got ${generatedImages.length} image(s) from model`);

      // Upload images to storage and collect URLs
      const imageUrls: string[] = [];
      for (const img of generatedImages) {
        const rawUrl = img.image_url?.url || "";
        if (rawUrl) {
          const publicUrl = await uploadImageToStorage(supabase, rawUrl, agentName, projectId);
          if (publicUrl) imageUrls.push(publicUrl);
        }
      }

      console.log(`AC-DC: uploaded ${imageUrls.length} image(s) to storage`);

      const responsePayload = {
        type: "image_result",
        text: textContent || "Aqui está o criativo gerado! 🎨",
        images: imageUrls,
      };

      return new Response(JSON.stringify(responsePayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Response-Type": "image" },
      });
    }

    // =============================================
    // All other agents: Streaming text response
    // =============================================
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
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI Gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na API de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agent-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
