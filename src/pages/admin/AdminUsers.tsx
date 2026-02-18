import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { Users, Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

type UserRow = {
  id: string;
  user_id: string;
  name: string;
  plan: string;
  plan_status: string;
  interactions_used: number;
  interactions_limit: number;
  creatives_used: number;
  creatives_limit: number;
  created_at: string;
  updated_at: string;
};

const statusMap: Record<string, { label: string; color: string }> = {
  active:    { label: "Ativo",   color: "bg-emerald-400" },
  trial:     { label: "Trial",   color: "bg-amber-400" },
  churned:   { label: "Churned", color: "bg-destructive" },
  cancelled: { label: "Cancelado", color: "bg-muted-foreground" },
};

const planBadge: Record<string, string> = {
  starter:      "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  professional: "bg-primary/20 text-primary border-primary/30",
  scale:        "bg-accent/20 text-accent border-accent/30",
};

const AdminUsers = () => {
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, name, plan, plan_status, interactions_used, interactions_limit, creatives_used, creatives_limit, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (!error && data) setUsers(data as UserRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.user_id.toLowerCase().includes(search.toLowerCase());
    if (filter === "all") return matchSearch;
    if (["active", "trial", "churned", "cancelled"].includes(filter))
      return matchSearch && u.plan_status === filter;
    return matchSearch && u.plan === filter;
  });

  const totalActive = users.filter((u) => u.plan_status === "active").length;

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : (name.slice(0, 2) || "??");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Gestão de Usuários</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchUsers}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{totalActive} ativos / {users.length} total</span>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="churned">Churned</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="scale">Scale</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User Table */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left px-5 py-3 font-medium">Usuário</th>
                  <th className="text-left px-3 py-3 font-medium">Plano</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                  <th className="text-right px-3 py-3 font-medium">Interações</th>
                  <th className="text-right px-3 py-3 font-medium">Criativos</th>
                  <th className="text-right px-5 py-3 font-medium">Membro Desde</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <div className="space-y-1">
                            <Skeleton className="w-28 h-3" />
                            <Skeleton className="w-40 h-2" />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><Skeleton className="w-20 h-5" /></td>
                      <td className="px-3 py-3"><Skeleton className="w-16 h-5" /></td>
                      <td className="px-3 py-3"><Skeleton className="w-16 h-3 ml-auto" /></td>
                      <td className="px-3 py-3"><Skeleton className="w-16 h-3 ml-auto" /></td>
                      <td className="px-5 py-3"><Skeleton className="w-20 h-3 ml-auto" /></td>
                    </tr>
                  ))}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground text-sm">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((u, i) => {
                    const initials = getInitials(u.name || "??");
                    const hue = (u.user_id.charCodeAt(0) * 37 + u.user_id.charCodeAt(1) * 13) % 360;
                    const status = statusMap[u.plan_status] || { label: u.plan_status, color: "bg-muted-foreground" };
                    return (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border/20 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{
                                background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 40) % 360}, 70%, 40%))`,
                              }}
                            >
                              {initials.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{u.name || "—"}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {u.user_id.slice(0, 8)}…
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant="outline"
                            className={planBadge[u.plan] || ""}
                          >
                            {u.plan.charAt(0).toUpperCase() + u.plan.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${status.color}`} />
                            <span className="text-xs">{status.label}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground">
                          {u.interactions_used}/{u.interactions_limit}
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground">
                          {u.creatives_used}/{u.creatives_limit}
                        </td>
                        <td className="px-5 py-3 text-right text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </td>
                      </motion.tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
