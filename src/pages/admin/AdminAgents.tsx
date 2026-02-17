import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { Bot, Cpu, Zap, DollarSign } from "lucide-react";
import { AGENTS, MODEL_COSTS, OPTIMIZATIONS } from "@/lib/adminMockData";
import { Badge } from "@/components/ui/badge";

const AdminAgents = () => {
  const totalCalls = AGENTS.reduce((a, b) => a + b.calls, 0);
  const totalCost = AGENTS.reduce((a, b) => a + b.monthlyCost, 0);
  const totalTokens = AGENTS.reduce((a, b) => a + b.tokens, 0);
  const totalEconomy = OPTIMIZATIONS.reduce((a, b) => a + b.economy, 0);

  const kpis = [
    { label: "Total Chamadas/Mês", value: totalCalls.toLocaleString("pt-BR"), icon: Bot },
    { label: "Custo Total API/Mês", value: `$${totalCost.toFixed(2)}`, icon: DollarSign },
    { label: "Tokens Processados", value: `${(totalTokens / 1e6).toFixed(1)}M`, icon: Cpu },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">Agentes de IA</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{kpi.label}</span>
                <kpi.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="font-display text-2xl font-bold">{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Agent Table */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border/50">
            <h3 className="font-display font-semibold">Performance por Agente</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left px-5 py-3 font-medium">Agente</th>
                  <th className="text-left px-3 py-3 font-medium">Modelo IA</th>
                  <th className="text-right px-3 py-3 font-medium">Chamadas</th>
                  <th className="text-right px-3 py-3 font-medium">Tokens</th>
                  <th className="text-right px-3 py-3 font-medium">Custo/Mês</th>
                  <th className="text-right px-3 py-3 font-medium">Média</th>
                  <th className="px-5 py-3 font-medium">% Custo</th>
                </tr>
              </thead>
              <tbody>
                {AGENTS.map((a) => (
                  <tr key={a.code} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">{a.code}</Badge>
                        <span className="font-medium">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{a.model}</td>
                    <td className="px-3 py-3 text-right">{a.calls.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{(a.tokens / 1e6).toFixed(1)}M</td>
                    <td className="px-3 py-3 text-right font-medium">${a.monthlyCost.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">${a.avgCost.toFixed(3)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-secondary rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(a.monthlyCost / totalCost * 100)}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{(a.monthlyCost / totalCost * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost by Model */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-display font-semibold mb-4">Custo por Modelo de IA</h3>
            <div className="space-y-4">
              {MODEL_COSTS.map((m) => (
                <div key={m.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{m.name}</span>
                    <span className="text-muted-foreground">{m.pct}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${m.pct}%`, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optimizations */}
          <div className="space-y-4">
            <h3 className="font-display font-semibold">Otimizações Ativas</h3>
            {OPTIMIZATIONS.map((o) => (
              <div key={o.name} className="glass rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-sm font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">{o.detail}</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-emerald-400">-R${o.economy.toLocaleString("pt-BR")}/mês</span>
              </div>
            ))}
            <div className="glass rounded-xl p-4 border-l-4 border-emerald-400">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Economia</span>
                <span className="font-display text-xl font-bold text-emerald-400">R${totalEconomy.toLocaleString("pt-BR")}/mês</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAgents;
