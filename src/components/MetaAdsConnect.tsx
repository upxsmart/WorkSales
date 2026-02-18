import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, CheckCircle2, AlertCircle, Loader2, ExternalLink,
  Unplug, RefreshCw, HelpCircle, Eye, EyeOff,
} from "lucide-react";

const META_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-ads-proxy`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type MetaConnection = {
  connected: boolean;
  ad_account_id?: string;
  page_id?: string;
  last_sync_at?: string;
};

type Props = {
  projectId: string;
};

export default function MetaAdsConnect({ projectId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [connection, setConnection] = useState<MetaConnection>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [form, setForm] = useState({
    access_token: "",
    ad_account_id: "",
    pixel_id: "",
    page_id: "",
    instagram_account_id: "",
  });

  const checkConnection = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(META_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ project_id: projectId, action: "get_connection_status" }),
      });
      const data = await res.json();
      setConnection(data);
    } catch {
      setConnection({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkConnection(); }, [projectId]);

  const handleSave = async () => {
    if (!form.access_token.trim() || !form.ad_account_id.trim()) {
      toast({ title: "Campos obrigatórios", description: "Access Token e ID da Conta são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(META_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          action: "save_connection",
          params: form,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Erro de conexão", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "🟢 Meta Ads conectado!", description: `Conta: ${data.meta_user?.name || form.ad_account_id}` });
        setShowForm(false);
        setForm({ access_token: "", ad_account_id: "", pixel_id: "", page_id: "", instagram_account_id: "" });
        await checkConnection();
      }
    } catch {
      toast({ title: "Erro", description: "Não foi possível conectar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    await fetch(META_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ project_id: projectId, action: "disconnect" }),
    });
    setConnection({ connected: false });
    toast({ title: "Desconectado", description: "Meta Ads desvinculado deste projeto." });
  };

  if (loading) {
    return (
      <div className="glass rounded-xl p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Verificando conexão Meta Ads...</span>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold">Meta Ads</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {connection.connected ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] text-green-400 font-medium">Conectado</span>
                  {connection.ad_account_id && (
                    <span className="text-[10px] text-muted-foreground">· {connection.ad_account_id}</span>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Não conectado</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {connection.connected ? (
            <>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={checkConnection}>
                <RefreshCw className="w-3 h-3 mr-1" /> Sincronizar
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={handleDisconnect}>
                <Unplug className="w-3 h-3 mr-1" /> Desconectar
              </Button>
            </>
          ) : (
            <Button size="sm" className="text-xs h-7 gradient-primary text-primary-foreground" onClick={() => setShowForm(!showForm)}>
              <Megaphone className="w-3 h-3 mr-1" /> Conectar
            </Button>
          )}
        </div>
      </div>

      {connection.connected && connection.last_sync_at && (
        <div className="text-[10px] text-muted-foreground">
          Última sincronização: {new Date(connection.last_sync_at).toLocaleString("pt-BR")}
        </div>
      )}

      <AnimatePresence>
        {showForm && !connection.connected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 pt-3 border-t border-border"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Você precisa de um App no Meta for Developers com permissões: ads_management, ads_read</span>
              <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                Ver docs <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium">ID da Conta de Anúncios *</label>
                <Input
                  placeholder="Ex: 123456789 (sem o act_)"
                  value={form.ad_account_id}
                  onChange={(e) => setForm({ ...form, ad_account_id: e.target.value })}
                  className="h-8 text-xs bg-secondary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium">Access Token *</label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="EAAxxxx... (User ou System User Token)"
                    value={form.access_token}
                    onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                    className="h-8 text-xs bg-secondary/50 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">Page ID (Facebook)</label>
                  <Input
                    placeholder="ID da sua Página"
                    value={form.page_id}
                    onChange={(e) => setForm({ ...form, page_id: e.target.value })}
                    className="h-8 text-xs bg-secondary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">Pixel ID</label>
                  <Input
                    placeholder="ID do Pixel"
                    value={form.pixel_id}
                    onChange={(e) => setForm({ ...form, pixel_id: e.target.value })}
                    className="h-8 text-xs bg-secondary/50"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium">Instagram Account ID (opcional)</label>
                <Input
                  placeholder="ID da conta do Instagram"
                  value={form.instagram_account_id}
                  onChange={(e) => setForm({ ...form, instagram_account_id: e.target.value })}
                  className="h-8 text-xs bg-secondary/50"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className="text-xs h-8 gradient-primary text-primary-foreground">
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3 h-3 mr-1.5" />}
                {saving ? "Conectando e validando..." : "Conectar e Salvar"}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
