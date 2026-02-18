import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAgentChat } from "@/hooks/useAgentChat";
import { AGENTS_CONFIG, ORCHESTRATOR_EXECUTION_ORDER, AgentCode } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Brain, Send, Loader2, Check, Download,
  Sparkles, ChevronRight, User, Bot, Play, Square,
  CheckCircle2, Clock, Zap, Users, Target, FileText,
  Megaphone, Eye, RefreshCw, ExternalLink,
} from "lucide-react";

type OrchestratorRun = {
  id: string;
  project_id: string;
  big_idea: string;
  collected_data: Record<string, unknown>;
  status: string;
  current_step: number;
  total_steps: number;
  agent_results: Record<string, string>;
  master_plan: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
};

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

type Phase = "entry" | "chat" | "running" | "results";

const AGENT_EXECUTION_FLOW = ORCHESTRATOR_EXECUTION_ORDER;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const AgentIcon = ({ code }: { code: string }) => {
  const agent = AGENTS_CONFIG[code as AgentCode];
  if (!agent) return <Bot className="w-4 h-4" />;
  const Icon = agent.icon;
  return <Icon className="w-4 h-4" />;
};

const Orchestrator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProject } = useActiveProject();
  const { messages, isLoading: isChatLoading, sendMessage, clearMessages, setMessages } = useAgentChat();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("entry");
  const [bigIdea, setBigIdea] = useState("");
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("plan");
  const [selectedResultAgent, setSelectedResultAgent] = useState("ACO");

  const [currentRun, setCurrentRun] = useState<OrchestratorRun | null>(null);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [allOutputs, setAllOutputs] = useState<AgentOutput[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const projectId = activeProject?.id || null;
  const project = activeProject as unknown as Record<string, unknown> | null;

  // Load chat history for ACO
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

  // Load existing run and outputs
  const loadRunAndOutputs = useCallback(async () => {
    if (!projectId) return;

    const [runsRes, outputsRes] = await Promise.all([
      supabase.from("orchestrator_runs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
      supabase.from("agent_outputs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

    if (outputsRes.data) setAllOutputs(outputsRes.data as AgentOutput[]);

    if (runsRes.data) {
      const run = runsRes.data as OrchestratorRun;
      setCurrentRun(run);
      if (run.status === "completed") {
        setPhase("results");
      } else if (run.status === "running") {
        setPhase("running");
      }
    }
  }, [projectId]);

  useEffect(() => { loadRunAndOutputs(); }, [loadRunAndOutputs]);

  // Real-time updates
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`orchestrator-${projectId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orchestrator_runs",
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        if (payload.new) {
          const run = payload.new as OrchestratorRun;
          setCurrentRun(run);
          if (run.status === "completed") {
            setPhase("results");
            loadRunAndOutputs();
            toast({ title: "🎉 Plano pronto!", description: "Seu plano completo foi compilado com sucesso." });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, loadRunAndOutputs, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save chat messages
  useEffect(() => {
    if (isChatLoading || !projectId || messages.length < 2) return;
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
  }, [isChatLoading, messages, projectId]);

  const handleStartForge = async () => {
    if (!bigIdea.trim()) {
      toast({ title: "Descreva sua BIG IDEA", description: "Digite sua ideia de negócio para continuar.", variant: "destructive" });
      return;
    }
    if (!projectId) {
      toast({ title: "Selecione um projeto", description: "É necessário ter um projeto ativo.", variant: "destructive" });
      return;
    }
    setPhase("chat");
    // Iniciar chat com ACO para coletar informações
    clearMessages();
    const prompt = `Tenho uma BIG IDEA que quero forjar em um negócio completo: "${bigIdea}"\n\nFaça as perguntas necessárias para coletar todas as informações antes de acionar os agentes. Preciso de: nicho, público-alvo, tipo de produto, faixa de preço, diferencial, estágio do negócio, objetivo principal e orçamento disponível. Faça no máximo 5 perguntas diretas e objetivas.`;
    sendMessage(prompt, "ACO", projectId, project || undefined);
  };

  const handleStartOrchestration = async () => {
    if (!projectId || !user) return;
    setIsStartingRun(true);

    try {
      // Extrair dados coletados do chat
      const chatSummary = messages
        .filter(m => m.role === "assistant")
        .map(m => m.content)
        .join("\n");

      // Criar o run
      const { data: run, error } = await supabase.from("orchestrator_runs").insert({
        project_id: projectId,
        big_idea: bigIdea,
        collected_data: { chat_summary: chatSummary, big_idea: bigIdea },
        status: "running",
        current_step: 0,
        total_steps: AGENT_EXECUTION_FLOW.length,
      }).select().single();

      if (error || !run) throw error || new Error("Falha ao criar run");

      setCurrentRun(run as OrchestratorRun);
      setPhase("running");

      // Chamar edge function de orquestração
      fetch(`${SUPABASE_URL}/functions/v1/orchestrator-run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ run_id: run.id, action: "start" }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          toast({ title: "Erro na orquestração", description: err.error || "Tente novamente.", variant: "destructive" });
          await supabase.from("orchestrator_runs").update({ status: "error" }).eq("id", run.id);
          setPhase("chat");
        }
      }).catch(() => {
        toast({ title: "Erro de conexão", description: "Verifique sua internet e tente novamente.", variant: "destructive" });
        setPhase("chat");
      });

    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível iniciar a orquestração.", variant: "destructive" });
    } finally {
      setIsStartingRun(false);
    }
  };

  const handleCancelRun = async () => {
    if (!currentRun) return;
    await fetch(`${SUPABASE_URL}/functions/v1/orchestrator-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ run_id: currentRun.id, action: "cancel" }),
    });
    setPhase("entry");
    setCurrentRun(null);
  };

  const handleApproveAll = async () => {
    if (!projectId) return;
    const orchestratorOutputs = allOutputs.filter(o =>
      o.output_type === "orchestrator_draft" || o.output_type === "master_plan"
    );

    for (const output of orchestratorOutputs) {
      await supabase.from("agent_outputs").update({ is_approved: true }).eq("id", output.id);
    }
    await loadRunAndOutputs();
    toast({ title: "✅ Todos aprovados!", description: "Outputs disponíveis para os agentes." });
  };

  const handleExportAll = async () => {
    if (!currentRun || !user) return;
    const results = currentRun.agent_results || {};
    let markdown = `# Plano Completo do Negócio\n\n**BIG IDEA:** ${currentRun.big_idea}\n\n**Gerado em:** ${new Date().toLocaleDateString("pt-BR")}\n\n---\n\n`;

    for (const { agent, label } of AGENT_EXECUTION_FLOW) {
      const content = results[agent];
      const agentConfig = AGENTS_CONFIG[agent as AgentCode];
      markdown += `## ${agentConfig?.fullName || agent}\n\n`;
      markdown += content ? content : "_Não processado_";
      markdown += "\n\n---\n\n";
    }

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plano-completo-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);

    // Upload storage
    const fileName = `${user.id}/plano-${currentRun.id}.md`;
    await supabase.storage.from("exports").upload(fileName, blob, { upsert: true });
    toast({ title: "📄 Exportado!", description: "Plano completo baixado com sucesso." });
  };

  const handleSendChat = () => {
    if (!input.trim() || isChatLoading || !projectId) return;
    sendMessage(input.trim(), "ACO", projectId, project || undefined);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (!currentRun) return "pending";
    const currentStep = currentRun.current_step;
    const agent = AGENT_EXECUTION_FLOW[stepIndex].agent;
    const hasResult = currentRun.agent_results?.[agent];
    if (hasResult) return "done";
    if (stepIndex === currentStep && currentRun.status === "running") return "running";
    return "pending";
  };

  const progressPercent = currentRun
    ? Math.round((currentRun.current_step / currentRun.total_steps) * 100)
    : 0;

  const resultAgents = [...AGENT_EXECUTION_FLOW];
  const selectedResult = currentRun?.agent_results?.[selectedResultAgent];

  // ──────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-display font-semibold text-sm">Orquestrador Central — ACO</h1>
            <p className="text-xs text-muted-foreground">
              {activeProject?.name || "Selecione um projeto"} · Porta de entrada do negócio
            </p>
          </div>
          <div className="flex gap-2">
            {phase === "results" && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportAll} className="text-xs">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar
                </Button>
                <Button size="sm" onClick={() => { setPhase("entry"); setBigIdea(""); clearMessages(); }} className="text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Nova Forja
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">

        {/* ─── FASE 1: ENTRADA / BIG IDEA ─── */}
        {phase === "entry" && (
          <motion.div
            key="entry"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-3xl space-y-8">
              {/* Hero */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  FORJA.AI — Orquestrador Inteligente
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold">
                  Qual é a sua <span className="gradient-text">BIG IDEA</span>?
                </h2>
                <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                  Descreva sua grande ideia de negócio, produto ou serviço. O ACO vai coletar as informações necessárias e acionar todos os agentes automaticamente.
                </p>
              </div>

              {/* Input BIG IDEA */}
              <div className="glass rounded-2xl p-6 space-y-4">
                <Textarea
                  value={bigIdea}
                  onChange={(e) => setBigIdea(e.target.value)}
                  placeholder='Ex: "Quero criar um curso online de fotografia para iniciantes que querem monetizar no Instagram. Tenho 5 anos de experiência como fotógrafo profissional..."'
                  className="min-h-[140px] text-sm bg-secondary/30 resize-none border-0 focus-visible:ring-0 p-0"
                  maxLength={2000}
                />
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">{bigIdea.length}/2000</span>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => { setPhase("chat"); clearMessages(); }}
                      className="text-xs"
                    >
                      <Brain className="w-3.5 h-3.5 mr-1.5" />
                      Chat livre com ACO
                    </Button>
                    <Button
                      onClick={handleStartForge}
                      disabled={!bigIdea.trim() || !projectId}
                      className="gradient-primary text-primary-foreground font-semibold text-xs px-6"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      FORJAR MEU NEGÓCIO
                    </Button>
                  </div>
                </div>
              </div>

              {/* Separador + Acesso Individual */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-xs text-muted-foreground">ou acesse os agentes individualmente</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.values(AGENTS_CONFIG).filter(a => a.code !== "ACO").map((agent) => {
                    const Icon = agent.icon;
                    const deps = ("dependencies" in agent ? agent.dependencies as string[] : []);
                    const hasAll = deps.every(dep =>
                      allOutputs.some(o => o.agent_name === dep && o.is_approved)
                    );
                    const isLocked = deps.length > 0 && !hasAll;

                    return (
                      <motion.button
                        key={agent.code}
                        whileHover={!isLocked ? { scale: 1.02 } : {}}
                        onClick={() => !isLocked && navigate(`/agent/${agent.code}`)}
                        className={`glass rounded-xl p-3 text-left transition-all ${
                          isLocked ? "opacity-50 cursor-not-allowed" : "glass-hover cursor-pointer"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center mb-2`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="text-xs font-mono font-bold text-muted-foreground">{agent.code}</div>
                        <div className="text-xs font-medium truncate">{agent.name}</div>
                        {isLocked ? (
                          <div className="text-[10px] text-muted-foreground mt-1">🔒 Aguardando deps.</div>
                        ) : (
                          <div className="text-[10px] text-green-400 mt-1">✓ Disponível</div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {currentRun?.status === "completed" && (
                  <div className="glass rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      <div>
                        <div className="text-sm font-semibold">Plano anterior disponível</div>
                        <div className="text-xs text-muted-foreground">
                          Forjado em {new Date(currentRun.started_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setPhase("results")}>
                      <Eye className="w-3.5 h-3.5 mr-1.5" /> Ver Plano
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── FASE 2: CHAT COM ACO (coleta de info) ─── */}
        {phase === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col"
          >
            {/* Sub-header */}
            <div className="px-4 py-2.5 border-b border-border bg-secondary/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Brain className="w-3.5 h-3.5 text-primary" />
                <span>ACO está coletando informações sobre sua BIG IDEA</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPhase("entry")}>
                  <ArrowLeft className="w-3 h-3 mr-1" /> Voltar
                </Button>
                {bigIdea && messages.length >= 2 && (
                  <Button size="sm" className="text-xs h-7 gradient-primary text-primary-foreground" onClick={handleStartOrchestration} disabled={isStartingRun}>
                    {isStartingRun ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                    Iniciar Forja
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
                        <Brain className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "glass"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground">
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
                {isChatLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <Brain className="w-4 h-4 text-white" />
                    </div>
                    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">ACO está pensando...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <div className="max-w-3xl mx-auto flex gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Responda as perguntas do ACO..."
                  className="flex-1 min-h-[44px] max-h-[120px] bg-secondary/50 resize-none text-sm"
                  rows={1}
                />
                <Button
                  onClick={handleSendChat}
                  disabled={!input.trim() || isChatLoading || !projectId}
                  className="gradient-primary text-primary-foreground h-[44px] px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {bigIdea && messages.length >= 4 && (
                <div className="max-w-3xl mx-auto mt-3 flex items-center justify-center">
                  <Button
                    onClick={handleStartOrchestration}
                    disabled={isStartingRun}
                    size="sm"
                    className="gradient-primary text-primary-foreground text-xs"
                  >
                    {isStartingRun ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                    Informações suficientes — Iniciar Forja dos 8 Agentes
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── FASE 3: EXECUTANDO ─── */}
        {phase === "running" && (
          <motion.div
            key="running"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex items-center justify-center p-6"
          >
            <div className="w-full max-w-2xl space-y-6">
              <div className="text-center space-y-2">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold"
                >
                  <Zap className="w-4 h-4" />
                  FORJANDO SEU NEGÓCIO...
                </motion.div>
                <p className="text-sm text-muted-foreground">
                  {currentRun?.big_idea?.slice(0, 80)}...
                </p>
              </div>

              {/* Progress bar */}
              <div className="glass rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Progresso</span>
                  <span className="font-bold text-primary">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-3" />
                <p className="text-xs text-muted-foreground text-center">
                  {currentRun?.current_step || 0} de {currentRun?.total_steps || 8} agentes concluídos
                </p>
              </div>

              {/* Agent steps */}
              <div className="space-y-2">
                {AGENT_EXECUTION_FLOW.map((step, i) => {
                  const status = getStepStatus(i);
                  const agentConfig = AGENTS_CONFIG[step.agent as AgentCode];
                  const Icon = agentConfig?.icon || Bot;

                  return (
                    <motion.div
                      key={step.agent}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`glass rounded-xl p-3 flex items-center gap-3 transition-all ${
                        status === "running" ? "border-primary/40 bg-primary/5" : ""
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        status === "done"
                          ? `bg-gradient-to-br ${agentConfig?.color || "from-gray-500 to-gray-600"}`
                          : status === "running"
                          ? "bg-primary/20"
                          : "bg-secondary"
                      }`}>
                        {status === "running" ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : status === "done" ? (
                          <Icon className="w-4 h-4 text-white" />
                        ) : (
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-muted-foreground">{step.agent}</span>
                          <span className="text-xs font-medium truncate">
                            {status === "running" ? step.label : agentConfig?.name || step.agent}
                          </span>
                        </div>
                        {status === "running" && (
                          <div className="text-[10px] text-primary mt-0.5 animate-pulse">Em processamento...</div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {status === "done" && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        {status === "running" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                        {status === "pending" && <Clock className="w-4 h-4 text-muted-foreground/40" />}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={handleCancelRun} className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Square className="w-3 h-3 mr-1.5" /> Cancelar Forja
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── FASE 4: RESULTADOS ─── */}
        {phase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col"
          >
            {/* Results header */}
            <div className="px-4 py-3 border-b border-border bg-green-500/5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">🎉 Plano completo gerado!</div>
                <div className="text-xs text-muted-foreground truncate">
                  {currentRun?.big_idea?.slice(0, 80)}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={handleApproveAll} className="text-xs h-7">
                  <Check className="w-3 h-3 mr-1" /> Aprovar Tudo
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportAll} className="text-xs h-7">
                  <Download className="w-3 h-3 mr-1" /> Exportar
                </Button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar com agentes */}
              <div className="w-56 border-r border-border flex-shrink-0 overflow-y-auto p-2 space-y-1">
                {resultAgents.map(({ agent }) => {
                  const agentConfig = AGENTS_CONFIG[agent as AgentCode];
                  const Icon = agentConfig?.icon || Bot;
                  const hasResult = !!currentRun?.agent_results?.[agent];
                  const isSelected = selectedResultAgent === agent;

                  return (
                    <button
                      key={agent}
                      onClick={() => setSelectedResultAgent(agent)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-xs ${
                        isSelected
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "hover:bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${agentConfig?.color || "from-gray-500 to-gray-600"} flex items-center justify-center shrink-0`}>
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      <span className="truncate font-medium">{agentConfig?.name || agent}</span>
                      {hasResult && <CheckCircle2 className="w-3 h-3 text-green-400 ml-auto shrink-0" />}
                    </button>
                  );
                })}

                <div className="border-t border-border pt-2 mt-2">
                  <button
                    onClick={() => navigate(`/agent/${selectedResultAgent}`)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Editar individualmente
                  </button>
                </div>
              </div>

              {/* Conteúdo do resultado */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedResult ? (
                  <div className="max-w-4xl">
                    <div className="flex items-center gap-3 mb-4">
                      {(() => {
                        const agentConfig = AGENTS_CONFIG[selectedResultAgent as AgentCode];
                        const Icon = agentConfig?.icon || Bot;
                        return (
                          <>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agentConfig?.color || "from-gray-500 to-gray-600"} flex items-center justify-center`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-display font-semibold">{agentConfig?.fullName || selectedResultAgent}</h3>
                              <p className="text-xs text-muted-foreground">{agentConfig?.description || ""}</p>
                            </div>
                          </>
                        );
                      })()}
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto text-xs"
                        onClick={() => navigate(`/agent/${selectedResultAgent}`)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Refinar com o Agente
                      </Button>
                    </div>
                    <div className="glass rounded-xl p-6">
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3 [&_h1]:text-foreground [&_h2]:text-foreground [&_h2]:text-lg [&_h3]:text-foreground [&_strong]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_table]:w-full [&_th]:text-foreground [&_td]:border-border [&_th]:border-border">
                        <ReactMarkdown>{selectedResult}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Clock className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">Resultado do {selectedResultAgent} ainda não disponível.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default Orchestrator;
