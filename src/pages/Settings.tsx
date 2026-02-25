import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  User, Mail, Crown, Shield, LogOut, Save, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const PLAN_INFO: Record<string, { label: string; color: string; features: string[] }> = {
  starter: {
    label: "Starter",
    color: "bg-muted text-muted-foreground",
    features: ["7 Agentes de IA", "1 Projeto", "Chat ilimitado", "Exportação básica"],
  },
  pro: {
    label: "Pro",
    color: "bg-primary/10 text-primary",
    features: ["Tudo do Starter", "Projetos ilimitados", "Outputs ilimitados", "Suporte prioritário"],
  },
  enterprise: {
    label: "Enterprise",
    color: "bg-accent/10 text-accent",
    features: ["Tudo do Pro", "API access", "White-label", "Gerente dedicado"],
  },
};

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("starter");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setEmail(user.email || "");
    supabase
      .from("profiles")
      .select("name, plan")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setName(data.name);
          setPlan(data.plan);
        }
        if (error) {
          console.error("Settings: failed to load profile", error);
        }
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado!" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const planData = PLAN_INFO[plan] || PLAN_INFO.starter;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold">Configurações</h2>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu perfil e preferências.</p>
      </div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-display font-semibold">Perfil</h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div>
            <Label>Email</Label>
            <div className="flex items-center gap-2">
              <Input value={email} disabled className="opacity-60" />
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">O email não pode ser alterado.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </Button>
        </div>
      </motion.div>

      {/* Plan */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold">Plano Atual</h3>
          </div>
          <Badge className={planData.color}>{planData.label}</Badge>
        </div>

        <ul className="space-y-2">
          {planData.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-3.5 h-3.5 text-primary" />
              {f}
            </li>
          ))}
        </ul>

        {plan === "starter" && (
          <Button variant="outline" className="gap-2 border-accent/30 text-accent hover:bg-accent/10">
            <Crown className="w-4 h-4" /> Fazer Upgrade
          </Button>
        )}
      </motion.div>

      <Separator />

      {/* Danger zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="font-display font-semibold text-destructive mb-3">Zona de Perigo</h3>
        <Button variant="outline" onClick={handleSignOut} className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10">
          <LogOut className="w-4 h-4" /> Sair da conta
        </Button>
      </motion.div>
    </div>
  );
};

export default Settings;
