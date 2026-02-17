import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { Users, Bot, FileText, DollarSign } from "lucide-react";

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalOutputs: number;
  totalPrompts: number;
  planCounts: Record<string, number>;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalProjects: 0, totalOutputs: 0, totalPrompts: 0, planCounts: {},
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [profiles, projects, outputs, prompts] = await Promise.all([
        supabase.from("profiles").select("plan"),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("agent_outputs").select("id", { count: "exact", head: true }),
        supabase.from("agent_prompts").select("id", { count: "exact", head: true }),
      ]);

      const planCounts: Record<string, number> = {};
      (profiles.data || []).forEach((p) => {
        planCounts[p.plan] = (planCounts[p.plan] || 0) + 1;
      });

      setStats({
        totalUsers: (profiles.data || []).length,
        totalProjects: projects.count || 0,
        totalOutputs: outputs.count || 0,
        totalPrompts: prompts.count || 0,
        planCounts,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { label: "Usuários", value: stats.totalUsers, icon: Users, color: "from-blue-500 to-blue-600" },
    { label: "Projetos", value: stats.totalProjects, icon: FileText, color: "from-green-500 to-green-600" },
    { label: "Outputs Gerados", value: stats.totalOutputs, icon: Bot, color: "from-purple-500 to-purple-600" },
    { label: "Prompts Ativos", value: stats.totalPrompts, icon: DollarSign, color: "from-amber-500 to-amber-600" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <h1 className="font-display text-2xl font-bold">Dashboard Admin</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                  <card.icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="font-display text-3xl font-bold">{card.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="glass rounded-xl p-6">
          <h3 className="font-display font-semibold mb-4">Distribuição por Plano</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {["starter", "professional", "scale"].map((plan) => (
              <div key={plan} className="bg-secondary/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground capitalize mb-1">{plan}</p>
                <p className="font-display text-2xl font-bold">{stats.planCounts[plan] || 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
