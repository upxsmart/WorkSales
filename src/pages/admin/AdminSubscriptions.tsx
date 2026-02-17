import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import { Check, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLAN_FEATURES, MOVEMENT_HISTORY } from "@/lib/adminMockData";

const planUserCounts: Record<string, number> = { starter: 45, professional: 38, scale: 12 };

const AdminSubscriptions = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">Assinaturas & Planos</h1>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(PLAN_FEATURES).map(([key, plan], i) => (
            <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass rounded-xl overflow-hidden"
            >
              <div className="h-1.5" style={{ background: plan.color }} />
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                  <Badge variant="outline">{planUserCounts[key]} users</Badge>
                </div>
                <p className="font-display text-3xl font-bold mb-5">
                  R${plan.price}<span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: plan.color }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full gap-2">
                  <Edit2 className="w-4 h-4" /> Editar Plano
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Movement History */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border/50">
            <h3 className="font-display font-semibold">Histórico de Movimentações</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left px-5 py-3 font-medium">Data</th>
                  <th className="text-left px-3 py-3 font-medium">Usuário</th>
                  <th className="text-left px-3 py-3 font-medium">Tipo</th>
                  <th className="text-center px-3 py-3 font-medium">De → Para</th>
                  <th className="text-right px-5 py-3 font-medium">Impacto</th>
                </tr>
              </thead>
              <tbody>
                {MOVEMENT_HISTORY.map((m, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/20 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-muted-foreground">{m.date}</td>
                    <td className="px-3 py-3 font-medium">{m.user}</td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={
                        m.type === "Churn" ? "border-destructive/30 text-destructive" :
                        m.type === "Upgrade" ? "border-primary/30 text-primary" :
                        "border-emerald-500/30 text-emerald-400"
                      }>{m.type}</Badge>
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{m.from} → {m.to}</td>
                    <td className={`px-5 py-3 text-right font-medium ${m.impact > 0 ? "text-emerald-400" : "text-destructive"}`}>
                      {m.impact > 0 ? "+" : ""}R${Math.abs(m.impact)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptions;
