import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MOCK_USERS } from "@/lib/adminMockData";

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-emerald-400" },
  trial: { label: "Trial", color: "bg-amber-400" },
  churned: { label: "Churned", color: "bg-destructive" },
};

const planBadge: Record<string, string> = {
  starter: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  professional: "bg-primary/20 text-primary border-primary/30",
  scale: "bg-accent/20 text-accent border-accent/30",
};

const AdminUsers = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = MOCK_USERS.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    if (filter === "all") return matchSearch;
    if (["active", "trial", "churned"].includes(filter)) return matchSearch && u.status === filter;
    return matchSearch && u.plan === filter;
  });

  const totalActive = MOCK_USERS.filter((u) => u.status === "active").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Gestão de Usuários</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{totalActive} ativos / {MOCK_USERS.length} total</span>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
                  <th className="text-right px-3 py-3 font-medium">MRR</th>
                  <th className="text-center px-3 py-3 font-medium">Agentes</th>
                  <th className="text-right px-3 py-3 font-medium">Interações</th>
                  <th className="text-right px-3 py-3 font-medium">Última Atividade</th>
                  <th className="text-right px-5 py-3 font-medium">Membro Desde</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const initials = u.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
                  const hue = (u.name.charCodeAt(0) * 37 + u.name.charCodeAt(1) * 13) % 360;
                  return (
                    <motion.tr key={u.email} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-border/20 hover:bg-secondary/30 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 40) % 360}, 70%, 40%))` }}>
                            {initials}
                          </div>
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={planBadge[u.plan]}>{u.plan.charAt(0).toUpperCase() + u.plan.slice(1)}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${statusMap[u.status].color}`} />
                          <span className="text-xs">{statusMap[u.status].label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium">{u.mrr > 0 ? `R$${u.mrr}` : "—"}</td>
                      <td className="px-3 py-3 text-center">{u.agents}/7</td>
                      <td className="px-3 py-3 text-right">{u.interactions}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground">{u.lastActivity}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{new Date(u.since).toLocaleDateString("pt-BR")}</td>
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
