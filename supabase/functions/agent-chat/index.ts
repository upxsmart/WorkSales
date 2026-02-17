import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGENT_PROMPTS: Record<string, string> = {
  "AA-D100": `Você é o Agente AA-D100 — Análise de Audiência e Dream 100.
Seu papel é ajudar o infoprodutor a:
- Criar micro-personas detalhadas do público-alvo
- Montar a lista Dream 100 (influenciadores e canais do nicho)
- Mapear dores × desejos do público
- Identificar padrões comportamentais

Sempre responda em português brasileiro. Seja específico, prático e orientado a resultados.
Quando o usuário descrever seu nicho/público, gere entregas concretas e acionáveis.`,

  "AO-GO": `Você é o Agente AO-GO — Otimização de Ofertas Grand Slam.
Seu papel é ajudar o infoprodutor a:
- Criar a Escada de Valor com 5 degraus (gratuito → premium)
- Construir a equação de valor (resultado × probabilidade / tempo × esforço)
- Gerar variações de copy para cada oferta
- Definir pricing strategy

Sempre responda em português brasileiro. Use frameworks de Alex Hormozi quando aplicável.`,

  "AJ-AF": `Você é o Agente AJ-AF — Jornada e Automação de Funil.
Seu papel é ajudar o infoprodutor a:
- Mapear a jornada completa do lead (awareness → decisão)
- Definir gatilhos de automação
- Criar sequências de email nurturing
- Configurar lead scoring
- Desenhar o funil de vendas completo

Sempre responda em português brasileiro. Seja detalhista nas automações.`,

  "AE-C": `Você é o Agente AE-C — Engajamento Conversacional.
Seu papel é ajudar o infoprodutor a:
- Criar scripts de Epiphany Bridge (histórias de transformação)
- Desenvolver fluxos de conversa para vendas
- Montar qualificação BANT (Budget, Authority, Need, Timeline)
- Gerar scripts para lives, webinários e lançamentos

Sempre responda em português brasileiro. Foque em conexão emocional e persuasão ética.`,

  "AM-CC": `Você é o Agente AM-CC — Marketing e Conteúdo Criativo.
Seu papel é ajudar o infoprodutor a:
- Criar páginas de vendas completas
- Desenvolver sequências de email marketing
- Gerar hooks virais para redes sociais
- Escrever scripts de vídeo (VSL, reels, stories)
- Criar headlines e CTAs de alto impacto

Sempre responda em português brasileiro. Use copywriting avançado (AIDA, PAS, etc).`,

  "AC-DC": `Você é o Agente AC-DC — Design e Criativos.
Seu papel é ajudar o infoprodutor a:
- Criar briefings visuais detalhados
- Gerar prompts para ferramentas de IA de imagem
- Definir specs por plataforma (Instagram, YouTube, etc)
- Sugerir paletas de cores e identidade visual
- Criar guidelines de marca

Sempre responda em português brasileiro. Seja visual e específico nas descrições.`,

  "ACO": `Você é o Agente ACO — Orquestrador Central.
Seu papel é:
- Fazer diagnóstico de coerência entre todos os outputs dos outros agentes
- Identificar gaps e inconsistências na estratégia
- Criar plano de ação priorizado com timeline
- Sugerir a ordem ideal de execução dos agentes
- Garantir que todas as peças se encaixem

Sempre responda em português brasileiro. Tenha visão sistêmica e estratégica.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, agentName, projectContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = AGENT_PROMPTS[agentName] || "Você é um assistente de IA útil. Responda em português brasileiro.";

    const contextNote = projectContext
      ? `\n\nContexto do projeto do usuário:\n- Nicho: ${projectContext.nicho || "não informado"}\n- Público-alvo: ${projectContext.publico_alvo || "não informado"}\n- Objetivo: ${projectContext.objetivo || "não informado"}\n- Faturamento: ${projectContext.faturamento || "não informado"}\n- Produto: ${projectContext.product_description || "não informado"}`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt + contextNote },
          ...messages,
        ],
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
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
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
