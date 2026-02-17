import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  LayoutDashboard, FolderKanban, Bot, FileText, BarChart3,
  Settings, LogOut, Users, Target, Workflow, MessageSquare,
  PenTool, Palette, Compass, ChevronRight, Menu, X,
} from "lucide-react";

const AGENTS = [
  { code: "AA-D100", name: "Análise de Audiência", icon: Users, description: "Micro-personas e Dream 100", color: "from-blue-500 to-indigo-600" },
  { code: "AO-GO", name: "Otimização de Ofertas", icon: Target, description: "Escada de Valor e copy", color: "from-emerald-500 to-teal-600" },
  { code: "AJ-AF", name: "Jornada e Funil", icon: Workflow, description: "Automação e lead scoring", color: "from-orange-500 to-amber-600" },
  { code: "AE-C", name: "Engajamento", icon: MessageSquare, description: "Scripts e qualificação", color: "from-pink-500 to-rose-600" },
  { code: "AM-CC", name: "Marketing e Conteúdo", icon: PenTool, description: "Páginas, emails e hooks", color: "from-violet-500 to-purple-600" },
  { code: "AC-DC", name: "Design e Criativos", icon: Palette, description: "Briefings visuais e specs", color: "from-cyan-500 to-blue-600" },
  { code: "ACO", name: "Orquestrador Central", icon: Compass, description: "Diagnóstico e plano de ação", color: "from-accent to-yellow-600" },
];

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Meus Projetos", icon: FolderKanban, path: "/projects" },
  { label: "Agentes", icon: Bot, path: "/agents" },
  { label: "Documentos", icon: FileText, path: "/documents" },
  { label: "Métricas", icon: BarChart3, path: "/metrics" },
  { label: "Configurações", icon: Settings, path: "/settings" },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ name: string; plan: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name, plan")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold gradient-text">WorkSales</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <item.icon className="w-4 h-4 text-muted-foreground" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="font-display text-lg font-semibold">
            Olá, {profile?.name || "Usuário"}! 👋
          </h2>
          <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium capitalize">
            {profile?.plan || "starter"}
          </span>
        </header>

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
              {AGENTS.map((agent, i) => (
                <motion.div
                  key={agent.code}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass glass-hover rounded-xl p-5 flex flex-col cursor-pointer group"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center mb-3`}>
                    <agent.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{agent.code}</span>
                  <h4 className="font-display font-semibold mt-1">{agent.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1 flex-1">{agent.description}</p>
                  <Button size="sm" variant="ghost" className="mt-3 self-start group-hover:text-primary transition-colors">
                    Iniciar
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
