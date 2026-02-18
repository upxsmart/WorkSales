import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXT_MODEL = "google/gemini-3-flash-preview";

// Ordem de execução dos agentes
const EXECUTION_ORDER = [
  { agent: "AA-D100", label: "Analisando audiência e criando personas..." },
  { agent: "AO-GO",  label: "Criando oferta Grand Slam..." },
  { agent: "AJ-AF",  label: "Mapeando jornada do funil..." },
  { agent: "AM-CC",  label: "Gerando copy e conteúdo estratégico..." },
  { agent: "AC-DC",  label: "Definindo briefings de criativos visuais..." },
  { agent: "AE-C",   label: "Criando scripts de vendas e engajamento..." },
  { agent: "AT-GP",  label: "Planejando estratégia de tráfego pago..." },
  { agent: "ACO",    label: "Compilando plano completo do negócio..." },
];

// Dependências por agente
const AGENT_DEPS: Record<string, string[]> = {
  "AA-D100": [],
  "AO-GO": ["AA-D100"],
  "AJ-AF": ["AA-D100", "AO-GO"],
  "AM-CC": ["AA-D100", "AO-GO"],
  "AC-DC": ["AA-D100", "AO-GO", "AM-CC"],
  "AE-C": ["AA-D100", "AO-GO", "AM-CC", "AJ-AF"],
  "AT-GP": ["AA-D100", "AO-GO", "AM-CC", "AC-DC"],
  "ACO": ["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC", "AT-GP"],
};

async function callAgentAI(
  lovableKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: false,
        max_tokens: 2048,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth
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

    const { run_id, action } = await req.json();

    // Buscar o run
    const { data: run, error: runErr } = await supabase
      .from("orchestrator_runs")
      .select("*, projects!inner(user_id, nicho, publico_alvo, objetivo, faturamento, product_description, name)")
      .eq("id", run_id)
      .single();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "Run não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verificar que o run pertence ao usuário
    if ((run.projects as { user_id: string }).user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "cancel") {
      await supabase.from("orchestrator_runs").update({ status: "cancelled" }).eq("id", run_id);
      await supabase.from("projects").update({ orchestrator_status: "idle" }).eq("id", run.project_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action !== "start") {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Executar agentes sequencialmente
    const project = run.projects as Record<string, unknown>;
    const collectedData = (run.collected_data as Record<string, unknown>) || {};
    const agentResults: Record<string, string> = (run.agent_results as Record<string, string>) || {};

    const projectContext = `
Projeto: ${project.name || ""}
Nicho: ${project.nicho || collectedData.nicho || "não informado"}
Público-alvo: ${project.publico_alvo || collectedData.publico_alvo || "não informado"}
Objetivo: ${project.objetivo || collectedData.objetivo || "não informado"}
Faturamento: ${project.faturamento || collectedData.faturamento || "não informado"}
Produto: ${project.product_description || collectedData.produto || "não informado"}
BIG IDEA: ${run.big_idea}
Dados coletados: ${JSON.stringify(collectedData, null, 2)}
`.trim();

    for (let i = 0; i < EXECUTION_ORDER.length; i++) {
      const { agent } = EXECUTION_ORDER[i];

      // Pular agentes já concluídos
      if (agentResults[agent]) continue;

      // Atualizar status
      await supabase.from("orchestrator_runs").update({
        status: "running",
        current_step: i,
      }).eq("id", run_id);

      await supabase.from("projects").update({
        orchestrator_status: "running",
        orchestrator_current_agent: agent,
      }).eq("id", run.project_id);

      // Buscar system prompt do agente
      const { data: promptRow } = await supabase
        .from("agent_prompts")
        .select("system_prompt")
        .eq("agent_code", agent)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const basePrompt = promptRow?.system_prompt ||
        `Você é o agente ${agent} especializado no ecossistema FORJA.AI. Responda em português.`;

      // Montar contexto com resultados anteriores dos agentes dependentes
      let contextFromOtherAgents = "";
      const deps = AGENT_DEPS[agent] || [];
      for (const dep of deps) {
        if (agentResults[dep]) {
          contextFromOtherAgents += `\n\n--- OUTPUT DO AGENTE ${dep} ---\n${agentResults[dep]}\n--- FIM ---`;
        }
      }

      const fullPrompt = basePrompt + "\n\n" + projectContext + contextFromOtherAgents;

      const userMsg = agent === "ACO"
        ? `Com base em TODOS os outputs dos agentes acima, compile um PLANO COMPLETO DO NEGÓCIO estruturado com: Resumo Executivo, Personas Principais, Oferta e Precificação, Mapa do Funil, Calendário de Conteúdo, Briefings de Criativos, Scripts de Vendas, Plano de Tráfego com orçamento, e Projeção de Faturamento. Seja detalhado e prático.`
        : `Execute sua missão completa para este projeto. BIG IDEA: "${run.big_idea}". Use todos os dados do projeto fornecidos no contexto. Entregue um output completo, estruturado e acionável.`;

      try {
        const result = await callAgentAI(LOVABLE_API_KEY, fullPrompt, userMsg);
        agentResults[agent] = result;

        // Salvar output no banco
        await supabase.from("agent_outputs").insert({
          project_id: run.project_id,
          agent_name: agent,
          output_type: agent === "ACO" ? "master_plan" : "orchestrator_draft",
          title: `${agent} — Orquestrador (${new Date().toLocaleDateString("pt-BR")})`,
          output_data: { content: result, source: "orchestrator", run_id },
          is_approved: false,
          version: 1,
        });

        // Atualizar run com resultado parcial
        await supabase.from("orchestrator_runs").update({
          agent_results: agentResults,
          current_step: i + 1,
        }).eq("id", run_id);

      } catch (agentErr) {
        console.error(`Erro no agente ${agent}:`, agentErr);
        // Continuar mesmo com erro, registrar no resultado
        agentResults[agent] = `[Erro ao processar: ${agentErr instanceof Error ? agentErr.message : "erro desconhecido"}]`;
        await supabase.from("orchestrator_runs").update({
          agent_results: agentResults,
          current_step: i + 1,
        }).eq("id", run_id);
      }
    }

    // Finalizar
    const masterPlan = agentResults["ACO"] || "";
    await supabase.from("orchestrator_runs").update({
      status: "completed",
      current_step: EXECUTION_ORDER.length,
      agent_results: agentResults,
      master_plan: { content: masterPlan },
      completed_at: new Date().toISOString(),
    }).eq("id", run_id);

    await supabase.from("projects").update({
      orchestrator_status: "completed",
      orchestrator_current_agent: null,
      master_plan: { content: masterPlan, run_id, completed_at: new Date().toISOString() },
    }).eq("id", run.project_id);

    return new Response(JSON.stringify({ success: true, agent_results: agentResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("orchestrator-run error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
