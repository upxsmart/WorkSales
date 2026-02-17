import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentChat } from "@/hooks/useAgentChat";
import { AGENTS_CONFIG, AgentCode } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Brain, Send, Loader2, Check, Download,
  AlertTriangle, Lightbulb, ListChecks, User, ChevronRight,
} from "lucide-react";

type AgentOutput = {
  id: string;
  agent_name: string;
  output_type: string;
  title: string;
  output_data: unknown;
  is_approved: boolean;
  created_at: string;
  version: number;
};

const AGENT_FLOW = [
  { code: "AA-D100", deps: [] },
  { code: "AO-GO", deps: ["AA-D100"] },
  { code: "AJ-AF", deps: ["AA-D100", "AO-GO"] },
  { code: "AE-C", deps: ["AA-D100", "AO-GO", "AM-CC"] },
  { code: "AM-CC", deps: ["AA-D100", "AO-GO"] },
  { code: "AC-DC", deps: ["AA-D100", "AO-GO", "AM-CC"] },
];

const getAgentStatus = (code: string, outputs: AgentOutput[]) => {
  const agentOutputs = outputs.filter(o => o.agent_name === code && o.is_approved);
  if (agentOutputs.length === 0) return "pendente";
  return "concluído";
};

const Orchestrator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, clearMessages, setMessages } = useAgentChat();
  const { toast } = useToast();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Record<string, unknown> | null>(null);
  const [allOutputs, setAllOutputs] = useState<AgentOutput[]>([]);
  const [actionPlan, setActionPlan] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isGeneratingDiagnosis, setIsGeneratingDiagnosis] = useState(false);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = AGENTS_CONFIG["ACO"];

  // Load project + outputs
  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setProject(data as Record<string, unknown>);
          setProjectId(data.id);
        }
      });
  }, [user]);

  const loadOutputs = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("agent_outputs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (data) setAllOutputs(data as AgentOutput[]);
  }, [projectId]);

  useEffect(() => { loadOutputs(); }, [loadOutputs]);

  // Load chat history
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("chat_messages")
      .select("role, content")
      .eq("project_id", projectId)
      .eq("agent_name", "ACO")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
        }
      });
  }, [projectId, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages
  useEffect(() => {
    if (isLoading || !projectId || messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "assistant") {
      const userMsg = messages[messages.length - 2];
      if (userMsg?.role === "user") {
        Promise.all([
          supabase.from("chat_messages").insert({ project_id: projectId, agent_name: "ACO", role: "user", content: userMsg.content }),
          supabase.from("chat_messages").insert({ project_id: projectId, agent_name: "ACO", role: "assistant", content: lastMsg.content }),
        ]);
      }
    }
  }, [isLoading, messages, projectId]);

  const completedAgents = AGENT_FLOW.filter(a => getAgentStatus(a.code, allOutputs) === "concluído").length;
  const progressPercent = Math.round((completedAgents / 6) * 100);

  const handleGeneratePlan = async () => {
    if (!projectId) return;
    setIsGeneratingPlan(true);
    const prompt = "Analise todos os outputs aprovados dos meus agentes e gere um PLANO DE AÇÃO PRIORIZADO completo com: tasks específicas, prioridade (Alta/Média/Baixa), agente responsável, e timeline sugerida. Formato: lista organizada por prioridade.";
    
    // Use sendMessage from chat hook but capture the response
    await sendMessage(prompt, "ACO", projectId, project || undefined);
    setIsGeneratingPlan(false);
    setActiveTab("plan");
  };

  const handleGenerateDiagnosis = async () => {
    if (!projectId) return;
    setIsGeneratingDiagnosis(true);
    const prompt = "Faça um DIAGNÓSTICO INTELIGENTE completo do meu projeto analisando todos os outputs dos agentes. Identifique: 1) GAPS - o que está faltando, 2) INCONSISTÊNCIAS - contradições entre outputs, 3) OPORTUNIDADES - melhorias possíveis. Seja específico com exemplos concretos.";
    
    await sendMessage(prompt, "ACO", projectId, project || undefined);
    setIsGeneratingDiagnosis(false);
    setActiveTab("diagnosis");
  };

  const handleExportAll = async () => {
    if (!projectId || !user) return;

    let markdown = "# Estrutura Completa do Projeto\n\n";
    markdown += `Exportado em: ${new Date().toLocaleDateString("pt-BR")}\n\n---\n\n`;

    const agentCodes = ["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC"];
    for (const code of agentCodes) {
      const agentConfig = AGENTS_CONFIG[code as AgentCode];
      const outputs = allOutputs.filter(o => o.agent_name === code && o.is_approved);
      
      markdown += `## ${agentConfig.fullName} (${code})\n\n`;
      if (outputs.length === 0) {
        markdown += "_Nenhum output aprovado._\n\n";
      } else {
        for (const out of outputs) {
          const content = typeof out.output_data === "object" && out.output_data !== null && "content" in (out.output_data as Record<string, unknown>)
            ? String((out.output_data as Record<string, unknown>).content)
            : JSON.stringify(out.output_data, null, 2);
          markdown += `### ${out.title || out.output_type} (v${out.version})\n\n${content}\n\n`;
        }
      }
      markdown += "---\n\n";
    }

    // Upload to Supabase Storage
    const fileName = `${user.id}/estrutura-completa-${Date.now()}.md`;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const { error } = await supabase.storage.from("exports").upload(fileName, blob);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível exportar.", variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("exports").getPublicUrl(fileName);
    
    // Also download locally
    const localBlob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(localBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estrutura-completa.md";
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exportado! 📄", description: "Estrutura completa baixada e salva no storage." });
  };

  const handleSend = () => {
    if (!input.trim() || isLoading || !projectId) return;
    sendMessage(input.trim(), "ACO", projectId, project || undefined);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Find last assistant message for plan/diagnosis
  const planMessages = messages.filter(m => m.role === "assistant");
  const lastPlanMsg = planMessages.length > 0 ? planMessages[planMessages.length - 1] : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-display font-semibold text-sm">Orquestrador Central</h1>
            <p className="text-xs text-muted-foreground">ACO · Visão sistêmica do projeto</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportAll} className="text-xs">
            <Download className="w-3.5 h-3.5 mr-1" /> Exportar Estrutura
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border px-4">
          <div className="max-w-[1600px] mx-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-4">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 pt-3 text-sm">
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="plan" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 pt-3 text-sm">
                Plano de Ação
              </TabsTrigger>
              <TabsTrigger value="diagnosis" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 pt-3 text-sm">
                Diagnóstico
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 pt-3 text-sm">
                Chat
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* TAB 1: Overview */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto mt-0">
          <div className="max-w-[1200px] mx-auto p-6 space-y-8">
            {/* Progress Summary */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold">Progresso Geral</h3>
                <span className="text-2xl font-bold gradient-text">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3 mb-4" />
              <p className="text-sm text-muted-foreground">{completedAgents}/6 agentes com outputs aprovados</p>
            </motion.div>

            {/* Agent Flow */}
            <div>
              <h3 className="font-display text-lg font-semibold mb-4">Fluxo de Agentes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AGENT_FLOW.map((flow, i) => {
                  const agentConfig = AGENTS_CONFIG[flow.code as AgentCode];
                  const status = getAgentStatus(flow.code, allOutputs);
                  const agentOutputsCount = allOutputs.filter(o => o.agent_name === flow.code && o.is_approved).length;
                  const IconComp = agentConfig.icon;

                  return (
                    <motion.div
                      key={flow.code}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="glass rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-all"
                      onClick={() => navigate(`/agent/${flow.code}`)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${agentConfig.color} flex items-center justify-center`}>
                          <IconComp className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-display text-sm font-semibold">{agentConfig.name}</h4>
                          <span className="text-xs font-mono text-muted-foreground">{flow.code}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          status === "concluído" 
                            ? "bg-green-500/10 text-green-400" 
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {status === "concluído" ? "✓ Concluído" : "Pendente"}
                        </span>
                      </div>
                      <Progress value={status === "concluído" ? 100 : 0} className="h-1.5 mb-2" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{agentOutputsCount} output(s)</span>
                        {flow.deps.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Depende: {flow.deps.join(", ")}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleGeneratePlan}
                disabled={isGeneratingPlan}
                className="glass glass-hover rounded-xl p-5 text-left group"
              >
                <ListChecks className="w-8 h-8 text-primary mb-3" />
                <h4 className="font-display font-semibold text-sm">Gerar Plano de Ação</h4>
                <p className="text-xs text-muted-foreground mt-1">IA analisa outputs e cria plano priorizado</p>
              </button>
              <button
                onClick={handleGenerateDiagnosis}
                disabled={isGeneratingDiagnosis}
                className="glass glass-hover rounded-xl p-5 text-left group"
              >
                <AlertTriangle className="w-8 h-8 text-accent mb-3" />
                <h4 className="font-display font-semibold text-sm">Diagnóstico Inteligente</h4>
                <p className="text-xs text-muted-foreground mt-1">Identifica gaps e inconsistências</p>
              </button>
              <button
                onClick={handleExportAll}
                className="glass glass-hover rounded-xl p-5 text-left group"
              >
                <Download className="w-8 h-8 text-green-400 mb-3" />
                <h4 className="font-display font-semibold text-sm">Exportar Tudo</h4>
                <p className="text-xs text-muted-foreground mt-1">Baixar estrutura completa em Markdown</p>
              </button>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Action Plan */}
        <TabsContent value="plan" className="flex-1 overflow-y-auto mt-0">
          <div className="max-w-[1000px] mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display text-lg font-semibold">Plano de Ação Priorizado</h3>
                <p className="text-sm text-muted-foreground">Gerado pelo ACO com base nos outputs aprovados</p>
              </div>
              <Button onClick={handleGeneratePlan} disabled={isGeneratingPlan || isLoading} size="sm">
                {isGeneratingPlan || isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Lightbulb className="w-4 h-4 mr-1" />}
                {isGeneratingPlan || isLoading ? "Gerando..." : "Gerar Plano"}
              </Button>
            </div>
            {lastPlanMsg ? (
              <div className="glass rounded-xl p-6">
                <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_table]:w-full [&_th]:text-foreground [&_td]:border-border [&_th]:border-border">
                  <ReactMarkdown>{lastPlanMsg.content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ListChecks className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm">Nenhum plano gerado ainda.</p>
                <p className="text-xs mt-1">Clique em "Gerar Plano" para o ACO analisar seu projeto.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: Diagnosis */}
        <TabsContent value="diagnosis" className="flex-1 overflow-y-auto mt-0">
          <div className="max-w-[1000px] mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display text-lg font-semibold">Diagnóstico Inteligente</h3>
                <p className="text-sm text-muted-foreground">Gaps, inconsistências e oportunidades</p>
              </div>
              <Button onClick={handleGenerateDiagnosis} disabled={isGeneratingDiagnosis || isLoading} size="sm">
                {isGeneratingDiagnosis || isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
                {isGeneratingDiagnosis || isLoading ? "Analisando..." : "Gerar Diagnóstico"}
              </Button>
            </div>
            {lastPlanMsg ? (
              <div className="glass rounded-xl p-6">
                <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground">
                  <ReactMarkdown>{lastPlanMsg.content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <AlertTriangle className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm">Nenhum diagnóstico gerado ainda.</p>
                <p className="text-xs mt-1">Clique em "Gerar Diagnóstico" para análise completa.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 4: Chat */}
        <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Brain className="w-16 h-16 mx-auto mb-4 text-indigo-500 opacity-40" />
                  <h2 className="font-display text-xl font-bold mb-2">Chat com o Orquestrador</h2>
                  <p className="text-sm text-muted-foreground mb-6">Pergunte qualquer coisa sobre seu projeto. O ACO tem acesso a todos os outputs.</p>
                  <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                    {agent.suggestions.map(s => (
                      <button key={s} onClick={() => setInput(s)} className="text-left p-2.5 rounded-xl border border-border hover:border-primary/50 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
                      <Brain className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "glass"}`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Analisando...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-border bg-background/80 backdrop-blur-xl px-4 py-3">
            <div className="max-w-3xl mx-auto flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte ao Orquestrador..."
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
              />
              <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="gradient-primary text-primary-foreground glow-primary shrink-0" size="icon">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Orchestrator;
