import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "97",
    description: "Para quem está começando no digital",
    highlight: false,
    features: [
      "3 Agentes de IA (AA-D100, AO-GO, AM-CC)",
      "Modelo Haiku 4.5 (rápido)",
      "1 projeto ativo",
      "Outputs básicos",
      "Suporte por email",
    ],
  },
  {
    name: "Pro",
    price: "297",
    description: "Para infoprodutores em crescimento",
    highlight: true,
    features: [
      "Todos os 7 Agentes de IA",
      "Modelo Sonnet 4.5 (avançado)",
      "5 projetos ativos",
      "Outputs completos + versões",
      "Orquestrador ACO incluso",
      "Suporte prioritário",
    ],
  },
  {
    name: "Enterprise",
    price: "997",
    description: "Para operações de escala",
    highlight: false,
    features: [
      "Tudo do Pro",
      "Modelo Opus 4.5 (decisões críticas)",
      "Projetos ilimitados",
      "API dedicada",
      "Onboarding personalizado",
      "Gerente de sucesso dedicado",
    ],
  },
];

const PricingSection = () => {
  return (
    <section className="py-24 px-4 relative" id="pricing">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(38_92%_55%/0.06),transparent_60%)]" />
      <div className="container max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Planos que <span className="text-accent">Crescem com Você</span>
          </h2>
          <p className="text-muted-foreground text-lg">Escolha o plano ideal para o seu momento.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl p-8 flex flex-col ${
                plan.highlight
                  ? "glass border-primary/50 glow-primary relative"
                  : "glass"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-accent text-accent-foreground text-xs font-bold font-display">
                  MAIS POPULAR
                </span>
              )}
              <h3 className="font-display text-2xl font-bold mb-1">{plan.name}</h3>
              <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-display font-bold">R${plan.price}</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full py-6 ${
                  plan.highlight
                    ? "gradient-primary text-primary-foreground glow-primary"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Começar com {plan.name}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
