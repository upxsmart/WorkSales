import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, Percent, Users, Zap,
  BarChart2, AlertCircle, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_PRICES, PLAN_COLORS, COST_BREAKDOWN, MARGIN_PER_PLAN } from "@/lib/adminMockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Tipos ──────────────────────────────────────────────────────────
type AgentStat = {
  agent_code: string;
  total_interactions: number;
  total_tokens: number;
  total_cost_usd: number;
};

type DailyStat = {
  day: string;
  interactions: number;
  tokens: number;
  cost_usd: number;
};

type PlanCount = {
  plan: string;
  total: number;
  plan_status: string;
};

// ── Cores por agente ───────────────────────────────────────────────
const AGENT_COLORS: Record<string, string> = {
  "AA-D100": "hsl(217, 70%, 55%)",
  "AO-GO":   "hsl(38, 92%, 55%)",
  "AJ-AF":   "hsl(142, 70%, 45%)",
  "AE-C":    "hsl(330, 70%, 55%)",
  "AM-CC":   "hsl(270, 70%, 60%)",
  "AC-DC":   "hsl(24, 90%, 55%)",
  "AT-GP":   "hsl(0, 75%, 55%)",
  "ACO":     "hsl(240, 70%, 60%)",
};

// ── Tooltip customizado ────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs border border-border shadow-lg">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{typeof p.value === "number" && p.name.includes("$")
            ? `$${p.value.toFixed(4)}`
            : p.value.toLocaleString("pt-BR")}</span>
        </p>
      ))}
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────
const AdminFinancial = () => {
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [planCounts, setPlanCounts] = useState<PlanCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [hasRealData, setHasRealData] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    const [agentRes, dailyRes, plansRes] = await Promise.all([
      // Custo e tokens por agente
      Promise.resolve(null),

      // Query direta ao usage_logs agrupado por agente
      supabase.from("usage_logs").select("agent_code, tokens_input, tokens_output, cost_usd, created_at"),

      // Perfis por plano
      supabase.from("profiles").select("plan, plan_status"),
    ]);

    // Processar usage_logs
    const logs = (dailyRes.data || []) as {
      agent_code: string;
      tokens_input: number;
      tokens_output: number;
      cost_usd: number;
      created_at: string;
    }[];

    setHasRealData(logs.length > 0);

    // Agrupar por agente
    const byAgent: Record<string, AgentStat> = {};
    logs.forEach((row) => {
      if (!byAgent[row.agent_code]) {
        byAgent[row.agent_code] = { agent_code: row.agent_code, total_interactions: 0, total_tokens: 0, total_cost_usd: 0 };
      }
      byAgent[row.agent_code].total_interactions += 1;
      byAgent[row.agent_code].total_tokens += (row.tokens_input || 0) + (row.tokens_output || 0);
      byAgent[row.agent_code].total_cost_usd += Number(row.cost_usd || 0);
    });
    setAgentStats(Object.values(byAgent).sort((a, b) => b.total_cost_usd - a.total_cost_usd));

    // Agrupar por dia (últimos 30 dias)
    const byDay: Record<string, DailyStat> = {};
    logs.forEach((row) => {
      const day = new Date(row.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!byDay[day]) byDay[day] = { day, interactions: 0, tokens: 0, cost_usd: 0 };
      byDay[day].interactions += 1;
      byDay[day].tokens += (row.tokens_input || 0) + (row.tokens_output || 0);
      byDay[day].cost_usd += Number(row.cost_usd || 0);
    });
    setDailyStats(Object.values(byDay).slice(-30));

    // Planos
    const profiles = (plansRes.data || []) as { plan: string; plan_status: string }[];
    const planMap: Record<string, PlanCount> = {};
    profiles.forEach((p) => {
      const key = `${p.plan}_${p.plan_status}`;
      if (!planMap[key]) planMap[key] = { plan: p.plan, plan_status: p.plan_status, total: 0 };
      planMap[key].total += 1;
    });
    setPlanCounts(Object.values(planMap));

    setLastRefresh(new Date());
    setLoading(false);
    void agentRes; // suppress unused warning
  };

  useEffect(() => { fetchData(); }, []);

  // ── KPIs calculados ────────────────────────────────────────────
  const totalTokens = agentStats.reduce((s, a) => s + a.total_tokens, 0);
  const totalCostUsd = agentStats.reduce((s, a) => s + a.total_cost_usd, 0);
  const totalInteractions = agentStats.reduce((s, a) => s + a.total_interactions, 0);

  // Receita real: usuários por plano × preço
  const activeProfiles = planCounts.filter((p) => p.plan_status !== "churned");
  const receitaReal = activeProfiles.reduce(
    (sum, p) => sum + (PLAN_PRICES[p.plan] || 0) * p.total,
    0,
  );
  const totalUsers = planCounts.reduce((s, p) => s + p.total, 0);
  const margemBruta = receitaReal > 0 ? (((receitaReal - totalCostUsd * 5.1) / receitaReal) * 100).toFixed(1) : "—";

  // Dados de pizza — usuários por plano
  const pieData = Object.entries(
    activeProfiles.reduce((acc, p) => {
      acc[p.plan] = (acc[p.plan] || 0) + p.total;
      return acc;
    }, {} as Record<string, number>),
  ).map(([plan, value]) => ({ name: plan.charAt(0).toUpperCase() + plan.slice(1), value, color: PLAN_COLORS[plan] || "hsl(var(--muted))" }));

  // Dados de barras por agente
  const agentChartData = agentStats.map((a) => ({
    agent: a.agent_code,
    Interações: a.total_interactions,
    "Tokens (k)": Math.round(a.total_tokens / 1000),
    "Custo ($)": Number(a.total_cost_usd.toFixed(4)),
  }));

  const kpis = [
    {
      label: "Receita Estimada/Mês",
      value: receitaReal > 0 ? `R$${receitaReal.toLocaleString("pt-BR")}` : "—",
      sub: `${totalUsers} usuários ativos`,
      icon: DollarSign,
      color: "text-primary",
    },
    {
      label: "Custo IA Total",
      value: totalCostUsd > 0 ? `$${totalCostUsd.toFixed(2)}` : "—",
      sub: hasRealData ? "dados reais" : "sem registros ainda",
      icon: TrendingUp,
      color: "text-destructive",
    },
    {
      label: "Tokens Consumidos",
      value: totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k` : "—",
      sub: `${totalInteractions} interações`,
      icon: Zap,
      color: "text-yellow-500",
    },
    {
      label: "Margem Bruta Est.",
      value: `${margemBruta}%`,
      sub: receitaReal > 0 ? "receita vs custo IA×5.1" : "sem receita registrada",
      icon: Percent,
      color: "text-primary",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Dashboard Financeiro</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Atualizado em {lastRefresh.toLocaleTimeString("pt-BR")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Banner sem dados reais */}
        {!hasRealData && !loading && (
          <div className="glass rounded-xl p-4 border border-warning/20 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Ainda não há interações registradas</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Os gráficos de custo por agente e tokens serão preenchidos automaticamente conforme os usuários interagem com os agentes. Abaixo são exibidos dados de planos e usuários reais.
              </p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="font-display text-2xl font-bold">
                {loading ? <span className="animate-pulse text-muted-foreground text-base">carregando...</span> : kpi.value}
              </p>
              <span className="text-xs text-muted-foreground">{kpi.sub}</span>
            </motion.div>
          ))}
        </div>

        {/* Linha 1: Usuários por plano + Custo por agente */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Distribuição de usuários (dados REAIS) */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Usuários por Plano</h3>
              <Badge variant="outline" className="text-[10px] ml-auto text-primary border-primary/30">Dados reais</Badge>
            </div>
            {loading ? (
              <div className="h-48 animate-pulse bg-secondary/30 rounded-lg" />
            ) : pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Nenhum usuário cadastrado</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Tabela de planos */}
            <div className="mt-3 space-y-1.5">
              {planCounts.map((p) => (
                <div key={`${p.plan}_${p.plan_status}`} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: PLAN_COLORS[p.plan] || "hsl(var(--muted))" }} />
                    <span className="capitalize">{p.plan}</span>
                    <span className="text-muted-foreground">({p.plan_status})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{p.total} usuário{p.total !== 1 ? "s" : ""}</span>
                    <span className="font-medium">
                      R${((PLAN_PRICES[p.plan] || 0) * (p.plan_status === "active" ? p.total : 0)).toLocaleString("pt-BR")}/mês
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custo por agente (dados reais ou placeholder) */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Custo por Agente</h3>
              <Badge variant="outline" className={`text-[10px] ml-auto ${hasRealData ? "text-primary border-primary/30" : "text-muted-foreground"}`}>
                {hasRealData ? "Dados reais" : "Sem dados ainda"}
              </Badge>
            </div>
            {loading ? (
              <div className="h-52 animate-pulse bg-secondary/30 rounded-lg" />
            ) : agentChartData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Zap className="w-8 h-8 opacity-30" />
                <p className="text-sm">Aguardando primeiras interações</p>
                <p className="text-xs">Os dados aparecerão automaticamente</p>
              </div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentChartData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="agent" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Interações" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]}>
                      {agentChartData.map((entry) => (
                        <Cell key={entry.agent} fill={AGENT_COLORS[entry.agent] || "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Linha 2: Tokens e interações ao longo do tempo */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-warning" />
            <h3 className="font-display font-semibold text-sm">Tokens e Interações — Últimos 30 dias</h3>
            <Badge variant="outline" className={`text-[10px] ml-auto ${hasRealData ? "text-primary border-primary/30" : "text-muted-foreground"}`}>
              {hasRealData ? "Dados reais" : "Sem dados ainda"}
            </Badge>
          </div>
          {loading ? (
            <div className="h-52 animate-pulse bg-secondary/30 rounded-lg" />
          ) : dailyStats.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <BarChart2 className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhuma interação registrada ainda</p>
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="interactions" name="Interações" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="tokens" name="Tokens" stroke="hsl(38, 92%, 55%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Linha 3: Tabela de custo por agente + Margem por plano */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Tabela detalhada por agente */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm mb-4">Detalhamento por Agente</h3>
            {agentStats.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados de uso ainda</p>
            ) : (
              <div className="space-y-2">
                {agentStats.map((a) => {
                  const maxCost = Math.max(...agentStats.map((x) => x.total_cost_usd), 0.001);
                  const pct = (a.total_cost_usd / maxCost) * 100;
                  return (
                    <div key={a.agent_code}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-mono font-medium">{a.agent_code}</span>
                        <div className="flex gap-3 text-muted-foreground">
                          <span>{a.total_interactions} interações</span>
                          <span>{(a.total_tokens / 1000).toFixed(1)}k tokens</span>
                          <span className="font-medium text-foreground">${a.total_cost_usd.toFixed(4)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: AGENT_COLORS[a.agent_code] || "hsl(var(--primary))" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Margem por plano (semi-real: preços reais × custos estimados) */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-display font-semibold text-sm">Margem por Plano</h3>
              <Badge variant="outline" className="text-[10px] ml-auto">Preços reais + custos estimados</Badge>
            </div>
            <div className="space-y-3">
              {MARGIN_PER_PLAN.map((p) => (
                <div key={p.plan} className="p-3 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="font-medium text-sm">{p.plan}</span>
                      {/* Mostrar quantos usuários reais neste plano */}
                      {(() => {
                        const count = planCounts.filter((pc) => pc.plan === p.plan.toLowerCase()).reduce((s, pc) => s + pc.total, 0);
                        return count > 0 ? (
                          <Badge variant="secondary" className="text-[10px]">{count} usuário{count !== 1 ? "s" : ""}</Badge>
                        ) : null;
                      })()}
                    </div>
                    <span className="font-display font-bold text-xl">{p.margin}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Preço: R${p.price}/mês</span>
                    <span>Custo estimado: ~R${p.cost}/user</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${p.margin}%`, background: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Breakdown de custos operacionais (estimados) */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-display font-semibold text-sm">Breakdown de Custos Operacionais</h3>
            <Badge variant="outline" className="text-[10px] ml-auto">Valores estimados por plano</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COST_BREAKDOWN.map((c) => (
              <div key={c.name} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.value}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${c.value}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">~R${c.amount.toFixed(2)}/mês</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFinancial;
