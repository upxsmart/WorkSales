import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { Check, Edit2, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Plan = {
  id: string;
  plan_code: string;
  plan_name: string;
  price_brl: number;
  interactions_limit: number;
  creatives_limit: number;
  projects_limit: number;
  llm_model: string;
  image_model: string;
  features: string[];
  is_active: boolean;
};

const PLAN_COLORS: Record<string, string> = {
  starter:      "hsl(188, 95%, 43%)",
  professional: "hsl(231, 70%, 60%)",
  scale:        "hsl(38, 92%, 50%)",
};

const AdminSubscriptions = () => {
  const [plans, setPlans]         = useState<Plan[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm]   = useState<Partial<Plan>>({});
  const [saving, setSaving]       = useState(false);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from("plans_config")
      .select("*")
      .order("price_brl", { ascending: true });
    if (data) setPlans(data as Plan[]);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditForm({
      plan_name: plan.plan_name,
      price_brl: plan.price_brl,
      interactions_limit: plan.interactions_limit,
      creatives_limit: plan.creatives_limit,
      projects_limit: plan.projects_limit,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const savePlan = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("plans_config")
      .update(editForm)
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar plano");
    } else {
      toast.success("Plano atualizado!");
      setEditingId(null);
      fetchPlans();
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">Assinaturas & Planos</h1>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass rounded-xl overflow-hidden">
                <div className="h-1.5 bg-muted" />
                <div className="p-6 space-y-3">
                  <Skeleton className="w-24 h-6" />
                  <Skeleton className="w-32 h-8" />
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="w-full h-4" />
                    ))}
                  </div>
                </div>
              </div>
            ))}

          {!loading &&
            plans.map((plan, i) => {
              const color = PLAN_COLORS[plan.plan_code] || "hsl(231, 70%, 60%)";
              const isEditing = editingId === plan.id;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass rounded-xl overflow-hidden"
                >
                  <div className="h-1.5" style={{ background: color }} />
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display font-bold text-lg">{plan.plan_name}</h3>
                      <Badge variant="outline" className={plan.is_active ? "border-emerald-500/30 text-emerald-400" : "border-destructive/30 text-destructive"}>
                        {plan.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="text-xs text-muted-foreground">Preço (R$)</label>
                          <Input
                            type="number"
                            value={editForm.price_brl ?? plan.price_brl}
                            onChange={(e) => setEditForm({ ...editForm, price_brl: Number(e.target.value) })}
                            className="bg-secondary/50 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Limite de Interações</label>
                          <Input
                            type="number"
                            value={editForm.interactions_limit ?? plan.interactions_limit}
                            onChange={(e) => setEditForm({ ...editForm, interactions_limit: Number(e.target.value) })}
                            className="bg-secondary/50 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Limite de Criativos</label>
                          <Input
                            type="number"
                            value={editForm.creatives_limit ?? plan.creatives_limit}
                            onChange={(e) => setEditForm({ ...editForm, creatives_limit: Number(e.target.value) })}
                            className="bg-secondary/50 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Limite de Projetos (-1 = ilimitado)</label>
                          <Input
                            type="number"
                            value={editForm.projects_limit ?? plan.projects_limit}
                            onChange={(e) => setEditForm({ ...editForm, projects_limit: Number(e.target.value) })}
                            className="bg-secondary/50 mt-1"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="font-display text-3xl font-bold mb-5">
                        R${plan.price_brl}
                        <span className="text-sm font-normal text-muted-foreground">/mês</span>
                      </p>
                    )}

                    {!isEditing && (
                      <ul className="space-y-2.5 mb-6">
                        {(plan.features || []).map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} />
                            <span>{f}</span>
                          </li>
                        ))}
                        <li className="flex items-start gap-2 text-xs text-muted-foreground pt-2 border-t border-border/30">
                          <span>Interações: <strong className="text-foreground">{plan.interactions_limit}/mês</strong></span>
                        </li>
                        <li className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span>Criativos: <strong className="text-foreground">{plan.creatives_limit}/mês</strong></span>
                        </li>
                        <li className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span>Projetos: <strong className="text-foreground">{plan.projects_limit === -1 ? "Ilimitados" : plan.projects_limit}</strong></span>
                        </li>
                      </ul>
                    )}

                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 gradient-primary text-primary-foreground"
                          onClick={() => savePlan(plan.id)}
                          disabled={saving}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={cancelEdit}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full gap-2" onClick={() => startEdit(plan)}>
                        <Edit2 className="w-4 h-4" /> Editar Plano
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
        </div>

        {/* Models info */}
        {!loading && plans.length > 0 && (
          <div className="glass rounded-xl p-5">
            <h3 className="font-display font-semibold mb-4">Modelos por Plano</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Plano</th>
                    <th className="text-left px-3 py-2 font-medium">Modelo LLM</th>
                    <th className="text-left px-3 py-2 font-medium">Modelo de Imagem</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-b border-border/20">
                      <td className="px-3 py-2 font-medium">{plan.plan_name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{plan.llm_model}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{plan.image_model}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptions;
