import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";

const STEPS = [
  { title: "Seu Nicho", subtitle: "Qual é o seu nicho de atuação?" },
  { title: "Seu Produto", subtitle: "Você já tem um produto digital?" },
  { title: "Seu Público", subtitle: "Descreva seu público-alvo ideal" },
  { title: "Seu Objetivo", subtitle: "Qual seu objetivo principal?" },
  { title: "Faturamento", subtitle: "Qual seu faturamento atual?" },
];

const OBJETIVOS = [
  "Lançar meu primeiro infoproduto",
  "Escalar meu faturamento atual",
  "Automatizar meu funil de vendas",
  "Criar uma esteira de produtos",
];

const FATURAMENTOS = [
  "Ainda não faturo",
  "Até R$5.000/mês",
  "R$5.000 a R$20.000/mês",
  "R$20.000 a R$100.000/mês",
  "Acima de R$100.000/mês",
];

const NICHOS_SUGESTOES = [
  "Marketing Digital", "Saúde e Bem-estar", "Finanças Pessoais",
  "Desenvolvimento Pessoal", "Educação", "Tecnologia",
];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    nicho: "",
    hasProduct: false,
    productDescription: "",
    publicoAlvo: "",
    objetivo: OBJETIVOS[0],
    faturamento: FATURAMENTOS[0],
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const progress = ((step + 1) / STEPS.length) * 100;

  const canAdvance = () => {
    if (step === 0) return data.nicho.trim().length > 0;
    if (step === 2) return data.publicoAlvo.trim().length > 0;
    return true;
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error: projectError } = await supabase.from("projects").insert({
        user_id: user.id,
        name: `Projeto ${data.nicho}`,
        nicho: data.nicho,
        has_product: data.hasProduct,
        product_description: data.productDescription || null,
        publico_alvo: data.publicoAlvo,
        objetivo: data.objetivo,
        faturamento: data.faturamento,
      });
      if (projectError) throw projectError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (step === STEPS.length - 1) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(231_70%_60%/0.15),transparent_50%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-4">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted-foreground">Passo {step + 1} de {STEPS.length}</span>
          </div>
          <Progress value={progress} className="h-2 mb-2" />
        </div>

        <div className="glass rounded-2xl p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-display text-2xl font-bold mb-1">{STEPS[step].title}</h2>
              <p className="text-muted-foreground text-sm mb-6">{STEPS[step].subtitle}</p>

              {/* Step 0: Nicho */}
              {step === 0 && (
                <div className="space-y-4">
                  <Input
                    value={data.nicho}
                    onChange={(e) => setData({ ...data, nicho: e.target.value })}
                    placeholder="Ex: Marketing Digital"
                  />
                  <div className="flex flex-wrap gap-2">
                    {NICHOS_SUGESTOES.map((n) => (
                      <button
                        key={n}
                        onClick={() => setData({ ...data, nicho: n })}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          data.nicho === n
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 1: Produto */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    {[true, false].map((val) => (
                      <button
                        key={String(val)}
                        onClick={() => setData({ ...data, hasProduct: val })}
                        className={`flex-1 py-4 rounded-xl border text-center transition-colors ${
                          data.hasProduct === val
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {val ? "Sim" : "Não"}
                      </button>
                    ))}
                  </div>
                  {data.hasProduct && (
                    <Textarea
                      value={data.productDescription}
                      onChange={(e) => setData({ ...data, productDescription: e.target.value })}
                      placeholder="Descreva brevemente seu produto..."
                      rows={3}
                    />
                  )}
                </div>
              )}

              {/* Step 2: Público */}
              {step === 2 && (
                <Textarea
                  value={data.publicoAlvo}
                  onChange={(e) => setData({ ...data, publicoAlvo: e.target.value })}
                  placeholder="Descreva quem é seu cliente ideal, suas dores e desejos..."
                  rows={4}
                />
              )}

              {/* Step 3: Objetivo */}
              {step === 3 && (
                <RadioGroup value={data.objetivo} onValueChange={(v) => setData({ ...data, objetivo: v })}>
                  {OBJETIVOS.map((obj) => (
                    <div key={obj} className="flex items-center space-x-3 p-3 rounded-xl border border-border hover:border-primary/50 transition-colors">
                      <RadioGroupItem value={obj} id={obj} />
                      <Label htmlFor={obj} className="cursor-pointer flex-1">{obj}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {/* Step 4: Faturamento */}
              {step === 4 && (
                <RadioGroup value={data.faturamento} onValueChange={(v) => setData({ ...data, faturamento: v })}>
                  {FATURAMENTOS.map((f) => (
                    <div key={f} className="flex items-center space-x-3 p-3 rounded-xl border border-border hover:border-primary/50 transition-colors">
                      <RadioGroupItem value={f} id={f} />
                      <Label htmlFor={f} className="cursor-pointer flex-1">{f}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button variant="outline" onClick={prev} className="flex-1 py-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            )}
            <Button
              onClick={next}
              disabled={!canAdvance() || loading}
              className="flex-1 gradient-primary text-primary-foreground py-6 glow-primary"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {step === STEPS.length - 1 ? "Finalizar" : "Continuar"}
              {!loading && step < STEPS.length - 1 && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
