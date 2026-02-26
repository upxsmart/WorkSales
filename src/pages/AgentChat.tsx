import { useState, useEffect, useRef, useCallback, ImgHTMLAttributes } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAgentChat, type Message, type AgentDemand, extractDemands } from "@/hooks/useAgentChat";
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
  ImageIcon, Sparkles, ExternalLink, ArrowRightLeft, ImagePlay,
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

/** Renders an image with a broken-image placeholder fallback */
function ImageWithFallback({ src, alt, className }: ImgHTMLAttributes<HTMLImageElement>) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className={`${className} flex flex-col items-center justify-center gap-2 min-h-[180px] bg-muted/50 text-muted-foreground`}>
        <ImageIcon className="w-8 h-8 opacity-40" />
        <span className="text-xs text-center px-4">Não foi possível exibir a imagem.<br />Use o botão Baixar para obtê-la.</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
    />
  );
}

const AgentChat = () => {
  const { agentCode } = useParams<{ agentCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
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

  // AC-DC / AG-IMG: creative format selector
  const [selectedFormat, setSelectedFormat] = useState<CreativeFormat>(CREATIVE_FORMATS[1]);
  // AG-IMG: number of image variations to generate at once
  const [imageCount, setImageCount] = useState<1 | 2 | 4>(1);
  // true when AG-IMG was opened with a pre-filled briefing from AC-DC
  const [fromAcDc, setFromAcDc] = useState(false);

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

  // Save messages after assistant finishes + auto-save image outputs to gallery
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

        // Save chat messages (fire-and-forget, no Promise.all — PostgrestBuilder isn't a native Promise)
        void supabase.from("chat_messages").insert({
          project_id: projectId,
          agent_name: agentCode,
          role: "user",
          content: userMsg.content,
        });
        void supabase.from("chat_messages").insert({
          project_id: projectId,
          agent_name: agentCode,
          role: "assistant",
          content: assistantContent,
        });

        // Auto-save images to agent_outputs (approved) so they appear in the gallery
        if (lastMsg.images && lastMsg.images.length > 0 && (agentCode === "AG-IMG" || agentCode === "AC-DC")) {
          const formatLabel = selectedFormat?.label || "Criativo";
          void supabase.from("agent_outputs").insert({
            project_id: projectId,
            agent_name: agentCode,
            output_type: "image",
            title: `${agentCode} · ${formatLabel} · ${new Date().toLocaleDateString("pt-BR")}`,
            output_data: {
              images: lastMsg.images,
              text: lastMsg.content,
              format: selectedFormat,
              prompt: userMsg.content,
            },
            is_approved: false,
            version: outputs.length + 1,
          }).select().then(async () => {
            // Save as draft — user approves manually from history panel
            await reloadOutputs();
          });
        }
      }
    }
  }, [isLoading, messages, projectId, agentCode, selectedFormat, outputs.length]);

  // Save AT-GP demands found in response to agent_demands table
  const handleDemandsFound = useCallback(async (demands: AgentDemand[], _fullText: string) => {
    if (!projectId || !agentCode) return;

    const inserts = demands.map((d) => ({
      project_id: projectId,
      from_agent: agentCode,
      to_agent: d.agent_target,
      demand_type: d.demand_type || "optimization",
      reason: d.reason,
      suggestion: d.suggestion || "",
      priority: d.priority || "medium",
      status: "pending",
    }));

    const { error } = await supabase.from("agent_demands").insert(inserts);
    if (!error) {
      toast({
        title: `📋 ${demands.length} demanda${demands.length > 1 ? "s" : ""} gerada${demands.length > 1 ? "s" : ""}`,
        description: `AT-GP enviou solicitações para: ${[...new Set(demands.map(d => d.agent_target))].join(", ")}`,
        duration: 6000,
      });
    } else {
      console.error("Erro ao salvar demandas:", error);
    }
  }, [projectId, agentCode, toast]);

  const handleSend = () => {
    if (!input.trim() || isLoading || !agentCode) return;
    // For image agents, append format context to the prompt
    const isImageAgent = agentCode === "AC-DC" || agentCode === "AG-IMG";
    const messageToSend = isImageAgent
      ? `${input.trim()}\n\n[Formato: ${selectedFormat.label} (${selectedFormat.ratio}) — ${selectedFormat.dimensions}]`
      : input.trim();
    sendMessage(
      messageToSend,
      agentCode,
      projectId || undefined,
      project || undefined,
      agentCode === "AT-GP" ? handleDemandsFound : undefined,
      isImageAgent ? imageCount : undefined
    );
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

  const reloadOutputs = useCallback(async () => {
    if (!projectId || !agentCode) return;
    const { data } = await supabase
      .from("agent_outputs")
      .select("*")
      .eq("project_id", projectId)
      .eq("agent_name", agentCode)
      .order("created_at", { ascending: false });
    if (data) setOutputs(data as AgentOutput[]);
  }, [projectId, agentCode]);

  /** Save output as draft (is_approved = false) — user must explicitly approve later */
  const handleSaveOutput = useCallback(async (content: string) => {
    if (!projectId || !agentCode) return;
    const { error } = await supabase.from("agent_outputs").insert({
      project_id: projectId,
      agent_name: agentCode,
      output_type: "general",
      title: `Output ${agentCode}`,
      output_data: { content },
      is_approved: false,
      version: outputs.length + 1,
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível salvar o output.", variant: "destructive" });
    } else {
      toast({ title: "Output salvo! 💾", description: "Clique em 'Aprovar' no histórico para disponibilizá-lo aos outros agentes." });
      await reloadOutputs();
    }
  }, [projectId, agentCode, outputs.length, toast, reloadOutputs]);

  /** Approve an existing output by ID via secure RPC */
  const handleApproveById = useCallback(async (outputId: string) => {
    const { error } = await supabase.rpc("approve_agent_output", { _output_id: outputId });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível aprovar o output.", variant: "destructive" });
    } else {
      toast({ title: "Output aprovado! ✅", description: "Disponível para outros agentes." });
      await reloadOutputs();
      // Reload shared outputs too
      if (projectId) {
        const { data } = await supabase
          .from("agent_outputs")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_approved", true)
          .order("created_at", { ascending: false });
        if (data) setAllOutputs(data as AgentOutput[]);
      }
    }
  }, [toast, reloadOutputs, projectId]);

  const handleRefine = useCallback((content: string) => {
    setInput(`Refine e melhore o seguinte output:\n\n${content.slice(0, 500)}...`);
  }, []);

  /** Regenera a última imagem usando o mesmo prompt do usuário anterior à mensagem i */
  const handleRegenerate = useCallback((msgIndex: number) => {
    if (isLoading || !agentCode) return;
    // Find the user message right before this assistant message
    const userMsg = messages
      .slice(0, msgIndex)
      .filter(m => m.role === "user")
      .pop();
    if (!userMsg) return;
    sendMessage(
      userMsg.content,
      agentCode,
      projectId || undefined,
      project || undefined,
      undefined,
      imageCount
    );
  }, [isLoading, agentCode, messages, sendMessage, projectId, project, imageCount]);

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
    if (!projectId || !agentCode) return;
    const newVersion = outputs.length + 1;
    const { error } = await supabase.from("agent_outputs").insert({
      project_id: projectId,
      agent_name: agentCode,
      output_type: output.output_type,
      title: `${output.title} (revertido)`,
      output_data: { content },
      is_approved: false,
      version: newVersion,
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível reverter.", variant: "destructive" });
    } else {
      toast({ title: "Revertido! ↩️", description: `Versão ${output.version} restaurada como v${newVersion}. Aprove no histórico para ativar.` });
      await reloadOutputs();
    }
  }, [projectId, agentCode, outputs.length, toast, reloadOutputs]);

  // Pré-preenche o input quando chegado via navegação com state (ex: AC-DC → AG-IMG)
  useEffect(() => {
    const state = location.state as { prefillInput?: string } | null;
    if (state?.prefillInput) {
      setInput(state.prefillInput);
      setFromAcDc(true);
      // Limpa o state para não repreencher ao navegar de volta
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  /** Navega para o AG-IMG pré-preenchendo o input com o texto limpo do último output do AC-DC */
  const handleSendToAgImg = useCallback((content: string) => {
    // content pode ser JSON { text, images } — extrair só o texto do briefing
    let briefing = content;
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed?.text === "string") briefing = parsed.text;
    } catch { /* texto puro, usa como está */ }
    navigate(`/agent/AG-IMG`, { state: { prefillInput: briefing } });
  }, [navigate]);

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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-semibold text-sm">{agent.fullName}</h1>
              {/* Chip: shown only on AG-IMG when opened from AC-DC */}
              {agentCode === "AG-IMG" && fromAcDc && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, x: -6 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-medium shrink-0"
                >
                   <ArrowRightLeft className="w-3 h-3" />
                   Briefing recebido do Pixel
                </motion.div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {agent.code} · {agentCode === "AC-DC" ? "Banana Pro · Geração de Imagens" : agentCode === "AG-IMG" ? "Nano Banana HD · Creator de Imagens" : "Gemini 3 Flash"}
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
                        {/* Generated images (AC-DC / AG-IMG) */}
                        {msg.images && msg.images.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Sparkles className="w-3 h-3 text-primary" />
                              <span>
                                {agentCode === "AG-IMG" ? "Criativo gerado com Nano Banana HD" : "Criativo gerado com Banana Pro"}
                              </span>
                              {/* Badge when any image is base64 (storage fallback) */}
                              {msg.images.some(u => u.startsWith("data:")) && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                  Pré-visualização local
                                </span>
                              )}
                            </div>
                            <div className={`grid gap-2 ${msg.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                              {msg.images.map((url, imgIdx) => {
                                const isBase64 = url.startsWith("data:");
                                return (
                                  <AnimatePresence key={imgIdx}>
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      className="relative group rounded-xl overflow-hidden border border-border"
                                    >
                                      <ImageWithFallback
                                        src={url}
                                        alt={`Criativo ${imgIdx + 1}`}
                                        className="w-full object-cover"
                                      />
                                       {/* Download + Regenerar overlay */}
                                       <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                         {isBase64 ? (
                                           <button
                                             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               const [header, data] = url.split(",");
                                               const mime = header.match(/:(.*?);/)?.[1] || "image/png";
                                               const binary = atob(data);
                                               const arr = new Uint8Array(binary.length);
                                               for (let j = 0; j < binary.length; j++) arr[j] = binary.charCodeAt(j);
                                               const blob = new Blob([arr], { type: mime });
                                               const blobUrl = URL.createObjectURL(blob);
                                               const a = document.createElement("a");
                                               a.href = blobUrl;
                                               a.download = `criativo-${agentCode}-${imgIdx + 1}.png`;
                                               a.click();
                                               URL.revokeObjectURL(blobUrl);
                                             }}
                                           >
                                             <Download className="w-3 h-3" />
                                             Baixar
                                           </button>
                                         ) : (
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
                                         )}
                                         {/* Regenerar — only on last assistant message */}
                                         {i === messages.length - 1 && (agentCode === "AG-IMG" || agentCode === "AC-DC") && (
                                           <button
                                             disabled={isLoading}
                                             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium disabled:opacity-50"
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               handleRegenerate(i);
                                             }}
                                             title="Gerar nova variação com o mesmo prompt"
                                           >
                                             <RefreshCw className="w-3 h-3" />
                                             Regenerar
                                           </button>
                                         )}
                                       </div>
                                    </motion.div>
                                  </AnimatePresence>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                     {msg.role === "assistant" && !isLoading && i === messages.length - 1 && i > 0 && (
                       <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                         {/* Regenerar — only for image agents with images */}
                         {(agentCode === "AG-IMG" || agentCode === "AC-DC") && msg.images && msg.images.length > 0 ? (
                           <Button
                             size="sm"
                             variant="ghost"
                             className="text-xs h-7 text-primary/80 hover:text-primary hover:bg-primary/10"
                             disabled={isLoading}
                             onClick={() => handleRegenerate(i)}
                             title="Gerar nova variação com o mesmo prompt"
                           >
                             <RefreshCw className="w-3 h-3 mr-1" />
                             Regenerar
                           </Button>
                         ) : (
                           <>
                             <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleSaveOutput(msg.content)}>
                                <Check className="w-3 h-3 mr-1" /> Salvar
                             </Button>
                             <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleRefine(msg.content)}>
                               <RefreshCw className="w-3 h-3 mr-1" /> Refinar
                             </Button>
                             <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleExport(msg.content)}>
                               <Download className="w-3 h-3 mr-1" /> Exportar
                             </Button>
                           </>
                         )}
                         {agentCode === "AC-DC" && (
                           <Button
                             size="sm"
                             variant="ghost"
                             className="text-xs h-7 text-primary/70 hover:text-primary hover:bg-primary/10"
                             onClick={() => handleSendToAgImg(msg.content)}
                              title="Abre o Canvas com este briefing pré-preenchido"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Enviar para Canvas
                           </Button>
                         )}
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

              {/* Typing indicator — shown before first token arrives */}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0`}>
                    <AgentIcon className="w-4 h-4 text-white" />
                  </div>
                  {agentCode === "AG-IMG" ? (
                    <div className="glass rounded-2xl px-5 py-4 flex flex-col gap-3 min-w-[260px]">
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 shrink-0">
                          <ImagePlay className="w-4 h-4 text-white" />
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground leading-tight">Canvas está gerando seu criativo...</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Google Gemini Image · Alta definição</p>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                          initial={{ x: "-100%" }}
                          animate={{ x: "100%" }}
                          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                        />
                      </div>
                      <div className={`grid gap-2 ${imageCount > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                        {Array.from({ length: imageCount }).map((_, k) => (
                          <div key={k} className="rounded-lg overflow-hidden aspect-square bg-muted/60 relative">
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                              initial={{ x: "-100%" }}
                              animate={{ x: "100%" }}
                              transition={{ repeat: Infinity, duration: 1.2, delay: k * 0.2, ease: "linear" }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : agentCode === "AC-DC" ? (
                    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 animate-pulse text-primary" />
                      <span className="text-xs text-muted-foreground">Pixel está criando seu visual...</span>
                    </div>
                  ) : (
                    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0`}>
                        <AgentIcon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs text-muted-foreground">{agent.name} está pensando</span>
                      <motion.div className="flex gap-0.5 ml-1">
                        {[0, 1, 2].map((dot) => (
                          <motion.span
                            key={dot}
                            className="w-1.5 h-1.5 rounded-full bg-primary/60"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, delay: dot * 0.2, repeat: Infinity }}
                          />
                        ))}
                      </motion.div>
                    </div>
                  )}
                </motion.div>
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
              {/* Format + Variations selector — image agents only */}
              {(agentCode === "AC-DC" || agentCode === "AG-IMG") && (
                <div className="flex flex-wrap items-center gap-3">
                  {/* Format picker */}
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
                    <span className="text-xs text-muted-foreground hidden sm:block">{selectedFormat.dimensions}</span>
                  </div>

                  {/* Divider */}
                  <div className="h-4 w-px bg-border hidden sm:block" />

                  {/* Variations picker — AG-IMG only */}
                  {agentCode === "AG-IMG" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Variações:</span>
                      <div className="flex gap-1">
                        {([1, 2, 4] as const).map((n) => (
                          <button
                            key={n}
                            onClick={() => setImageCount(n)}
                            className={`w-8 h-7 rounded-lg border text-xs font-semibold transition-colors ${
                              imageCount === n
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                          >
                            {n}×
                          </button>
                        ))}
                      </div>
                      {imageCount > 1 && (
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {imageCount} criativos serão gerados em paralelo
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    agentCode === "AG-IMG"
                      ? `Cole o briefing do AC-DC ou descreva o criativo ${selectedFormat.label} (${selectedFormat.ratio})...`
                      : agentCode === "AC-DC"
                      ? `Descreva o criativo ${selectedFormat.label} (${selectedFormat.ratio}) que deseja gerar...`
                      : "Digite sua mensagem..."
                  }
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
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleSaveOutput(lastAssistantMsg.content)}>
                        <Check className="w-3 h-3 mr-1" /> Salvar
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
                        <span>Banana Pro · {lastAssistantMsg.images.length} criativo{lastAssistantMsg.images.length > 1 ? "s" : ""}</span>
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
                  <p className="text-sm">Nenhum output salvo ainda.</p>
                  <p className="text-xs mt-1">Salve outputs do chat e aprove-os aqui para compartilhar com outros agentes.</p>
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
                          {out.is_approved ? (
                            <span className="text-xs text-primary flex items-center gap-1">
                              <Check className="w-3 h-3" /> Aprovado
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" className="text-xs h-6 px-2 border-primary/50 text-primary hover:bg-primary/10" onClick={() => handleApproveById(out.id)}>
                              <Check className="w-3 h-3 mr-1" /> Aprovar
                            </Button>
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
