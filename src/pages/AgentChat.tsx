import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAgentChat, type Message } from "@/hooks/useAgentChat";
import { AGENTS_CONFIG, AgentCode } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import MetaAdsConnect from "@/components/MetaAdsConnect";
import {
  ArrowLeft, Send, Loader2, Trash2, User, Bot,
  Check, RefreshCw, Download, Share2, Clock, RotateCcw,
  ImageIcon, Sparkles,
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

type CreativeFormat = { id: string; label: string; ratio: string; dimensions: string };

const CREATIVE_FORMATS: CreativeFormat[] = [
  { id: "story", label: "Story", ratio: "9:16", dimensions: "1080×1920px" },
  { id: "feed-square", label: "Feed", ratio: "1:1", dimensions: "1080×1080px" },
  { id: "feed-portrait", label: "Feed Portrait", ratio: "4:5", dimensions: "1080×1350px" },
  { id: "banner", label: "Banner", ratio: "16:9", dimensions: "1200×628px" },
];

const AgentChat = () => {
  const { agentCode } = useParams<{ agentCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, clearMessages, setMessages } = useAgentChat();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const { activeProject } = useActiveProject();
  const project = activeProject as unknown as Record<string, unknown> | null;
  const projectId = activeProject?.id || null;
  const [outputs, setOutputs] = useState<AgentOutput[]>([]);
  const [allOutputs, setAllOutputs] = useState<AgentOutput[]>([]);
  const [hasAutoGreeted, setHasAutoGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AC-DC: creative format selector
  const [selectedFormat, setSelectedFormat] = useState<CreativeFormat>(CREATIVE_FORMATS[1]);

  const agent = agentCode && agentCode in AGENTS_CONFIG
    ? AGENTS_CONFIG[agentCode as AgentCode]
    : null;
  const AgentIcon = agent?.icon || Bot;

  // Load chat history + outputs when project loads
  useEffect(() => {
    if (!projectId || !agentCode) return;

    supabase
      .from("chat_messages")
      .select("role, content")
      .eq("project_id", projectId)
      .eq("agent_name", agentCode)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(
            data.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
          setHasAutoGreeted(true);
        }
      });

    // Load agent outputs
    supabase
      .from("agent_outputs")
      .select("*")
      .eq("project_id", projectId)
      .eq("agent_name", agentCode)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setOutputs(data as AgentOutput[]);
      });

    // Load all outputs for sharing
    supabase
      .from("agent_outputs")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setAllOutputs(data as AgentOutput[]);
      });
  }, [projectId, agentCode, setMessages]);

  // Auto-greet: agent starts the conversation
  useEffect(() => {
    if (!agent || hasAutoGreeted || messages.length > 0) return;
    setHasAutoGreeted(true);
    setMessages([{ role: "assistant", content: agent.greeting }]);
  }, [agent, hasAutoGreeted, messages.length, setMessages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages after assistant finishes
  useEffect(() => {
    if (isLoading || !projectId || !agentCode || messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "assistant") {
      const userMsg = messages[messages.length - 2];
      if (userMsg?.role === "user") {
        // For image messages, store image URLs as JSON in content
        const assistantContent = lastMsg.images?.length
          ? JSON.stringify({ text: lastMsg.content, images: lastMsg.images })
          : lastMsg.content;
        Promise.all([
          supabase.from("chat_messages").insert({
            project_id: projectId,
            agent_name: agentCode,
            role: "user",
            content: userMsg.content,
          }),
          supabase.from("chat_messages").insert({
            project_id: projectId,
            agent_name: agentCode,
            role: "assistant",
            content: assistantContent,
          }),
        ]);
      }
    }
  }, [isLoading, messages, projectId, agentCode]);

  const handleSend = () => {
    if (!input.trim() || isLoading || !agentCode) return;
    // For AC-DC, append format context to the prompt
    const messageToSend = agentCode === "AC-DC"
      ? `${input.trim()}\n\n[Formato: ${selectedFormat.label} (${selectedFormat.ratio}) — ${selectedFormat.dimensions}]`
      : input.trim();
    sendMessage(messageToSend, agentCode, projectId || undefined, project || undefined);
    setInput("");
  };

  const handleClear = async () => {
    if (projectId && agentCode) {
      await supabase
        .from("chat_messages")
        .delete()
        .eq("project_id", projectId)
        .eq("agent_name", agentCode);
    }
    clearMessages();
    setHasAutoGreeted(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApproveOutput = useCallback(async (content: string) => {
    if (!projectId || !agentCode) return;
    const { error } = await supabase.from("agent_outputs").insert({
      project_id: projectId,
      agent_name: agentCode,
      output_type: "general",
      title: `Output ${agentCode}`,
      output_data: { content },
      is_approved: true,
      version: outputs.length + 1,
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível salvar o output.", variant: "destructive" });
    } else {
      toast({ title: "Output aprovado! ✅", description: "Disponível para outros agentes." });
      // Reload outputs
      const { data } = await supabase
        .from("agent_outputs")
        .select("*")
        .eq("project_id", projectId)
        .eq("agent_name", agentCode)
        .order("created_at", { ascending: false });
      if (data) setOutputs(data as AgentOutput[]);
    }
  }, [projectId, agentCode, outputs.length, toast]);

  const handleRefine = useCallback((content: string) => {
    setInput(`Refine e melhore o seguinte output:\n\n${content.slice(0, 500)}...`);
  }, []);

  const handleExport = useCallback((content: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agentCode}-output.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [agentCode]);

  const handleRevert = useCallback(async (output: AgentOutput) => {
    const content = typeof output.output_data === "object" && output.output_data !== null && "content" in (output.output_data as Record<string, unknown>)
      ? String((output.output_data as Record<string, unknown>).content)
      : JSON.stringify(output.output_data);
    // Create a new version based on this old one
    if (!projectId || !agentCode) return;
    const newVersion = outputs.length + 1;
    const { error } = await supabase.from("agent_outputs").insert({
      project_id: projectId,
      agent_name: agentCode,
      output_type: output.output_type,
      title: `${output.title} (revertido)`,
      output_data: { content },
      is_approved: true,
      version: newVersion,
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível reverter.", variant: "destructive" });
    } else {
      toast({ title: "Revertido! ↩️", description: `Versão ${output.version} restaurada como v${newVersion}.` });
      const { data } = await supabase.from("agent_outputs").select("*").eq("project_id", projectId).eq("agent_name", agentCode).order("created_at", { ascending: false });
      if (data) setOutputs(data as AgentOutput[]);
    }
  }, [projectId, agentCode, outputs.length, toast]);

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Agente não encontrado.</p>
      </div>
    );
  }

  // Get the last assistant message for output panel
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
            <AgentIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-display font-semibold text-sm">{agent.fullName}</h1>
            <p className="text-xs text-muted-foreground">
              {agent.code} · {agentCode === "AC-DC" ? "Nano Banana Pro · Geração de Imagens" : "Gemini 3 Flash"}
            </p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={handleClear} title="Limpar conversa">
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </header>

      {/* Split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Chat (60%) */}
        <div className="w-full lg:w-[60%] flex flex-col border-r border-border">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0 mt-1`}>
                      <AgentIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "glass"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="space-y-3">
                        {/* Text content */}
                        {msg.content && (
                          <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_table]:text-muted-foreground [&_th]:text-foreground [&_td]:border-border [&_th]:border-border">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                        {/* Generated images (AC-DC) */}
                        {msg.images && msg.images.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Sparkles className="w-3 h-3 text-primary" />
                              <span>Criativo gerado com Nano Banana Pro</span>
                            </div>
                            <div className={`grid gap-2 ${msg.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                              {msg.images.map((url, imgIdx) => (
                                <AnimatePresence key={imgIdx}>
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative group rounded-xl overflow-hidden border border-border"
                                  >
                                    <img
                                      src={url}
                                      alt={`Criativo ${imgIdx + 1}`}
                                      className="w-full object-cover"
                                    />
                                    {/* Download overlay */}
                                    <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <a
                                        href={url}
                                        download={`criativo-${agentCode}-${imgIdx + 1}.png`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Download className="w-3 h-3" />
                                        Baixar
                                      </a>
                                    </div>
                                  </motion.div>
                                </AnimatePresence>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.role === "assistant" && !isLoading && i === messages.length - 1 && i > 0 && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleApproveOutput(msg.content)}>
                          <Check className="w-3 h-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleRefine(msg.content)}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Refinar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleExport(msg.content)}>
                          <Download className="w-3 h-3 mr-1" /> Exportar
                        </Button>
                      </div>
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
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0`}>
                    <AgentIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2">
                    {agentCode === "AC-DC" ? (
                      <>
                        <ImageIcon className="w-4 h-4 animate-pulse text-primary" />
                        <span className="text-xs text-muted-foreground">Gerando criativo com Nano Banana Pro...</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Digitando...</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Suggestions (when only greeting) */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2">
              <div className="max-w-3xl mx-auto grid grid-cols-2 gap-2">
                {agent.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left p-2.5 rounded-xl border border-border hover:border-primary/50 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border bg-background/80 backdrop-blur-xl px-4 py-3">
            <div className="max-w-3xl mx-auto space-y-2">
              {/* Format selector — AC-DC only */}
              {agentCode === "AC-DC" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Formato:</span>
                  <div className="flex gap-1.5">
                    {CREATIVE_FORMATS.map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => setSelectedFormat(fmt)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                          selectedFormat.id === fmt.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {/* Tiny aspect ratio preview */}
                        <span className={`inline-block border border-current rounded-sm ${
                          fmt.id === "story" ? "w-2 h-3.5"
                          : fmt.id === "feed-square" ? "w-3 h-3"
                          : fmt.id === "feed-portrait" ? "w-2.5 h-3"
                          : "w-4 h-2.5"
                        }`} />
                        {fmt.label}
                        <span className="opacity-60">{fmt.ratio}</span>
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground ml-1 hidden sm:block">{selectedFormat.dimensions}</span>
                </div>
              )}
              <div className="flex gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={agentCode === "AC-DC" ? `Descreva o criativo ${selectedFormat.label} (${selectedFormat.ratio}) que deseja gerar...` : "Digite sua mensagem..."}
                  className="min-h-[44px] max-h-32 resize-none"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="gradient-primary text-primary-foreground glow-primary shrink-0"
                  size="icon"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Outputs (40%) */}
        <div className="hidden lg:flex lg:w-[40%] flex-col bg-card/20">
          <Tabs defaultValue="current" className="flex-1 flex flex-col">
            <div className="border-b border-border px-4 pt-3">
              <TabsList className="w-full bg-transparent h-auto p-0 gap-0">
                <TabsTrigger value="current" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 text-xs">
                  Resultado Atual
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 text-xs">
                  Histórico ({outputs.length})
                </TabsTrigger>
                {agentCode === "AT-GP" && (
                  <TabsTrigger value="meta" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 text-xs">
                    📊 Meta Ads
                  </TabsTrigger>
                )}
                <TabsTrigger value="shared" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 text-xs">
                  <Share2 className="w-3 h-3 mr-1" /> Outros Agentes
                </TabsTrigger>
              </TabsList>
            </div>


            <TabsContent value="current" className="flex-1 overflow-y-auto p-4 mt-0">
              {lastAssistantMsg ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold">Último Output</h3>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleApproveOutput(lastAssistantMsg.content)}>
                        <Check className="w-3 h-3 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleRefine(lastAssistantMsg.content)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Refinar
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleExport(lastAssistantMsg.content)}>
                        <Download className="w-3 h-3 mr-1" />
                      </Button>
                    </div>
                  </div>

                  {/* Image output panel for AC-DC */}
                  {lastAssistantMsg.images && lastAssistantMsg.images.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span>Nano Banana Pro · {lastAssistantMsg.images.length} criativo{lastAssistantMsg.images.length > 1 ? "s" : ""}</span>
                      </div>
                      <div className={`grid gap-3 ${lastAssistantMsg.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                        {lastAssistantMsg.images.map((url, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-border">
                            <img src={url} alt={`Criativo ${idx + 1}`} className="w-full object-cover" />
                            <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <a
                                href={url}
                                download={`criativo-${agentCode}-${idx + 1}.png`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                              >
                                <Download className="w-3 h-3" /> Baixar HD
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                      {lastAssistantMsg.content && (
                        <div className="glass rounded-xl p-3">
                          <p className="text-xs text-muted-foreground">{lastAssistantMsg.content}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass rounded-xl p-4">
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground">
                        <ReactMarkdown>{lastAssistantMsg.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  {agentCode === "AC-DC" ? (
                    <>
                      <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
                      <p className="text-sm">Descreva o criativo que deseja gerar.</p>
                      <p className="text-xs mt-1">A imagem aparecerá aqui em instantes.</p>
                    </>
                  ) : (
                    <>
                      <AgentIcon className="w-12 h-12 mb-3 opacity-20" />
                      <p className="text-sm">Converse com o agente para gerar outputs.</p>
                      <p className="text-xs mt-1">Os resultados aparecerão aqui em tempo real.</p>
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-y-auto p-4 mt-0">
              {outputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Clock className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">Nenhum output aprovado ainda.</p>
                  <p className="text-xs mt-1">Aprove outputs do chat para salvá-los aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {outputs.map((out) => (
                    <div key={out.id} className="glass rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-medium">{out.title || out.output_type}</span>
                          <span className="text-xs text-muted-foreground ml-2">v{out.version}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(out.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {out.is_approved && (
                            <span className="text-xs text-primary flex items-center gap-1">
                              <Check className="w-3 h-3" /> Aprovado
                            </span>
                          )}
                          <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => handleRevert(out)} title="Reverter para esta versão">
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none text-xs [&_p]:text-muted-foreground [&_li]:text-muted-foreground line-clamp-6">
                        <ReactMarkdown>
                          {typeof out.output_data === "object" && out.output_data !== null && "content" in (out.output_data as Record<string, unknown>)
                            ? String((out.output_data as Record<string, unknown>).content)
                            : JSON.stringify(out.output_data)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {agentCode === "AT-GP" && projectId && (
              <TabsContent value="meta" className="flex-1 overflow-y-auto p-4 mt-0">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display text-sm font-semibold mb-1">Conexão Meta Ads</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Conecte sua conta para que o AT-GP acesse dados reais de campanhas e crie anúncios automaticamente.
                    </p>
                    <MetaAdsConnect projectId={projectId} />
                  </div>
                  <div className="glass rounded-xl p-4">
                    <h4 className="text-xs font-semibold mb-2">📋 O AT-GP pode:</h4>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Analisar métricas reais (CPL, ROAS, CTR, CPC)</li>
                      <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Criar campanhas com status PAUSADO para revisão</li>
                      <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Gerar demandas para AM-CC, AC-DC baseadas em dados</li>
                      <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Identificar fadiga de criativo e oportunidades</li>
                      <li className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">⚠</span> Campanhas sempre criadas como PAUSADAS — você ativa manualmente</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="shared" className="flex-1 overflow-y-auto p-4 mt-0">
              {allOutputs.filter(o => o.agent_name !== agentCode).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Share2 className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">Nenhum output de outros agentes.</p>
                  <p className="text-xs mt-1">Aprove outputs em outros agentes para compartilhá-los.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allOutputs
                    .filter(o => o.agent_name !== agentCode)
                    .map((out) => {
                      const sourceAgent = out.agent_name in AGENTS_CONFIG
                        ? AGENTS_CONFIG[out.agent_name as AgentCode]
                        : null;
                      return (
                        <div key={out.id} className="glass rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {sourceAgent && (
                              <div className={`w-6 h-6 rounded bg-gradient-to-br ${sourceAgent.color} flex items-center justify-center`}>
                                <sourceAgent.icon className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <span className="text-xs font-medium">{sourceAgent?.name || out.agent_name}</span>
                            <span className="text-xs text-muted-foreground">· {out.title || out.output_type}</span>
                          </div>
                          <div className="prose prose-sm prose-invert max-w-none text-xs [&_p]:text-muted-foreground line-clamp-4">
                            <ReactMarkdown>
                              {typeof out.output_data === "object" && out.output_data !== null && "content" in (out.output_data as Record<string, unknown>)
                                ? String((out.output_data as Record<string, unknown>).content).slice(0, 300)
                                : JSON.stringify(out.output_data).slice(0, 300)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AgentChat;
