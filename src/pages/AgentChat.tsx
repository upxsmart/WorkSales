import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentChat } from "@/hooks/useAgentChat";
import { AGENTS_CONFIG, AgentCode } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Send, Loader2, Trash2, Bot, User,
  Users, Target, Workflow, MessageSquare, PenTool, Palette, Compass,
} from "lucide-react";

const AGENT_ICONS: Record<string, React.ElementType> = {
  "AA-D100": Users,
  "AO-GO": Target,
  "AJ-AF": Workflow,
  "AE-C": MessageSquare,
  "AM-CC": PenTool,
  "AC-DC": Palette,
  "ACO": Compass,
};

const AgentChat = () => {
  const { agentCode } = useParams<{ agentCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, clearMessages, setMessages } = useAgentChat();
  const [input, setInput] = useState("");
  const [project, setProject] = useState<Record<string, unknown> | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = agentCode && agentCode in AGENTS_CONFIG
    ? AGENTS_CONFIG[agentCode as AgentCode]
    : null;
  const AgentIcon = agentCode ? AGENT_ICONS[agentCode] || Bot : Bot;

  // Load project context and chat history
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

  // Load chat history when project loads
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
        }
      });
  }, [projectId, agentCode, setMessages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages after assistant finishes
  useEffect(() => {
    if (isLoading || !projectId || !agentCode || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "assistant") {
      // Save last user + assistant pair
      const userMsg = messages[messages.length - 2];
      if (userMsg?.role === "user") {
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
            content: lastMsg.content,
          }),
        ]);
      }
    }
  }, [isLoading, messages, projectId, agentCode]);

  const handleSend = () => {
    if (!input.trim() || isLoading || !agentCode) return;
    sendMessage(input.trim(), agentCode, project || undefined);
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Agente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
            <AgentIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-display font-semibold text-sm">{agent.fullName}</h1>
            <p className="text-xs text-muted-foreground">{agent.code}</p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={handleClear} title="Limpar conversa">
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center mx-auto mb-4`}>
                <AgentIcon className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-display text-xl font-bold mb-2">{agent.fullName}</h2>
              <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">{agent.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {agent.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                    }}
                    className="text-left p-3 rounded-xl border border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

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
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "glass"
                }`}
              >
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
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0`}>
                <AgentIcon className="w-4 h-4 text-white" />
              </div>
              <div className="glass rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
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
  );
};

export default AgentChat;
