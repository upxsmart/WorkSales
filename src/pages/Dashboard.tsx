import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  LayoutDashboard, FolderKanban, Bot, FileText, BarChart3,
  Settings, LogOut, ChevronRight, Menu, X, Shield, Brain,
} from "lucide-react";
import { AGENTS_CONFIG, AgentCode } from "@/lib/agents";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

const AGENTS = Object.values(AGENTS_CONFIG);

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Meus Projetos", icon: FolderKanban, path: "/projects" },
  { label: "Agentes", icon: Bot, path: "/agents" },
  { label: "Orquestrador", icon: Brain, path: "/agent/ACO" },
  { label: "Métricas", icon: BarChart3, path: "/metrics" },
  { label: "Documentos", icon: FileText, path: "/documents" },
  { label: "Configurações", icon: Settings, path: "/settings" },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{ name: string; plan: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  useRealtimeNotifications(user?.id);

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
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
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
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-1">
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-accent hover:bg-sidebar-accent transition-colors"
            >
              <Shield className="w-4 h-4" />
              Painel Admin
            </button>
          )}
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
      </main>
    </div>
  );
};

export default Dashboard;
