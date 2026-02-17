import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { AGENTS_CONFIG, AgentCode } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  ChevronRight, CheckCircle2, Circle, MessageSquare,
  FileText, ArrowRight, Zap,
} from "lucide-react";

const AGENTS = Object.values(AGENTS_CONFIG);

// Dependency map: agent -> agents it depends on
const AGENT_DEPENDENCIES: Record<string, string[]> = {
  "AA-D100": [],
  "AO-GO": ["AA-D100"],
  "AJ-AF": ["AA-D100", "AO-GO"],
  "AE-C": ["AA-D100", "AO-GO"],
  "AM-CC": ["AA-D100", "AO-GO", "AE-C"],
  "AC-DC": ["AM-CC"],
  "ACO": ["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC"],
};

const FLOW_ORDER: AgentCode[] = ["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC", "ACO"];

interface AgentStats {
  outputs: number;
  messages: number;
  approved: number;
}

const Agents = () => {
  const { activeProject } = useActiveProject();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, AgentStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const [{ data: outputs }, { data: messages }] = await Promise.all([
        supabase
          .from("agent_outputs")
          .select("agent_name, is_approved")
          .eq("project_id", activeProject.id),
        supabase
          .from("chat_messages")
          .select("agent_name")
          .eq("project_id", activeProject.id),
      ]);

      const s: Record<string, AgentStats> = {};
      for (const a of AGENTS) {
        const agentOutputs = outputs?.filter((o) => o.agent_name === a.code) || [];
        const agentMessages = messages?.filter((m) => m.agent_name === a.code) || [];
        s[a.code] = {
          outputs: agentOutputs.length,
          messages: agentMessages.length,
          approved: agentOutputs.filter((o) => o.is_approved).length,
        };
      }
      setStats(s);
      setLoading(false);
    };

    load();
  }, [activeProject]);

  const getAgentStatus = (code: string): "completed" | "in_progress" | "pending" => {
    const s = stats[code];
    if (!s) return "pending";
    if (s.approved > 0) return "completed";
    if (s.messages > 0) return "in_progress";
    return "pending";
  };

  const completedCount = AGENTS.filter((a) => getAgentStatus(a.code) === "completed").length;
  const progressPercent = Math.round((completedCount / AGENTS.length) * 100);

  const statusConfig = {
    completed: { label: "Completo", color: "bg-green-500/10 text-green-400 border-green-500/30" },
    in_progress: { label: "Em andamento", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    pending: { label: "Pendente", color: "bg-muted text-muted-foreground border-border" },
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-bold">Agentes de IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie e acompanhe seus 7 agentes estratégicos integrados.
        </p>
      </div>

      {/* Progress overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display font-semibold">Progresso Geral</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedCount} de {AGENTS.length} agentes com outputs aprovados
            </p>
          </div>
          <span className="text-2xl font-display font-bold gradient-text">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </motion.div>

      {/* Flow visualization */}
      <div>
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Fluxo de Dependências
        </h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {FLOW_ORDER.map((code, i) => {
            const agent = AGENTS_CONFIG[code];
            const status = getAgentStatus(code);
            const IconComp = agent.icon;
            return (
              <div key={code} className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/agent/${code}`)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:scale-105 ${
                    status === "completed"
                      ? "border-green-500/30 bg-green-500/5"
                      : status === "in_progress"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border bg-card/30"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
                    <IconComp className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-mono text-muted-foreground">{code}</span>
                    {status === "completed" && <CheckCircle2 className="w-3 h-3 text-green-400 inline ml-1" />}
                  </div>
                </button>
                {i < FLOW_ORDER.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AGENTS.map((agent, i) => {
          const status = getAgentStatus(agent.code);
          const s = stats[agent.code] || { outputs: 0, messages: 0, approved: 0 };
          const deps = AGENT_DEPENDENCIES[agent.code] || [];
          const IconComp = agent.icon;
          const { label, color } = statusConfig[status];

          return (
            <motion.div
              key={agent.code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass glass-hover rounded-xl p-5 flex flex-col cursor-pointer group"
              onClick={() => navigate(`/agent/${agent.code}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
                    <IconComp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-mono text-muted-foreground">{agent.code}</span>
                    <h4 className="font-display font-semibold">{agent.name}</h4>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] ${color}`}>
                  {status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {status === "in_progress" && <Circle className="w-3 h-3 mr-1 fill-current" />}
                  {label}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground flex-1">{agent.description}</p>

              {/* Stats */}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> {s.messages} msgs
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> {s.approved} aprovados
                </span>
              </div>

              {/* Dependencies */}
              {deps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Depende de:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {deps.map((dep) => {
                      const depStatus = getAgentStatus(dep);
                      return (
                        <span
                          key={dep}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            depStatus === "completed"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {dep} {depStatus === "completed" && "✓"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button size="sm" variant="ghost" className="mt-3 self-start group-hover:text-primary transition-colors">
                {status === "completed" ? "Ver resultados" : status === "in_progress" ? "Continuar" : "Iniciar"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Agents;
