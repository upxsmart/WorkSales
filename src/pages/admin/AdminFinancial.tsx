import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Percent, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { COST_BREAKDOWN, MARGIN_PER_PLAN, monthlyRevenueData } from "@/lib/adminMockData";

const AdminFinancial = () => {
  const receitaMensal = 24650;
  const custoTotal = 1235.25;
  const margemBruta = ((receitaMensal - custoTotal) / receitaMensal * 100).toFixed(1);
  const arr = receitaMensal * 12;

  const kpis = [
    { label: "Receita Mensal", value: `R$${receitaMensal.toLocaleString("pt-BR")}`, icon: DollarSign, change: "+12.3%" },
    { label: "Custo Total/Mês", value: `R$${custoTotal.toLocaleString("pt-BR")}`, icon: TrendingUp, change: "-2.1%" },
    { label: "Margem Bruta", value: `${margemBruta}%`, icon: Percent, change: "+1.2pp" },
    { label: "ARR Projetado", value: `R$${arr.toLocaleString("pt-BR")}`, icon: CalendarDays, change: "+12.3%" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">Dashboard Financeiro</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{kpi.label}</span>
                <kpi.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="font-display text-2xl font-bold">{kpi.value}</p>
              <span className="text-xs text-emerald-400">{kpi.change}</span>
            </motion.div>
          ))}
        </div>

        {/* Revenue chart */}
        <div className="glass rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Receita vs Custo (12 meses)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenueData}>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost Breakdown */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-display font-semibold mb-4">Breakdown de Custos Mensais</h3>
            <div className="space-y-4">
              {COST_BREAKDOWN.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">R${c.amount.toFixed(2)} ({c.value}%)</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${c.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Margin per Plan */}
          <div className="space-y-4">
            <h3 className="font-display font-semibold">Margem por Plano</h3>
            {MARGIN_PER_PLAN.map((p) => (
              <div key={p.plan} className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                    <span className="font-medium">{p.plan}</span>
                  </div>
                  <span className="text-2xl font-display font-bold">{p.margin}%</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Preço: R${p.price}/mês</span>
                  <span>Custo: ~R${p.cost}/user</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 mt-3">
                  <div className="h-2 rounded-full" style={{ width: `${p.margin}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Accumulated Profit */}
        <div className="glass rounded-xl p-6 border-l-4 border-emerald-400">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-lg">Lucro Acumulado 12 Meses</h3>
              <p className="text-sm text-muted-foreground mt-1">Margem média ponderada: 86.5%</p>
            </div>
            <p className="font-display text-3xl font-bold text-emerald-400">R$652.108</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFinancial;
