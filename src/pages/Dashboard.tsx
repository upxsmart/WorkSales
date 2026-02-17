import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { AGENTS_CONFIG } from "@/lib/agents";

const AGENTS = Object.values(AGENTS_CONFIG);

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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
          <span className="text-sm text-muted-foreground">0/7 agentes completos</span>
        </div>
        <Progress value={0} className="h-2" />
      </motion.div>

      {/* Agent grid */}
      <div>
        <h3 className="font-display text-xl font-bold mb-4">Seus 7 Agentes de IA</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {AGENTS.map((agent, i) => {
            const IconComp = agent.icon;
            return (
              <motion.div
                key={agent.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass glass-hover rounded-xl p-5 flex flex-col cursor-pointer group"
                onClick={() => navigate(`/agent/${agent.code}`)}
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center mb-3`}>
                  <IconComp className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs text-muted-foreground font-mono">{agent.code}</span>
                <h4 className="font-display font-semibold mt-1">{agent.name}</h4>
                <p className="text-xs text-muted-foreground mt-1 flex-1">{agent.description}</p>
                <Button size="sm" variant="ghost" className="mt-3 self-start group-hover:text-primary transition-colors">
                  Iniciar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
