import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Project {
  id: string;
  name: string;
  nicho: string | null;
  objetivo: string | null;
  publico_alvo: string | null;
  faturamento: string | null;
  has_product: boolean | null;
  product_description: string | null;
}

interface ActiveProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ActiveProjectContext = createContext<ActiveProjectContextType>({
  projects: [],
  activeProject: null,
  setActiveProjectId: () => {},
  loading: true,
  refresh: async () => {},
});

export const useActiveProject = () => useContext(ActiveProjectContext);

export const ActiveProjectProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projects")
      .select("id, name, nicho, objetivo, publico_alvo, faturamento, has_product, product_description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const list = (data as Project[]) || [];
    setProjects(list);

    // Restore saved active project or pick first
    const saved = localStorage.getItem(`active_project_${user.id}`);
    if (saved && list.find((p) => p.id === saved)) {
      setActiveId(saved);
    } else if (list.length > 0) {
      setActiveId(list[0].id);
    } else {
      setActiveId(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const setActiveProjectId = (id: string) => {
    setActiveId(id);
    if (user) localStorage.setItem(`active_project_${user.id}`, id);
  };

  const activeProject = projects.find((p) => p.id === activeId) || null;

  return (
    <ActiveProjectContext.Provider value={{ projects, activeProject, setActiveProjectId, loading, refresh: fetchProjects }}>
      {children}
    </ActiveProjectContext.Provider>
  );
};
