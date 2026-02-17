import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Users, CreditCard } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PLAN_PRICES: Record<string, number> = {
  starter: 97,
  professional: 197,
  scale: 497,
};

const PLAN_COLORS: Record<string, string> = {
  starter: "hsl(231, 70%, 60%)",
  professional: "hsl(38, 92%, 55%)",
  scale: "hsl(142, 70%, 45%)",
};

const AdminFinancial = () => {
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
  const [monthlyData, setMonthlyData] = useState<{ month: string; mrr: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data: profiles } = await supabase.from("profiles").select("plan, created_at");
      if (!profiles) return;

      const counts: Record<string, number> = {};
      profiles.forEach((p) => {
        counts[p.plan] = (counts[p.plan] || 0) + 1;
      });
      setPlanCounts(counts);

      // Simulate monthly MRR growth based on user signup dates
      const monthMap: Record<string, number> = {};
      const sorted = [...profiles].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      let running = 0;
      sorted.forEach((p) => {
        const date = new Date(p.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        running += PLAN_PRICES[p.plan] || 97;
        monthMap[key] = running;
      });

      setMonthlyData(
        Object.entries(monthMap).map(([month, mrr]) => ({ month, mrr }))
      );
    };
    fetch();
  }, []);

  const mrr = Object.entries(planCounts).reduce(
    (acc, [plan, count]) => acc + (PLAN_PRICES[plan] || 0) * count,
    0
  );
  const arr = mrr * 12;
  const totalUsers = Object.values(planCounts).reduce((a, b) => a + b, 0);
  const arpu = totalUsers > 0 ? mrr / totalUsers : 0;

  const pieData = Object.entries(planCounts).map(([name, value]) => ({
    name,
    value,
    color: PLAN_COLORS[name] || "hsl(215, 20%, 55%)",
  }));

  const kpis = [
    { label: "MRR", value: `R$${mrr.toLocaleString("pt-BR")}`, icon: DollarSign, color: "from-green-500 to-green-600" },
    { label: "ARR", value: `R$${arr.toLocaleString("pt-BR")}`, icon: TrendingUp, color: "from-blue-500 to-blue-600" },
    { label: "Total Assinantes", value: totalUsers, icon: Users, color: "from-purple-500 to-purple-600" },
    { label: "ARPU", value: `R$${arpu.toFixed(0)}`, icon: CreditCard, color: "from-amber-500 to-amber-600" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <h1 className="font-display text-2xl font-bold">Dashboard Financeiro</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{kpi.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center`}>
                  <kpi.icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="font-display text-2xl font-bold">{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MRR Chart */}
          <div className="glass rounded-xl p-5 lg:col-span-2">
            <h3 className="font-display font-semibold mb-4">Evolução do MRR</h3>
            <div className="h-64">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(231, 70%, 60%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(231, 70%, 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(222, 47%, 9%)",
                        border: "1px solid hsl(217, 33%, 17%)",
                        borderRadius: "8px",
                        color: "hsl(210, 40%, 96%)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="mrr"
                      stroke="hsl(231, 70%, 60%)"
                      fill="url(#mrrGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </div>

          {/* Plan distribution */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-display font-semibold mb-4">Distribuição por Plano</h3>
            <div className="h-48">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(222, 47%, 9%)",
                        border: "1px solid hsl(217, 33%, 17%)",
                        borderRadius: "8px",
                        color: "hsl(210, 40%, 96%)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
            <div className="space-y-2 mt-4">
              {Object.entries(planCounts).map(([plan, count]) => (
                <div key={plan} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: PLAN_COLORS[plan] }}
                    />
                    <span className="capitalize">{plan}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {count} ({count > 0 ? `R$${(PLAN_PRICES[plan] || 0) * count}` : "R$0"})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFinancial;
