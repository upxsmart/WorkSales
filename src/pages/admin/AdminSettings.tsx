import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion } from "framer-motion";
import {
  Key, Shield, Bell, Settings2, CheckCircle2, XCircle,
  Loader2, RefreshCw, Download, Trash2, Zap, Brain,
  ChevronDown, ChevronUp, Save, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────
type ApiStatus = "idle" | "testing" | "ok" | "error" | "missing";

interface ApiKey {
  id: string;
  name: string;
  secret_env: string;
  description: string;
  docsUrl: string;
  status: ApiStatus;
  latency?: number;
  errorMsg?: string;
  newValue?: string;
  showInput?: boolean;
}

interface PlanRow {
  id: string;
  plan_code: string;
  plan_name: string;
  price_brl: number;
  interactions_limit: number;
  creatives_limit: number;
  projects_limit: number;
  llm_model: string;
  image_model: string;
  is_active: boolean;
}

// ─── Constants ───────────────────────────────────────────
const LLM_MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Padrão)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (Anthropic)" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (Anthropic)" },
];

const IMAGE_MODELS = [
  { value: "google/gemini-2.5-flash-image", label: "Nano Banana / Gemini Flash Image" },
  { value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image (Preview)" },
];

const INITIAL_KEYS: ApiKey[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    secret_env: "ANTHROPIC_API_KEY",
    description: "Modelos Claude para os agentes de texto",
    docsUrl: "https://console.anthropic.com/settings/keys",
    status: "idle",
  },
  {
    id: "lovable_ai",
    name: "Lovable AI Gateway (Gemini / GPT)",
    secret_env: "LOVABLE_API_KEY",
    description: "Gateway Lovable para Gemini e modelos de imagem (Nano Banana)",
    docsUrl: "https://docs.lovable.dev/features/ai",
    status: "idle",
  },
  {
    id: "stripe",
    name: "Stripe",
    secret_env: "STRIPE_SECRET_KEY",
    description: "Processamento de pagamentos e assinaturas",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    status: "idle",
  },
  {
    id: "resend",
    name: "Resend",
    secret_env: "RESEND_API_KEY",
    description: "Envio de emails transacionais",
    docsUrl: "https://resend.com/api-keys",
    status: "idle",
  },
];

// ─── Component ───────────────────────────────────────────
const AdminSettings = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(INITIAL_KEYS);
  const [testingAll, setTestingAll] = useState(false);

  // Plans
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  // Alerts
  const [alerts, setAlerts] = useState({
    costAlert: true,
    newUser: true,
    churnAlert: true,
    weeklyReport: false,
  });
  const [email, setEmail] = useState("admin@worksales.com.br");
  const [budget, setBudget] = useState("150");

  // ─── Fetch plans ─────────────────────────────────────
  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase.from("plans_config").select("*").order("price_brl");
    if (data) setPlans(data as PlanRow[]);
  };

  // ─── Test APIs ───────────────────────────────────────
  const testAll = async () => {
    setTestingAll(true);
    setApiKeys((prev) => prev.map((k) => ({ ...k, status: "testing" as ApiStatus })));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-test-api`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "test" }),
        }
      );
      const json = await res.json();
      const results = json.results ?? {};

      setApiKeys((prev) =>
        prev.map((k) => {
          const r = results[k.id];
          if (!r) return k;
          return {
            ...k,
            status: r.status as ApiStatus,
            latency: r.latency,
            errorMsg: r.error,
          };
        })
      );
      toast.success("Teste de APIs concluído");
    } catch (e) {
      toast.error("Erro ao testar APIs");
      setApiKeys((prev) => prev.map((k) => ({ ...k, status: "idle" })));
    } finally {
      setTestingAll(false);
    }
  };

  const testSingle = async (id: string) => {
    setApiKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: "testing" } : k));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-test-api`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "test", api: id }),
        }
      );
      const json = await res.json();
      const r = json.results?.[id];
      if (r) {
        setApiKeys((prev) =>
          prev.map((k) =>
            k.id === id
              ? { ...k, status: r.status as ApiStatus, latency: r.latency, errorMsg: r.error }
              : k
          )
        );
        if (r.status === "ok") toast.success(`${id}: conexão OK (${r.latency}ms)`);
        else if (r.status === "missing") toast.warning(`${id}: chave não configurada`);
        else toast.error(`${id}: ${r.error}`);
      }
    } catch (e) {
      setApiKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: "error", errorMsg: String(e) } : k));
    }
  };

  // ─── Plan update ─────────────────────────────────────
  const updatePlanField = (planId: string, field: keyof PlanRow, value: unknown) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, [field]: value } : p))
    );
  };

  const savePlan = async (plan: PlanRow) => {
    setSavingPlan(plan.id);
    const { error } = await supabase
      .from("plans_config")
      .update({
        interactions_limit: plan.interactions_limit,
        creatives_limit: plan.creatives_limit,
        projects_limit: plan.projects_limit,
        price_brl: plan.price_brl,
        llm_model: plan.llm_model,
        image_model: plan.image_model,
        is_active: plan.is_active,
      })
      .eq("id", plan.id);

    setSavingPlan(null);
    if (error) toast.error("Erro ao salvar plano");
    else toast.success(`Plano ${plan.plan_name} atualizado!`);
  };

  // ─── Status badge helper ──────────────────────────────
  const StatusBadge = ({ status, latency, error }: { status: ApiStatus; latency?: number; error?: string }) => {
    if (status === "testing") return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Testando...
      </Badge>
    );
    if (status === "ok") return (
      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Ativo {latency ? `· ${latency}ms` : ""}
      </Badge>
    );
    if (status === "missing") return (
      <Badge variant="outline" className="border-amber-500/30 text-amber-400 gap-1">
        <AlertTriangle className="w-3 h-3" /> Não configurada
      </Badge>
    );
    if (status === "error") return (
      <Badge variant="outline" className="border-red-500/30 text-red-400 gap-1">
        <XCircle className="w-3 h-3" /> Erro
      </Badge>
    );
    return (
      <Badge variant="outline" className="border-border/50 text-muted-foreground gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Não testada
      </Badge>
    );
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="font-display text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie API keys, modelos e alertas do sistema.</p>
        </div>

        {/* ── API Keys ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold">API Keys</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={testAll}
              disabled={testingAll}
              className="gap-2 text-xs"
            >
              {testingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Testar Todas
            </Button>
          </div>

          <div className="space-y-4">
            {apiKeys.map((k) => (
              <div key={k.id} className="border border-border/30 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{k.name}</p>
                      <StatusBadge status={k.status} latency={k.latency} error={k.errorMsg} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{k.description}</p>
                    {k.status === "error" && k.errorMsg && (
                      <p className="text-xs text-red-400 mt-1 font-mono">{k.errorMsg}</p>
                    )}
                    {k.status === "missing" && (
                      <p className="text-xs text-amber-400 mt-1">
                        Configure a variável <span className="font-mono bg-secondary px-1 py-0.5 rounded">{k.secret_env}</span> nos{" "}
                        <a
                          href={`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_PROJECT_ID}/settings/functions`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          segredos do Supabase
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8"
                      onClick={() => testSingle(k.id)}
                      disabled={k.status === "testing"}
                    >
                      {k.status === "testing" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      <span className="ml-1">Testar</span>
                    </Button>
                    <a
                      href={k.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded hover:bg-secondary"
                    >
                      Docs ↗
                    </a>
                  </div>
                </div>
                {/* Env var label */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                    {k.secret_env}
                  </span>
                  <span className="text-xs text-muted-foreground">→ Supabase Secret</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-4 p-3 rounded-lg bg-secondary/30 border border-border/20">
            💡 Para cadastrar ou rotacionar chaves, acesse{" "}
            <a
              href={`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_PROJECT_ID}/settings/functions`}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Supabase → Edge Functions → Secrets
            </a>{" "}
            e insira o valor correspondente a cada variável acima.
          </p>
        </motion.div>

        {/* ── Modelos por Plano ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Modelos e Limites por Plano</h3>
          </div>

          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Carregando planos...</p>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`border rounded-xl p-5 space-y-4 transition-all ${
                    plan.plan_code === "starter"
                      ? "border-cyan-500/20"
                      : plan.plan_code === "professional"
                      ? "border-primary/30"
                      : "border-accent/30"
                  }`}
                >
                  {/* Plan header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h4 className="font-display font-semibold">{plan.plan_name}</h4>
                      <Badge
                        variant="outline"
                        className={
                          plan.plan_code === "starter"
                            ? "border-cyan-500/30 text-cyan-400"
                            : plan.plan_code === "professional"
                            ? "border-primary/40 text-primary"
                            : "border-accent/40 text-accent"
                        }
                      >
                        {plan.plan_code}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Ativo</Label>
                        <Switch
                          checked={plan.is_active}
                          onCheckedChange={(v) => updatePlanField(plan.id, "is_active", v)}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => savePlan(plan)}
                        disabled={savingPlan === plan.id}
                        className="gap-1.5 text-xs gradient-primary text-primary-foreground"
                      >
                        {savingPlan === plan.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>

                  {/* Fields grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Preço (R$)</Label>
                      <Input
                        type="number"
                        value={plan.price_brl}
                        onChange={(e) => updatePlanField(plan.id, "price_brl", Number(e.target.value))}
                        className="mt-1 h-8 text-sm bg-secondary/50"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Interações/mês</Label>
                      <Input
                        type="number"
                        value={plan.interactions_limit}
                        onChange={(e) => updatePlanField(plan.id, "interactions_limit", Number(e.target.value))}
                        className="mt-1 h-8 text-sm bg-secondary/50"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Criativos/mês</Label>
                      <Input
                        type="number"
                        value={plan.creatives_limit}
                        onChange={(e) => updatePlanField(plan.id, "creatives_limit", Number(e.target.value))}
                        className="mt-1 h-8 text-sm bg-secondary/50"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Projetos</Label>
                      <Input
                        type="number"
                        value={plan.projects_limit}
                        onChange={(e) => updatePlanField(plan.id, "projects_limit", Number(e.target.value))}
                        className="mt-1 h-8 text-sm bg-secondary/50"
                      />
                    </div>
                  </div>

                  {/* Model selects */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Modelo LLM (texto)</Label>
                      <select
                        value={plan.llm_model}
                        onChange={(e) => updatePlanField(plan.id, "llm_model", e.target.value)}
                        className="mt-1 w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {LLM_MODELS.map((m) => (
                          <option key={m.value} value={m.value} className="bg-background">
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Modelo de Imagem</Label>
                      <select
                        value={plan.image_model}
                        onChange={(e) => updatePlanField(plan.id, "image_model", e.target.value)}
                        className="mt-1 w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {IMAGE_MODELS.map((m) => (
                          <option key={m.value} value={m.value} className="bg-background">
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Alertas ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-6"
        >
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
                <Switch
                  checked={alerts[item.key as keyof typeof alerts]}
                  onCheckedChange={(v) => setAlerts((p) => ({ ...p, [item.key]: v }))}
                />
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

        {/* ── Sistema ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-xl p-6"
        >
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
              <span>18 fev 2026, 14:00</span>
            </div>
            <div className="flex gap-3 pt-3 border-t border-border/30">
              <Button variant="outline" size="sm" className="gap-2">
                <Trash2 className="w-3 h-3" /> Limpar Cache
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-3 h-3" /> Exportar Dados
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
