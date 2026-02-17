import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { AGENTS_CONFIG } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Save, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

interface Prompt {
  id: string;
  agent_code: string;
  system_prompt: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

const AGENTS = Object.values(AGENTS_CONFIG);

const AdminAgents = () => {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].code);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [newPrompt, setNewPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchPrompts = async () => {
    const { data } = await supabase
      .from("agent_prompts")
      .select("*")
      .eq("agent_code", selectedAgent)
      .order("version", { ascending: false });
    setPrompts(data || []);
  };

  useEffect(() => {
    fetchPrompts();
  }, [selectedAgent]);

  const handleSavePrompt = async () => {
    if (!newPrompt.trim()) return;
    setLoading(true);
    const maxVersion = prompts.length > 0 ? Math.max(...prompts.map((p) => p.version)) : 0;

    // Deactivate all current prompts
    if (prompts.length > 0) {
      await supabase
        .from("agent_prompts")
        .update({ is_active: false })
        .eq("agent_code", selectedAgent);
    }

    const { error } = await supabase.from("agent_prompts").insert({
      agent_code: selectedAgent,
      system_prompt: newPrompt,
      version: maxVersion + 1,
      is_active: true,
    });

    if (error) {
      toast.error("Erro ao salvar prompt");
    } else {
      toast.success("Prompt salvo com sucesso!");
      setNewPrompt("");
      fetchPrompts();
    }
    setLoading(false);
  };

  const toggleActive = async (prompt: Prompt) => {
    // Deactivate all, then activate this one
    await supabase
      .from("agent_prompts")
      .update({ is_active: false })
      .eq("agent_code", selectedAgent);

    if (!prompt.is_active) {
      await supabase
        .from("agent_prompts")
        .update({ is_active: true })
        .eq("id", prompt.id);
    }

    fetchPrompts();
    toast.success("Status do prompt atualizado");
  };

  const deletePrompt = async (id: string) => {
    await supabase.from("agent_prompts").delete().eq("id", id);
    fetchPrompts();
    toast.success("Prompt removido");
  };

  const agentConfig = AGENTS_CONFIG[selectedAgent as keyof typeof AGENTS_CONFIG];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">Gestão de Agentes & Prompts</h1>

        {/* Agent selector */}
        <div className="flex flex-wrap gap-2">
          {AGENTS.map((agent) => {
            const IconComp = agent.icon;
            const isActive = selectedAgent === agent.code;
            return (
              <button
                key={agent.code}
                onClick={() => setSelectedAgent(agent.code)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "glass glass-hover"
                }`}
              >
                <IconComp className="w-4 h-4" />
                {agent.code}
              </button>
            );
          })}
        </div>

        {/* Agent info */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <agentConfig.icon className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">{agentConfig.fullName}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{agentConfig.description}</p>
        </div>

        {/* New prompt */}
        <div className="glass rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold">Novo Prompt do Sistema</h3>
          <Textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="Digite o system prompt para este agente..."
            className="min-h-[200px] bg-secondary/50 border-border"
          />
          <Button onClick={handleSavePrompt} disabled={loading || !newPrompt.trim()}>
            <Save className="w-4 h-4 mr-2" />
            Salvar como nova versão
          </Button>
        </div>

        {/* Prompt history */}
        <div className="space-y-3">
          <h3 className="font-display font-semibold">Histórico de Prompts</h3>
          {prompts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum prompt configurado para este agente.</p>
          )}
          {prompts.map((prompt) => (
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`glass rounded-xl p-4 ${prompt.is_active ? "border-primary/50" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">v{prompt.version}</span>
                  {prompt.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      ATIVO
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(prompt)}>
                    {prompt.is_active ? (
                      <ToggleRight className="w-4 h-4 text-primary" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deletePrompt(prompt.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setNewPrompt(prompt.system_prompt)}>
                    Copiar
                  </Button>
                </div>
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                {prompt.system_prompt}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(prompt.created_at).toLocaleDateString("pt-BR")}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAgents;
