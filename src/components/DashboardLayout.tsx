import { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard, FolderKanban, Bot, FileText, BarChart3,
  Settings, LogOut, Menu, X, Shield, Brain, FolderOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Meus Projetos", icon: FolderKanban, path: "/projects" },
  { label: "Agentes", icon: Bot, path: "/agents" },
  { label: "Orquestrador", icon: Brain, path: "/agent/ACO" },
  { label: "Métricas", icon: BarChart3, path: "/metrics" },
  { label: "Documentos", icon: FileText, path: "/documents" },
  { label: "Configurações", icon: Settings, path: "/settings" },
];


const DashboardLayout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{
    name: string;
    plan: string;
    interactions_used: number;
    interactions_limit: number;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingDemands, setPendingDemands] = useState(0);
  const { projects, activeProject, setActiveProjectId } = useActiveProject();
  useRealtimeNotifications(user?.id);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name, plan, interactions_used, interactions_limit")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as typeof profile);
      });
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  // Load pending demands count for active project
  useEffect(() => {
    if (!activeProject?.id) { setPendingDemands(0); return; }
    supabase
      .from("agent_demands")
      .select("id", { count: "exact", head: true })
      .eq("project_id", activeProject.id)
      .eq("status", "pending")
      .then(({ count }) => setPendingDemands(count || 0));
  }, [activeProject?.id]);

  // Realtime: listen for new demands on active project
  useEffect(() => {
    if (!activeProject?.id) return;
    const channel = supabase
      .channel(`demands-${activeProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_demands",
          filter: `project_id=eq.${activeProject.id}`,
        },
        () => {
          setPendingDemands((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agent_demands",
          filter: `project_id=eq.${activeProject.id}`,
        },
        () => {
          // Refresh count on any update
          supabase
            .from("agent_demands")
            .select("id", { count: "exact", head: true })
            .eq("project_id", activeProject.id)
            .eq("status", "pending")
            .then(({ count }) => setPendingDemands(count || 0));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeProject?.id]);



  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

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
            const isOrchestrador = item.path === "/agent/ACO";
            return (
              <button
                key={item.label}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {isOrchestrador && pendingDemands > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                    {pendingDemands > 99 ? "99+" : pendingDemands}
                  </span>
                )}
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

      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl px-6 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="font-display text-lg font-semibold hidden sm:block">
            Olá, {profile?.name || "Usuário"}! 👋
          </h2>
          <div className="flex-1" />
          {/* Project selector */}
          {projects.length > 0 ? (
            <Select value={activeProject?.id || ""} onValueChange={setActiveProjectId}>
              <SelectTrigger className="w-52 h-9 text-xs bg-card/50 border-border">
                <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecionar projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <button
              onClick={() => navigate("/projects")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/30"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Criar projeto
            </button>
          )}
          {/* Usage indicator */}
          {profile && (
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <span>{profile.interactions_used}/{profile.interactions_limit}</span>
              <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (profile.interactions_used / profile.interactions_limit) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium capitalize">
            {profile?.plan || "starter"}
          </span>
        </header>

        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
