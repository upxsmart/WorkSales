import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { AGENTS_CONFIG } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Save, Plus, Trash2, BookOpen, FileText,
  CheckCircle2, Clock, History, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";

type Prompt = {
  id: string;
  agent_code: string;
  system_prompt: string;
  version: number;
  is_active: boolean;
  created_at: string;
};

type KBItem = {
  id: string;
  agent_code: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
  created_at: string;
};

const AGENTS = Object.values(AGENTS_CONFIG);

const AdminAgents = () => {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].code);

  // Prompt state
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // KB state
  const [kbItems, setKbItems] = useState<KBItem[]>([]);
  const [showKbForm, setShowKbForm] = useState(false);
  const [kbForm, setKbForm] = useState({ title: "", content: "", category: "geral" });

  // ──────────────────────────────
  // Fetch prompts for selected agent
  // ──────────────────────────────
  const fetchPrompts = async () => {
    const { data } = await supabase
      .from("agent_prompts")
      .select("*")
      .eq("agent_code", selectedAgent)
      .order("version", { ascending: false });
    if (data) {
      setPrompts(data as Prompt[]);
      const active = data.find((p) => p.is_active) as Prompt | undefined;
      setActivePrompt(active || null);
      setDraftPrompt(active?.system_prompt || "");
    }
  };

  // ──────────────────────────────
  // Fetch KB items for selected agent
  // ──────────────────────────────
  const fetchKbItems = async () => {
    const { data } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("agent_code", selectedAgent)
      .order("created_at", { ascending: false });
    setKbItems((data as KBItem[]) || []);
  };

  useEffect(() => {
    fetchPrompts();
    fetchKbItems();
    setShowHistory(false);
    setShowKbForm(false);
  }, [selectedAgent]);

  // ──────────────────────────────
  // Save new prompt version
  // ──────────────────────────────
  const handleSavePrompt = async () => {
    if (!draftPrompt.trim()) return;
    setSavingPrompt(true);

    // Deactivate all existing prompts for this agent
    await supabase
      .from("agent_prompts")
      .update({ is_active: false })
      .eq("agent_code", selectedAgent);

    const nextVersion = (prompts[0]?.version || 0) + 1;

    const { error } = await supabase.from("agent_prompts").insert({
      agent_code: selectedAgent,
      system_prompt: draftPrompt,
      version: nextVersion,
      is_active: true,
    });

    setSavingPrompt(false);

    if (error) {
      toast.error("Erro ao salvar prompt");
    } else {
      toast.success(`Prompt v${nextVersion} salvo e ativado!`);
      fetchPrompts();
    }
  };

  // ──────────────────────────────
  // Activate a historical prompt version
  // ──────────────────────────────
  const handleActivateVersion = async (prompt: Prompt) => {
    await supabase
      .from("agent_prompts")
      .update({ is_active: false })
      .eq("agent_code", selectedAgent);

    await supabase
      .from("agent_prompts")
      .update({ is_active: true })
      .eq("id", prompt.id);

    toast.success(`Versão v${prompt.version} ativada!`);
    setDraftPrompt(prompt.system_prompt);
    fetchPrompts();
    setShowHistory(false);
  };

  // ──────────────────────────────
  // Knowledge Base operations
  // ──────────────────────────────
  const handleSaveKb = async () => {
    if (!kbForm.title.trim() || !kbForm.content.trim()) return;
    const { error } = await supabase.from("knowledge_base").insert({
      agent_code: selectedAgent,
      title: kbForm.title,
      content: kbForm.content,
      category: kbForm.category,
    });
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Conhecimento adicionado!");
      setKbForm({ title: "", content: "", category: "geral" });
      setShowKbForm(false);
      fetchKbItems();
    }
  };

  const handleToggleKb = async (item: KBItem) => {
    await supabase
      .from("knowledge_base")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    fetchKbItems();
  };

  const handleDeleteKb = async (id: string) => {
    await supabase.from("knowledge_base").delete().eq("id", id);
    fetchKbItems();
    toast.success("Item removido");
  };

  const agent = AGENTS_CONFIG[selectedAgent as keyof typeof AGENTS_CONFIG];
  const AgentIcon = agent?.icon;
  const isDirty = draftPrompt !== (activePrompt?.system_prompt || "");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Configuração de Agentes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os system prompts e a base de conhecimento de cada agente de IA.
          </p>
        </div>

        {/* Agent selector */}
        <div className="flex flex-wrap gap-2">
          {AGENTS.map((a) => {
            const IconComp = a.icon;
            const isActive = selectedAgent === a.code;
            return (
              <button
                key={a.code}
                onClick={() => setSelectedAgent(a.code)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30 shadow-sm"
                    : "glass glass-hover"
                }`}
              >
                <IconComp className="w-4 h-4" />
                <span className="font-mono font-medium">{a.code}</span>
              </button>
            );
          })}
        </div>

        {/* Agent name header */}
        {agent && (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
              <AgentIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-semibold">{agent.fullName}</h2>
              <p className="text-xs text-muted-foreground">{agent.description}</p>
            </div>
            {activePrompt && (
              <Badge variant="outline" className="ml-auto text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1 text-accent" />
                Prompt ativo: v{activePrompt.version}
              </Badge>
            )}
          </div>
        )}

        {/* Tabs: Prompt / Knowledge Base */}
        <Tabs defaultValue="prompt">
          <TabsList className="glass h-10 p-1 gap-1">
            <TabsTrigger value="prompt" className="flex items-center gap-2 text-xs">
              <FileText className="w-3.5 h-3.5" />
              System Prompt
            </TabsTrigger>
            <TabsTrigger value="kb" className="flex items-center gap-2 text-xs">
              <BookOpen className="w-3.5 h-3.5" />
              Base de Conhecimento
              {kbItems.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                  {kbItems.filter(i => i.is_active).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── System Prompt Tab ─── */}
          <TabsContent value="prompt" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                O system prompt define a personalidade, missão e instruções base do agente.
                Cada salvamento cria uma nova versão.
              </p>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Histórico ({prompts.length})
              </button>
            </div>

            {/* History panel */}
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="glass rounded-xl p-4 space-y-2"
              >
                <h4 className="font-display font-semibold text-sm mb-3">Versões anteriores</h4>
                {prompts.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma versão salva ainda.</p>
                )}
                {prompts.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      p.is_active ? "border-primary/40 bg-primary/5" : "border-border/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={p.is_active ? "default" : "outline"} className="text-xs">
                        v{p.version}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(p.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {p.is_active && (
                        <Badge className="text-xs bg-accent/20 text-accent border-accent/30">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={() => setDraftPrompt(p.system_prompt)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Carregar
                      </Button>
                      {!p.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 text-primary"
                          onClick={() => handleActivateVersion(p)}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Ativar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Prompt editor */}
            <div className="glass rounded-xl p-4 space-y-3">
              <Textarea
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                placeholder={`Digite o system prompt para o agente ${selectedAgent}...\n\nDescreva:\n- Identidade e personalidade do agente\n- Missão e objetivos\n- Tom de comunicação\n- Instruções específicas de comportamento\n- Formato de resposta esperado`}
                className="min-h-[320px] font-mono text-sm bg-secondary/30 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {draftPrompt.length} caracteres
                  {isDirty && (
                    <span className="ml-2 text-warning">• Alterações não salvas</span>
                  )}
                </span>
                <Button
                  onClick={handleSavePrompt}
                  disabled={!draftPrompt.trim() || savingPrompt || !isDirty}
                  className="gradient-primary text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingPrompt ? "Salvando..." : `Salvar como v${(prompts[0]?.version || 0) + 1}`}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ─── Knowledge Base Tab ─── */}
          <TabsContent value="kb" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Documentos, links e referências injetados automaticamente no contexto do agente durante o chat.
              </p>
              <Button size="sm" onClick={() => setShowKbForm(!showKbForm)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Item
              </Button>
            </div>

            {/* KB form */}
            {showKbForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="glass rounded-xl p-5 space-y-3"
              >
                <h3 className="font-display font-semibold text-sm">Adicionar Conhecimento</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Título"
                    value={kbForm.title}
                    onChange={(e) => setKbForm({ ...kbForm, title: e.target.value })}
                    className="bg-secondary/50"
                  />
                  <Input
                    placeholder="Categoria (ex: framework, metodologia, referência)"
                    value={kbForm.category}
                    onChange={(e) => setKbForm({ ...kbForm, category: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
                <Textarea
                  placeholder="Conteúdo: cole texto, links, documentação, exemplos de resposta..."
                  value={kbForm.content}
                  onChange={(e) => setKbForm({ ...kbForm, content: e.target.value })}
                  className="min-h-[150px] bg-secondary/50"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveKb}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                  <Button variant="ghost" onClick={() => setShowKbForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </motion.div>
            )}

            {/* KB items list */}
            <div className="space-y-2">
              {kbItems.length === 0 && (
                <div className="glass rounded-xl p-8 text-center">
                  <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum item de conhecimento para <strong>{selectedAgent}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Adicione documentos, links e referências que serão injetados no contexto do agente.
                  </p>
                </div>
              )}
              {kbItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`glass rounded-xl p-4 transition-opacity ${!item.is_active ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-display font-semibold text-sm">{item.title}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {item.category}
                      </span>
                      {!item.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => handleToggleKb(item)}
                        title={item.is_active ? "Desativar" : "Ativar"}
                      >
                        {item.is_active ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => handleDeleteKb(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto font-sans leading-relaxed">
                    {item.content}
                  </pre>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminAgents;
