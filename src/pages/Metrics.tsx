import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AGENTS_CONFIG, AgentCode } from "@/lib/agents";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  ArrowLeft, Users, Target, GitBranch, MessageCircle,
  PenTool, Palette, Brain, TrendingUp, FileText,
  DollarSign, BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

type AgentOutput = {
  id: string;
  agent_name: string;
  output_type: string;
  title: string;
  is_approved: boolean;
  created_at: string;
  version: number;
};

const MANUAL_COST_PER_AGENT: Record<string, number> = {
  "AA-D100": 3500,
  "AO-GO": 5000,
  "AJ-AF": 4000,
  "AE-C": 3000,
  "AM-CC": 8000,
  "AC-DC": 6000,
};

const Metrics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [outputs, setOutputs] = useState<AgentOutput[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setProjectId(data.id);
      });
  }, [user]);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("agent_outputs")
      .select("id, agent_name, output_type, title, is_approved, created_at, version")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setOutputs(data as AgentOutput[]);
      });
  }, [projectId]);

  const approvedOutputs = useMemo(() => outputs.filter(o => o.is_approved), [outputs]);

  const completedAgents = useMemo(() => {
    const agentCodes = ["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC"];
    return agentCodes.filter(code => approvedOutputs.some(o => o.agent_name === code)).length;
  }, [approvedOutputs]);

  const kpis = useMemo(() => {
    const personas = approvedOutputs.filter(o => o.agent_name === "AA-D100").length;
    const ofertas = approvedOutputs.filter(o => o.agent_name === "AO-GO").length;
    const copies = approvedOutputs.filter(o => o.agent_name === "AM-CC").length;
    const criativos = approvedOutputs.filter(o => o.agent_name === "AC-DC").length;

    const estimatedValue = Object.entries(MANUAL_COST_PER_AGENT).reduce((sum, [code, cost]) => {
      const hasOutput = approvedOutputs.some(o => o.agent_name === code);
      return sum + (hasOutput ? cost : 0);
    }, 0);

    return { personas, ofertas, copies, criativos, estimatedValue };
  }, [approvedOutputs]);

  // Build chart data from outputs over time
  const chartData = useMemo(() => {
    if (outputs.length === 0) return [];
    const grouped: Record<string, number> = {};
    let cumulative = 0;
    for (const out of outputs) {
      const date = new Date(out.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      cumulative++;
      grouped[date] = cumulative;
    }
    return Object.entries(grouped).map(([date, total]) => ({ date, outputs: total }));
  }, [outputs]);

  const KPI_CARDS = [
    { label: "Estrutura Completa", value: `${Math.round((completedAgents / 6) * 100)}%`, sub: `${completedAgents}/6 agentes`, icon: TrendingUp, color: "text-primary" },
    { label: "Personas Criadas", value: kpis.personas, sub: "micro-personas", icon: Users, color: "text-blue-400" },
    { label: "Ofertas Estruturadas", value: kpis.ofertas, sub: "ofertas", icon: Target, color: "text-amber-400" },
    { label: "Peças de Copy", value: kpis.copies, sub: "textos gerados", icon: PenTool, color: "text-purple-400" },
    { label: "Criativos Projetados", value: kpis.criativos, sub: "briefings", icon: Palette, color: "text-orange-400" },
    { label: "Valor Estimado", value: `R$${kpis.estimatedValue.toLocaleString("pt-BR")}`, sub: "economia vs manual", icon: DollarSign, color: "text-green-400" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="max-w-[1200px] mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <BarChart3 className="w-5 h-5 text-primary" />
          <h1 className="font-display font-semibold">Métricas do Projeto</h1>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto p-6 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {KPI_CARDS.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-4"
            >
              <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
              <p className="text-2xl font-bold font-display">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Progress per Agent */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Progresso por Agente</h3>
          <div className="space-y-4">
            {(["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC"] as const).map(code => {
              const agentConfig = AGENTS_CONFIG[code];
              const agentApproved = approvedOutputs.filter(o => o.agent_name === code).length;
              const hasAny = agentApproved > 0;
              const IconComp = agentConfig.icon;
              return (
                <div key={code} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agentConfig.color} flex items-center justify-center shrink-0`}>
                    <IconComp className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{agentConfig.name}</span>
                      <span className="text-xs text-muted-foreground">{agentApproved} output(s)</span>
                    </div>
                    <Progress value={hasAny ? 100 : 0} className="h-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Outputs ao Longo do Tempo</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorOutputs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(231, 70%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(231, 70%, 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(215, 20%, 55%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(215, 20%, 55%)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222, 47%, 9%)",
                    border: "1px solid hsl(217, 33%, 17%)",
                    borderRadius: "8px",
                    color: "hsl(210, 40%, 96%)",
                  }}
                />
                <Area type="monotone" dataKey="outputs" stroke="hsl(231, 70%, 60%)" fill="url(#colorOutputs)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Nenhum output gerado ainda.</p>
              <p className="text-xs mt-1">Use os agentes para começar a gerar dados.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Metrics;
