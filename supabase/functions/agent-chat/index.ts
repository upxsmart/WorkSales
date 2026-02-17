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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, agentName, projectId, projectContext } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch active system prompt from agent_prompts table
    const { data: promptRow } = await supabase
      .from("agent_prompts")
      .select("system_prompt")
      .eq("agent_code", agentName)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const systemPrompt = promptRow?.system_prompt || "Você é um assistente de IA útil. Responda em português brasileiro.";

    // 2. Fetch knowledge base for this agent
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

    // 4. Convert messages to Anthropic format
    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    // 5. Call Anthropic API with streaming
    const model = "claude-sonnet-4-20250514";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: fullSystemPrompt,
        messages: anthropicMessages,
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
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na API da Anthropic" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Transform Anthropic SSE stream to OpenAI-compatible format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "content_block_delta" && event.delta?.text) {
              const openAIChunk = {
                choices: [{ delta: { content: event.delta.text } }],
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
            } else if (event.type === "message_stop") {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            }
          } catch {
            // ignore parse errors
          }
        }
      },
    });

    const transformedStream = response.body!.pipeThrough(transformStream);

    return new Response(transformedStream, {
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
