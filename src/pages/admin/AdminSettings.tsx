import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, Shield, Bell, Settings2, Brain,
  Loader2, RefreshCw, Download, Trash2, Zap,
  Save, AlertTriangle, XCircle, Eye, EyeOff,
  CheckCircle2, Lock,
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

interface ApiKeyConfig {
  id: string;
  name: string;
  key_name: string;
  description: string;
  docsUrl: string;
  placeholder: string;
  isAutomatic?: boolean;
  // runtime state
  status: ApiStatus;
  latency?: number;
  errorMsg?: string;
  hasValue: boolean;
  maskedValue: string;
  lastTestedAt?: string;
  // editing
  editing: boolean;
  inputValue: string;
  showInput: boolean;
  saving: boolean;
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
  meta_ads_enabled: boolean;
  meta_ads_syncs_per_day: number;
}

// ─── Constants ───────────────────────────────────────────
const LLM_MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash Preview (Padrão)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (Anthropic)" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (Anthropic)" },
];

const IMAGE_MODELS = [
  { value: "google/gemini-2.5-flash-image", label: "Nano Banana / Gemini Flash Image" },
  { value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image (Preview)" },
];

const INITIAL_KEYS: Omit<ApiKeyConfig, "status" | "hasValue" | "maskedValue" | "editing" | "inputValue" | "showInput" | "saving">[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    key_name: "ANTHROPIC_API_KEY",
    description: "Modelos Claude Haiku e Sonnet para os agentes de texto",
    docsUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-api03-...",
  },
  {
    id: "lovable_ai",
    name: "Lovable AI Gateway",
    key_name: "LOVABLE_API_KEY",
    description: "Gemini e modelos de imagem via gateway Lovable — gerenciado automaticamente",
    docsUrl: "https://docs.lovable.dev/features/ai",
    placeholder: "Automático",
    isAutomatic: true,
  },
  {
    id: "google_ai",
    name: "Google AI Studio (Banana Pro)",
    key_name: "GOOGLE_API_KEY",
    description: "Chave própria do Google AI Studio para geração de imagens com Banana Pro (gemini-3-pro-image-preview) — substitui o gateway Lovable para criativos",
    docsUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza...",
  },
  {
    id: "stripe",
    name: "Stripe",
    key_name: "STRIPE_SECRET_KEY",
    description: "Processamento de pagamentos e assinaturas",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    placeholder: "sk_live_...",
  },
  {
    id: "resend",
    name: "Resend",
    key_name: "RESEND_API_KEY",
    description: "Envio de emails transacionais",
    docsUrl: "https://resend.com/api-keys",
    placeholder: "re_...",
  },
];

function maskKey(value: string): string {
  if (!value || value.length < 8) return "••••••••";
  return value.slice(0, 8) + "•".repeat(Math.min(value.length - 12, 16)) + value.slice(-4);
}

// ─── StatusBadge helper (plain function, not hook) ───────
function StatusBadge({ status, latency }: { status: ApiStatus; latency?: number }) {
  if (status === "testing") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Testando...
      </Badge>
    );
  }
  if (status === "ok") {
    return (
      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        OK {latency ? `· ${latency}ms` : ""}
      </Badge>
    );
  }
  if (status === "missing") {
    return (
      <Badge variant="outline" className="border-amber-500/30 text-amber-400 gap-1">
        <AlertTriangle className="w-3 h-3" /> Não configurada
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="outline" className="border-destructive/40 text-destructive gap-1">
        <XCircle className="w-3 h-3" /> Erro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-border/40 text-muted-foreground gap-1">
      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" /> Não testada
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────
const AdminSettings = () => {
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>(
    INITIAL_KEYS.map((k) => ({
      ...k,
      status: "idle",
      hasValue: false,
      maskedValue: "••••••••",
      editing: false,
      inputValue: "",
      showInput: false,
      saving: false,
    }))
  );
  const [testingAll, setTestingAll] = useState(false);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  const [alerts, setAlerts] = useState({
    costAlert: true, newUser: true, churnAlert: true, weeklyReport: false,
  });
  const [email, setEmail] = useState("admin@worksales.com.br");
  const [budget, setBudget] = useState("150");

  // ─── Load existing key metadata (masked) ──────────────
  useEffect(() => {
    loadKeyStatuses();
    fetchPlans();
  }, []);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const loadKeyStatuses = async () => {
    const { data } = await supabase
      .from("api_configs")
      .select("key_name, key_value, last_tested_at, last_test_status, is_active");

    if (!data) return;

    setApiKeys((prev) =>
      prev.map((k) => {
        const row = data.find((r) => r.key_name === k.key_name);
        if (!row) return k;
        const hasValue = !!row.key_value && row.key_value.length > 0;
        return {
          ...k,
          hasValue,
          maskedValue: hasValue ? maskKey(row.key_value) : "Não configurada",
          status: row.last_test_status === "ok" ? "ok" :
                  row.last_test_status === "error" ? "error" :
                  hasValue ? "idle" : "missing",
          lastTestedAt: row.last_tested_at || undefined,
        };
      })
    );
  };

  // ─── Save a key ───────────────────────────────────────
  const saveKey = async (keyId: string) => {
    const k = apiKeys.find((x) => x.id === keyId);
    if (!k || !k.inputValue.trim()) return;

    setApiKeys((prev) => prev.map((x) => x.id === keyId ? { ...x, saving: true } : x));

    const token = await getToken();
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-test-api`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "save_key",
            key_name: k.key_name,
            key_value: k.inputValue.trim(),
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        toast.success(`${k.name} salva com sucesso!`);
        setApiKeys((prev) =>
          prev.map((x) =>
            x.id === keyId
              ? {
                  ...x,
                  saving: false,
                  editing: false,
                  inputValue: "",
                  showInput: false,
                  hasValue: true,
                  maskedValue: maskKey(k.inputValue.trim()),
                  status: "idle",
                }
              : x
          )
        );
      } else {
        toast.error(json.error || "Erro ao salvar chave");
        setApiKeys((prev) => prev.map((x) => x.id === keyId ? { ...x, saving: false } : x));
      }
    } catch {
      toast.error("Erro de conexão ao salvar chave");
      setApiKeys((prev) => prev.map((x) => x.id === keyId ? { ...x, saving: false } : x));
    }
  };

  // ─── Test all APIs ────────────────────────────────────
  const testAll = async () => {
    setTestingAll(true);
    setApiKeys((prev) => prev.map((k) => ({ ...k, status: "testing" as ApiStatus })));
    const token = await getToken();
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-test-api`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test" }),
        }
      );
      const json = await res.json();
      const results = json.results ?? {};
      setApiKeys((prev) =>
        prev.map((k) => {
          const r = results[k.id];
          if (!r) return { ...k, status: "idle" as ApiStatus };
          return { ...k, status: r.status as ApiStatus, latency: r.latency, errorMsg: r.error };
        })
      );
      toast.success("Teste concluído");
    } catch {
      toast.error("Erro ao testar APIs");
      setApiKeys((prev) => prev.map((k) => ({ ...k, status: "idle" })));
    } finally {
      setTestingAll(false);
    }
  };

  const testSingle = async (keyId: string) => {
    const k = apiKeys.find((x) => x.id === keyId);
    if (!k) return;
    setApiKeys((prev) => prev.map((x) => x.id === keyId ? { ...x, status: "testing" } : x));
    const token = await getToken();
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-test-api`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test", api: keyId }),
        }
      );
      const json = await res.json();
      const r = json.results?.[keyId];
      if (r) {
        setApiKeys((prev) =>
          prev.map((x) => x.id === keyId
            ? { ...x, status: r.status as ApiStatus, latency: r.latency, errorMsg: r.error }
            : x
          )
        );
        if (r.status === "ok") toast.success(`${k.name}: OK (${r.latency}ms)`);
        else if (r.status === "missing") toast.warning(`${k.name}: chave não configurada`);
        else toast.error(`${k.name}: ${r.error}`);
      }
    } catch {
      setApiKeys((prev) => prev.map((x) => x.id === keyId ? { ...x, status: "error" } : x));
    }
  };

  // ─── Plans ────────────────────────────────────────────
  const fetchPlans = async () => {
    const { data } = await supabase.from("plans_config").select("*").order("price_brl");
    if (data) setPlans(data as PlanRow[]);
  };

  const updatePlanField = (planId: string, field: keyof PlanRow, value: unknown) => {
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, [field]: value } : p)));
  };

  const savePlan = async (plan: PlanRow) => {
    setSavingPlan(plan.id);
    const { error } = await supabase.from("plans_config").update({
      interactions_limit: plan.interactions_limit,
      creatives_limit: plan.creatives_limit,
      projects_limit: plan.projects_limit,
      price_brl: plan.price_brl,
      llm_model: plan.llm_model,
      image_model: plan.image_model,
      is_active: plan.is_active,
      meta_ads_enabled: plan.meta_ads_enabled,
      meta_ads_syncs_per_day: plan.meta_ads_syncs_per_day,
    }).eq("id", plan.id);
    setSavingPlan(null);
    if (error) toast.error("Erro ao salvar plano");
    else toast.success(`Plano ${plan.plan_name} atualizado!`);
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="font-display text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie API keys, modelos e alertas do sistema.</p>
        </div>

        {/* ── API Keys ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold">API Keys</h3>
            </div>
            <Button size="sm" variant="outline" onClick={testAll} disabled={testingAll} className="gap-2 text-xs">
              {testingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Testar Todas
            </Button>
          </div>

          <div className="space-y-3">
            {apiKeys.map((k) => (
              <div key={k.id} className="border border-border/30 rounded-xl overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{k.name}</span>
                      {k.isAutomatic && (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1">
                          <Lock className="w-2.5 h-2.5" /> Automático
                        </Badge>
                      )}
                      <StatusBadge status={k.status} latency={k.latency} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{k.description}</p>

                    {/* Masked value */}
                    {!k.isAutomatic && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                          {k.maskedValue}
                        </span>
                        {k.lastTestedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Testada em {new Date(k.lastTestedAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Error message */}
                    {k.status === "error" && k.errorMsg && (
                      <p className="text-xs text-destructive mt-1 font-mono">{k.errorMsg}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!k.isAutomatic && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 gap-1.5"
                        onClick={() =>
                          setApiKeys((prev) =>
                            prev.map((x) =>
                              x.id === k.id
                                ? { ...x, editing: !x.editing, inputValue: "", showInput: false }
                                : x
                            )
                          )
                        }
                      >
                        <RefreshCw className="w-3 h-3" />
                        {k.hasValue ? "Rotacionar" : "Configurar"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8"
                      onClick={() => testSingle(k.id)}
                      disabled={k.status === "testing"}
                    >
                      {k.status === "testing" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
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

                {/* Edit form */}
                <AnimatePresence>
                  {k.editing && !k.isAutomatic && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border/30 bg-secondary/20 px-4 py-3"
                    >
                      <p className="text-xs text-muted-foreground mb-2">
                        Digite a nova chave para <span className="font-mono text-foreground">{k.key_name}</span>. O valor anterior será substituído.
                      </p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={k.showInput ? "text" : "password"}
                            placeholder={k.placeholder}
                            value={k.inputValue}
                            onChange={(e) =>
                              setApiKeys((prev) =>
                                prev.map((x) => x.id === k.id ? { ...x, inputValue: e.target.value } : x)
                              )
                            }
                            className="pr-9 font-mono text-sm bg-background"
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setApiKeys((prev) =>
                                prev.map((x) => x.id === k.id ? { ...x, showInput: !x.showInput } : x)
                              )
                            }
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {k.showInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => saveKey(k.id)}
                          disabled={!k.inputValue.trim() || k.saving}
                          className="gap-1.5 gradient-primary text-primary-foreground"
                        >
                          {k.saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setApiKeys((prev) =>
                              prev.map((x) => x.id === k.id ? { ...x, editing: false, inputValue: "" } : x)
                            )
                          }
                        >
                          Cancelar
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
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
                  className={`border rounded-xl p-5 space-y-4 ${
                    plan.plan_code === "starter" ? "border-cyan-500/20" :
                    plan.plan_code === "professional" ? "border-primary/30" : "border-accent/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h4 className="font-display font-semibold">{plan.plan_name}</h4>
                      <Badge
                        variant="outline"
                        className={
                          plan.plan_code === "starter" ? "border-cyan-500/30 text-cyan-400" :
                          plan.plan_code === "professional" ? "border-primary/40 text-primary" :
                          "border-accent/40 text-accent"
                        }
                      >
                        {plan.plan_code}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Ativo</Label>
                        <Switch checked={plan.is_active} onCheckedChange={(v) => updatePlanField(plan.id, "is_active", v)} />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => savePlan(plan)}
                        disabled={savingPlan === plan.id}
                        className="gap-1.5 text-xs gradient-primary text-primary-foreground"
                      >
                        {savingPlan === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Salvar
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Preço (R$)", field: "price_brl" as keyof PlanRow },
                      { label: "Interações/mês", field: "interactions_limit" as keyof PlanRow },
                      { label: "Criativos/mês", field: "creatives_limit" as keyof PlanRow },
                      { label: "Projetos", field: "projects_limit" as keyof PlanRow },
                    ].map(({ label, field }) => (
                      <div key={field}>
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <Input
                          type="number"
                          value={plan[field] as number}
                          onChange={(e) => updatePlanField(plan.id, field, Number(e.target.value))}
                          className="mt-1 h-8 text-sm bg-secondary/50"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Modelo LLM (texto)</Label>
                      <select
                        value={plan.llm_model}
                        onChange={(e) => updatePlanField(plan.id, "llm_model", e.target.value)}
                        className="mt-1 w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {LLM_MODELS.map((m) => (
                          <option key={m.value} value={m.value} className="bg-background">{m.label}</option>
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
                          <option key={m.value} value={m.value} className="bg-background">{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── Meta Ads ── */}
                  <div className="border-t border-border/30 pt-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Switch
                        checked={plan.meta_ads_enabled ?? false}
                        onCheckedChange={(v) => updatePlanField(plan.id, "meta_ads_enabled", v)}
                      />
                      <Label className="text-sm cursor-pointer">
                        Meta Ads habilitado
                      </Label>
                      {plan.meta_ads_enabled && (
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    {plan.meta_ads_enabled && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Syncs/dia</Label>
                        <Input
                          type="number"
                          min={0}
                          max={96}
                          value={plan.meta_ads_syncs_per_day ?? 0}
                          onChange={(e) => updatePlanField(plan.id, "meta_ads_syncs_per_day", Number(e.target.value))}
                          className="h-8 w-20 text-sm bg-secondary/50"
                        />
                      </div>
                    )}
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
              <span>18 fev 2026</span>
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
