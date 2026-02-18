import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import {
  Plus, FolderKanban, Trash2, Pencil, Calendar, Target,
  Users as UsersIcon, DollarSign, Package, MoreVertical,
  Images, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProjectGallery from "@/components/ProjectGallery";

interface Project {
  id: string;
  name: string;
  nicho: string | null;
  objetivo: string | null;
  publico_alvo: string | null;
  faturamento: string | null;
  has_product: boolean | null;
  product_description: string | null;
  created_at: string;
}

const FATURAMENTO_OPTIONS = [
  "Ainda não faturo",
  "Até R$ 5.000/mês",
  "R$ 5.000 - R$ 20.000/mês",
  "R$ 20.000 - R$ 100.000/mês",
  "Acima de R$ 100.000/mês",
];

const Projects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refresh: refreshActiveProject } = useActiveProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedGallery, setExpandedGallery] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    nicho: "",
    objetivo: "",
    publico_alvo: "",
    faturamento: "",
    has_product: false,
    product_description: "",
  });

  const fetchProjects = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
    refreshActiveProject();
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const resetForm = () => {
    setForm({ name: "", nicho: "", objetivo: "", publico_alvo: "", faturamento: "", has_product: false, product_description: "" });
    setEditingProject(null);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      nicho: project.nicho || "",
      objetivo: project.objetivo || "",
      publico_alvo: project.publico_alvo || "",
      faturamento: project.faturamento || "",
      has_product: project.has_product || false,
      product_description: project.product_description || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.name.trim()) {
      toast({ title: "Erro", description: "Nome do projeto é obrigatório.", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      nicho: form.nicho || null,
      objetivo: form.objetivo || null,
      publico_alvo: form.publico_alvo || null,
      faturamento: form.faturamento || null,
      has_product: form.has_product,
      product_description: form.has_product ? form.product_description || null : null,
      user_id: user.id,
    };

    if (editingProject) {
      const { error } = await supabase.from("projects").update(payload).eq("id", editingProject.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Projeto atualizado!" });
    } else {
      const { error } = await supabase.from("projects").insert(payload);
      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Projeto criado!" });
    }

    setDialogOpen(false);
    resetForm();
    fetchProjects();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Projeto excluído." });
    fetchProjects();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Meus Projetos</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus projetos e configure cada um para os agentes de IA.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingProject ? "Editar Projeto" : "Novo Projeto"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Nome do Projeto *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Minha Agência Digital" />
              </div>
              <div>
                <Label>Nicho de Atuação</Label>
                <Input value={form.nicho} onChange={(e) => setForm({ ...form, nicho: e.target.value })} placeholder="Ex: Marketing Digital, Saúde, Educação" />
              </div>
              <div>
                <Label>Objetivo Principal</Label>
                <Textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="Ex: Escalar vendas online para R$ 100k/mês" rows={2} />
              </div>
              <div>
                <Label>Público-Alvo</Label>
                <Input value={form.publico_alvo} onChange={(e) => setForm({ ...form, publico_alvo: e.target.value })} placeholder="Ex: Empreendedores digitais 25-45 anos" />
              </div>
              <div>
                <Label>Faturamento Atual</Label>
                <Select value={form.faturamento} onValueChange={(v) => setForm({ ...form, faturamento: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FATURAMENTO_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Já possui produto?</Label>
                <Switch checked={form.has_product} onCheckedChange={(v) => setForm({ ...form, has_product: v })} />
              </div>
              {form.has_product && (
                <div>
                  <Label>Descrição do Produto</Label>
                  <Textarea value={form.product_description} onChange={(e) => setForm({ ...form, product_description: e.target.value })} placeholder="Descreva seu produto ou serviço..." rows={3} />
                </div>
              )}
              <Button onClick={handleSave} className="w-full">
                {editingProject ? "Salvar Alterações" : "Criar Projeto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-xl p-5 h-48 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
          <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold mb-2">Nenhum projeto ainda</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro projeto para começar a usar os agentes de IA.</p>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Criar Projeto
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className="glass glass-hover rounded-xl p-5 flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(project)}>
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(project.id)} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h4 className="font-display font-semibold text-lg">{project.name}</h4>

                <div className="mt-3 space-y-1.5 flex-1 text-xs text-muted-foreground">
                  {project.nicho && (
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5" /> {project.nicho}
                    </div>
                  )}
                  {project.publico_alvo && (
                    <div className="flex items-center gap-2">
                      <UsersIcon className="w-3.5 h-3.5" /> {project.publico_alvo}
                    </div>
                  )}
                  {project.faturamento && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5" /> {project.faturamento}
                    </div>
                  )}
                  {project.has_product && (
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5" /> Tem produto
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  Criado em {new Date(project.created_at).toLocaleDateString("pt-BR")}

                  {/* Gallery toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedGallery(expandedGallery === project.id ? null : project.id);
                    }}
                    className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs transition-colors ${
                      expandedGallery === project.id
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <Images className="w-3 h-3" />
                    Criativos
                    <ChevronDown className={`w-3 h-3 transition-transform ${expandedGallery === project.id ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {/* Gallery panel */}
                <AnimatePresence>
                  {expandedGallery === project.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1 border-t border-border/50 mt-3">
                        <ProjectGallery projectId={project.id} projectName={project.name} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Projects;
