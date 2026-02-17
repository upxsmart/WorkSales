import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { Key, Shield, Bell, Settings2, RefreshCw, CheckCircle2, Trash2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const API_KEYS = [
  { name: "Anthropic (Claude)", masked: "sk-ant-•••••••VxQ", status: "Ativo" },
  { name: "Google AI (Nano Banana)", masked: "AIza•••••••8kP", status: "Ativo" },
  { name: "Stripe", masked: "sk_live_•••••••mN2", status: "Ativo" },
  { name: "Resend", masked: "re_•••••••qK7", status: "Ativo" },
];

const PLAN_LIMITS = [
  { label: "Interações/mês", starter: 50, professional: 200, scale: 500 },
  { label: "Criativos/mês", starter: 5, professional: 20, scale: 50 },
  { label: "Projetos", starter: 1, professional: 3, scale: 999 },
  { label: "Modelo LLM", starter: "Haiku 4.5", professional: "Sonnet 4.5", scale: "Sonnet+Opus" },
  { label: "Modelo Imagem", starter: "Flash", professional: "Pro 2K", scale: "Pro 2K/4K" },
];

const AdminSettings = () => {
  const [alerts, setAlerts] = useState({ costAlert: true, newUser: true, churnAlert: true, weeklyReport: false });
  const [email, setEmail] = useState("admin@worksales.com.br");
  const [budget, setBudget] = useState("150");

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <h1 className="font-display text-2xl font-bold">Configurações</h1>

        {/* API Keys */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Key className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">API Keys</h3>
          </div>
          <div className="space-y-4">
            {API_KEYS.map((k) => (
              <div key={k.name} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{k.masked}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {k.status}
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-xs">Rotacionar</Button>
                  <Button variant="ghost" size="sm" className="text-xs">Testar</Button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Plan Limits */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Settings2 className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Limites por Plano</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-2 font-medium">Recurso</th>
                  <th className="text-center py-2 font-medium text-cyan-400">Starter</th>
                  <th className="text-center py-2 font-medium text-primary">Professional</th>
                  <th className="text-center py-2 font-medium text-accent">Scale</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_LIMITS.map((row) => (
                  <tr key={row.label} className="border-b border-border/20">
                    <td className="py-3">{row.label}</td>
                    <td className="py-3 text-center">
                      {typeof row.starter === "number" ? (
                        <Input type="number" defaultValue={row.starter} className="w-20 mx-auto text-center h-8 text-xs" />
                      ) : (
                        <span className="text-muted-foreground text-xs">{row.starter}</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {typeof row.professional === "number" ? (
                        <Input type="number" defaultValue={row.professional} className="w-20 mx-auto text-center h-8 text-xs" />
                      ) : (
                        <span className="text-muted-foreground text-xs">{row.professional}</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {typeof row.scale === "number" ? (
                        <Input type="number" defaultValue={row.scale === 999 ? "∞" as any : row.scale} className="w-20 mx-auto text-center h-8 text-xs" />
                      ) : (
                        <span className="text-muted-foreground text-xs">{row.scale}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Alerts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Alertas e Notificações</h3>
          </div>
          <div className="space-y-4">
            {[
              { key: "costAlert", label: "Alerta de custo diário acima do budget" },
              { key: "newUser", label: "Notificação de novo usuário" },
              { key: "churnAlert", label: "Alerta de churn" },
              { key: "weeklyReport", label: "Relatório semanal automático" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label className="text-sm">{item.label}</Label>
                <Switch checked={alerts[item.key as keyof typeof alerts]} onCheckedChange={(v) => setAlerts((p) => ({ ...p, [item.key]: v }))} />
              </div>
            ))}
            <div className="pt-3 border-t border-border/30 space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground">Email para notificações</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Budget diário de API (R$)</Label>
                <Input value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1 w-32" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* System */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Sistema</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Operacional
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Versão</span>
              <span>v2.4.1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última atualização</span>
              <span>17 fev 2026, 10:32</span>
            </div>
            <div className="flex gap-3 pt-3 border-t border-border/30">
              <Button variant="outline" size="sm" className="gap-2"><Trash2 className="w-3 h-3" /> Limpar Cache</Button>
              <Button variant="outline" size="sm" className="gap-2"><Download className="w-3 h-3" /> Exportar Dados</Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
