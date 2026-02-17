import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { DollarSign, Users, TrendingDown, Target, Plus, ArrowUp, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { monthlyRevenueData, mrrHistory, recentActivity, PLAN_COLORS, PLAN_PRICES } from "@/lib/adminMockData";

const AdminDashboard = () => {
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("profiles").select("plan");
      if (!data) return;
      const counts: Record<string, number> = {};
      data.forEach((p) => { counts[p.plan] = (counts[p.plan] || 0) + 1; });
      setPlanCounts(counts);
    };
    fetch();
  }, []);

  const totalUsers = Object.values(planCounts).reduce((a, b) => a + b, 0) || 1;
  const mrr = Object.entries(planCounts).reduce((acc, [p, c]) => acc + (PLAN_PRICES[p] || 0) * c, 0) || 24650;

  const pieData = Object.entries(PLAN_PRICES).map(([name, price]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: planCounts[name] || (name === "starter" ? 45 : name === "professional" ? 38 : 12),
    color: PLAN_COLORS[name],
    revenue: (planCounts[name] || (name === "starter" ? 45 : name === "professional" ? 38 : 12)) * price,
  }));
  const pieTotal = pieData.reduce((a, b) => a + b.value, 0);

  const kpis = [
    {
      label: "MRR",
      value: `R$${mrr.toLocaleString("pt-BR")}`,
      change: "+12.3%",
      positive: true,
      icon: DollarSign,
      sparkline: mrrHistory,
    },
    { label: "Usuários Ativos", value: totalUsers > 1 ? totalUsers : 95, sub: `${totalUsers > 1 ? totalUsers + 18 : 113} registrados`, change: "+8.5%", positive: true, icon: Users },
    { label: "Churn Rate", value: "3.2%", sub: "vs 4.1% mês anterior", change: "-0.9pp", positive: true, icon: TrendingDown },
    { label: "LTV / CAC", value: "8.4x", sub: "LTV R$2.940 / CAC R$350", change: "+0.6x", positive: true, icon: Target },
  ];

  const activityIcons = { new: Plus, upgrade: ArrowUp, churn: X };
  const activityColors = { new: "text-emerald-400", upgrade: "text-primary", churn: "text-destructive" };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">Visão Geral</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{kpi.label}</span>
                <kpi.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="font-display text-2xl font-bold">{kpi.value}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">{kpi.sub || ""}</span>
                <span className={`text-xs font-medium ${kpi.positive ? "text-emerald-400" : "text-destructive"}`}>{kpi.change}</span>
              </div>
              {kpi.sparkline && (
                <div className="h-10 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kpi.sparkline}>
                      <defs>
                        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(231, 70%, 60%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(231, 70%, 60%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" stroke="hsl(231, 70%, 60%)" fill="url(#sparkGrad)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue vs Cost Chart */}
          <div className="glass rounded-xl p-5 lg:col-span-2">
            <h3 className="font-display font-semibold mb-4">Receita vs Custo (12 meses)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(222, 47%, 9%)", border: "1px solid hsl(217, 33%, 17%)", borderRadius: "8px", color: "hsl(210, 40%, 96%)" }} />
                  <Bar dataKey="receita" name="Receita" fill="hsl(142, 70%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custo" name="Custo" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Plan Distribution Donut */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-display font-semibold mb-4">Distribuição de Planos</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                    {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(222, 47%, 9%)", border: "1px solid hsl(217, 33%, 17%)", borderRadius: "8px", color: "hsl(210, 40%, 96%)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-2">
              {pieData.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                    <span>{p.name}</span>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {p.value} users · {((p.value / pieTotal) * 100).toFixed(0)}% · R${p.revenue.toLocaleString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Atividade Recente de Assinaturas</h3>
          <div className="space-y-3">
            {recentActivity.map((a, i) => {
              const Icon = activityIcons[a.type];
              return (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-border/30 last:border-0">
                  <div className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center ${activityColors[a.type]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{a.user}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {a.type === "new" ? "Nova assinatura" : a.type === "upgrade" ? "Upgrade" : "Churn"} — {a.plan}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${a.impact > 0 ? "text-emerald-400" : "text-destructive"}`}>
                    {a.impact > 0 ? "+" : ""}R${Math.abs(a.impact)}
                  </span>
                  <span className="text-xs text-muted-foreground w-28 text-right">{a.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
