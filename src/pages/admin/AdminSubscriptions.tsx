import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Search, UserCircle, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  plan: string;
  onboarding_completed: boolean;
  created_at: string;
}

const PLANS = ["starter", "professional", "scale"];

const AdminSubscriptions = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "plan" | "created_at">("created_at");

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers(data || []);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handlePlanChange = async (userId: string, newPlan: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ plan: newPlan })
      .eq("user_id", userId);
    if (error) {
      toast.error("Erro ao atualizar plano");
    } else {
      toast.success("Plano atualizado!");
      fetchUsers();
    }
  };

  const filtered = users
    .filter((u) => u.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "plan") return a.plan.localeCompare(b.plan);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">Gestão de Assinaturas</h1>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-secondary/50"
            />
          </div>
          <div className="flex gap-2">
            {(["created_at", "name", "plan"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={sortBy === s ? "default" : "outline"}
                onClick={() => setSortBy(s)}
              >
                <ArrowUpDown className="w-3 h-3 mr-1" />
                {s === "created_at" ? "Data" : s === "name" ? "Nome" : "Plano"}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <UserCircle className="w-8 h-8 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">{user.name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {new Date(user.created_at).toLocaleDateString("pt-BR")} •{" "}
                    {user.onboarding_completed ? "Onboarding OK" : "Onboarding pendente"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {PLANS.map((plan) => (
                  <button
                    key={plan}
                    onClick={() => handlePlanChange(user.user_id, plan)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                      user.plan === plan
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {plan}
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado.</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptions;
