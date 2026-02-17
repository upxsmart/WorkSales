import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { AGENTS_CONFIG } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Plus, Trash2, Save, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface KBItem {
  id: string;
  agent_code: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

const AGENTS = Object.values(AGENTS_CONFIG);

const AdminKnowledge = () => {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].code);
  const [items, setItems] = useState<KBItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general" });

  const fetchItems = async () => {
    const { data } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("agent_code", selectedAgent)
      .order("created_at", { ascending: false });
    setItems(data || []);
  };

  useEffect(() => {
    fetchItems();
  }, [selectedAgent]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    const { error } = await supabase.from("knowledge_base").insert({
      agent_code: selectedAgent,
      title: form.title,
      content: form.content,
      category: form.category,
    });
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Item adicionado!");
      setForm({ title: "", content: "", category: "general" });
      setShowForm(false);
      fetchItems();
    }
  };

  const toggleActive = async (item: KBItem) => {
    await supabase.from("knowledge_base").update({ is_active: !item.is_active }).eq("id", item.id);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from("knowledge_base").delete().eq("id", id);
    fetchItems();
    toast.success("Item removido");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Base de Conhecimento</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Item
          </Button>
        </div>

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
                  isActive ? "bg-primary/10 text-primary border border-primary/30" : "glass glass-hover"
                }`}
              >
                <IconComp className="w-4 h-4" />
                {agent.code}
              </button>
            );
          })}
        </div>

        {/* New item form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="glass rounded-xl p-5 space-y-4"
          >
            <h3 className="font-display font-semibold">Adicionar Conhecimento</h3>
            <Input
              placeholder="Título"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-secondary/50"
            />
            <Input
              placeholder="Categoria (ex: framework, metodologia, referência)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="bg-secondary/50"
            />
            <Textarea
              placeholder="Conteúdo do conhecimento..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="min-h-[150px] bg-secondary/50"
            />
            <div className="flex gap-2">
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}

        {/* Items list */}
        <div className="space-y-3">
          {items.length === 0 && (
            <div className="glass rounded-xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum item de conhecimento para este agente.</p>
            </div>
          )}
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`glass rounded-xl p-4 ${!item.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
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
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(item)}>
                    {item.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteItem(item.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto">
                {item.content}
              </pre>
            </motion.div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminKnowledge;
