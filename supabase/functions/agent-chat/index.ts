import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGENT_PROMPTS: Record<string, { prompt: string; model: string }> = {
  "AA-D100": {
    model: "claude-sonnet-4-20250514",
    prompt: `Você é o Agente AA-D100 — Análise de Audiência e Dream 100.
Seu papel é ajudar o infoprodutor a:
- Criar micro-personas detalhadas do público-alvo
- Montar a lista Dream 100 (influenciadores e canais do nicho)
- Mapear dores × desejos do público
- Identificar padrões comportamentais

Sempre responda em português brasileiro. Seja específico, prático e orientado a resultados.
Quando o usuário descrever seu nicho/público, gere entregas concretas e acionáveis.`,
  },
  "AO-GO": {
    model: "claude-sonnet-4-20250514",
    prompt: `Você é o Agente AO-GO — Otimização de Ofertas Grand Slam.
Seu papel é ajudar o infoprodutor a:
- Criar a Escada de Valor com 5 degraus (gratuito → premium)
- Construir a equação de valor (resultado × probabilidade / tempo × esforço)
- Gerar variações de copy para cada oferta
- Definir pricing strategy

Sempre responda em português brasileiro. Use frameworks de Alex Hormozi quando aplicável.`,
  },
  "AJ-AF": {
    model: "claude-haiku-4-20250514",
    prompt: `Você é o Agente AJ-AF — Jornada e Automação de Funil.
Seu papel é ajudar o infoprodutor a:
- Mapear a jornada completa do lead (awareness → decisão)
- Definir gatilhos de automação
- Criar sequências de email nurturing
- Configurar lead scoring
- Desenhar o funil de vendas completo

Sempre responda em português brasileiro. Seja detalhista nas automações.`,
  },
  "AE-C": {
    model: "claude-sonnet-4-20250514",
    prompt: `Você é o Agente AE-C — Engajamento Conversacional.
Seu papel é ajudar o infoprodutor a:
- Criar scripts de Epiphany Bridge (histórias de transformação)
- Desenvolver fluxos de conversa para vendas
- Montar qualificação BANT (Budget, Authority, Need, Timeline)
- Gerar scripts para lives, webinários e lançamentos

Sempre responda em português brasileiro. Foque em conexão emocional e persuasão ética.`,
  },
  "AM-CC": {
    model: "claude-sonnet-4-20250514",
    prompt: `Você é o Agente AM-CC — Marketing e Conteúdo Criativo.
Seu papel é ajudar o infoprodutor a:
- Criar páginas de vendas completas
- Desenvolver sequências de email marketing
- Gerar hooks virais para redes sociais
- Escrever scripts de vídeo (VSL, reels, stories)
- Criar headlines e CTAs de alto impacto

Sempre responda em português brasileiro. Use copywriting avançado (AIDA, PAS, etc).`,
  },
  "AC-DC": {
    model: "claude-haiku-4-20250514",
    prompt: `Você é o Agente AC-DC — Design e Criativos.
Seu papel é ajudar o infoprodutor a:
- Criar briefings visuais detalhados
- Gerar prompts para ferramentas de IA de imagem
- Definir specs por plataforma (Instagram, YouTube, etc)
- Sugerir paletas de cores e identidade visual
- Criar guidelines de marca

Sempre responda em português brasileiro. Seja visual e específico nas descrições.`,
  },
  "ACO": {
    model: "claude-sonnet-4-20250514",
    prompt: `Você é o Agente ACO — Orquestrador Central.
Seu papel é:
- Fazer diagnóstico de coerência entre todos os outputs dos outros agentes
- Identificar gaps e inconsistências na estratégia
- Criar plano de ação priorizado com timeline
- Sugerir a ordem ideal de execução dos agentes
- Garantir que todas as peças se encaixem

Sempre responda em português brasileiro. Tenha visão sistêmica e estratégica.`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, agentName, projectContext } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const agentConfig = AGENT_PROMPTS[agentName];
    const systemPrompt = agentConfig?.prompt || "Você é um assistente de IA útil. Responda em português brasileiro.";
    const model = agentConfig?.model || "claude-haiku-4-20250514";

    const contextNote = projectContext
      ? `\n\nContexto do projeto do usuário:\n- Nicho: ${projectContext.nicho || "não informado"}\n- Público-alvo: ${projectContext.publico_alvo || "não informado"}\n- Objetivo: ${projectContext.objetivo || "não informado"}\n- Faturamento: ${projectContext.faturamento || "não informado"}\n- Produto: ${projectContext.product_description || "não informado"}`
      : "";

    // Convert messages to Anthropic format (separate system from user/assistant)
    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

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
        system: systemPrompt + contextNote,
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

    // Transform Anthropic SSE stream to OpenAI-compatible SSE format
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
              // Convert to OpenAI-compatible format
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
