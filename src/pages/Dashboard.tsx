import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ChevronRight, Lock } from "lucide-react";
import { AGENTS_CONFIG } from "@/lib/agents";

const AGENTS = Object.values(AGENTS_CONFIG);

// Which agents must have approved outputs before unlocking each agent
const AGENT_DEPENDENCIES: Record<string, string[]> = {
  "AA-D100": [],
  "AO-GO": ["AA-D100"],
  "AJ-AF": ["AA-D100", "AO-GO"],
  "AE-C": ["AA-D100", "AO-GO", "AM-CC"],
  "AM-CC": ["AA-D100", "AO-GO"],
  "AC-DC": ["AA-D100", "AO-GO", "AM-CC"],
  "ACO": ["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC"],
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeProject } = useActiveProject();
  const [approvedAgents, setApprovedAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject?.id) {
      setLoading(false);
      return;
    }
    const fetchApproved = async () => {
      const { data } = await supabase
        .from("agent_outputs")
        .select("agent_name")
        .eq("project_id", activeProject.id)
        .eq("is_approved", true);
      if (data) {
        const codes = new Set(data.map((o) => o.agent_name));
        setApprovedAgents(codes);
      }
      setLoading(false);
    };
    fetchApproved();
  }, [activeProject?.id]);

  const isUnlocked = (agentCode: string): boolean => {
    const deps = AGENT_DEPENDENCIES[agentCode] || [];
    return deps.every((dep) => approvedAgents.has(dep));
  };

  const completedCount = AGENTS.filter((a) => approvedAgents.has(a.code)).length;
  const progressPercent = Math.round((completedCount / AGENTS.length) * 100);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Progress card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold">Progresso da Estrutura</h3>
          <span className="text-sm text-muted-foreground">
            {completedCount}/7 agentes com outputs aprovados
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        {!activeProject && (
          <p className="text-xs text-muted-foreground mt-3">
            Selecione ou crie um projeto para acompanhar o progresso.
          </p>
        )}
      </motion.div>

      {/* Agent grid */}
      <div>
        <h3 className="font-display text-xl font-bold mb-4">Seus 7 Agentes de IA</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {AGENTS.map((agent, i) => {
            const IconComp = agent.icon;
            const unlocked = isUnlocked(agent.code);
            const approved = approvedAgents.has(agent.code);
            const deps = AGENT_DEPENDENCIES[agent.code] || [];
            const missingDeps = deps.filter((d) => !approvedAgents.has(d));

            return (
              <motion.div
                key={agent.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass rounded-xl p-5 flex flex-col group relative transition-all ${
                  unlocked
                    ? "glass-hover cursor-pointer"
                    : "opacity-60 cursor-not-allowed"
                }`}
                onClick={() => unlocked && navigate(`/agent/${agent.code}`)}
                title={
                  !unlocked && missingDeps.length
                    ? `Conclua primeiro: ${missingDeps.join(", ")}`
                    : undefined
                }
              >
                {/* Lock overlay */}
                {!unlocked && (
                  <div className="absolute top-3 right-3">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}

                {/* Approved badge */}
                {approved && (
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400" />
                )}

                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center mb-3 ${!unlocked ? "grayscale" : ""}`}>
                  {loading ? (
                    <Skeleton className="w-5 h-5 rounded" />
                  ) : (
                    <IconComp className="w-5 h-5 text-white" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono">{agent.code}</span>
                <h4 className="font-display font-semibold mt-1">{agent.name}</h4>
                <p className="text-xs text-muted-foreground mt-1 flex-1">{agent.description}</p>

                {/* Dependency hint */}
                {!unlocked && missingDeps.length > 0 && (
                  <p className="text-xs text-amber-400/80 mt-2">
                    Requer: {missingDeps.join(", ")}
                  </p>
                )}

                {unlocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`mt-3 self-start group-hover:text-primary transition-colors ${approved ? "text-emerald-400" : ""}`}
                  >
                    {approved ? "Ver outputs" : "Iniciar"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
