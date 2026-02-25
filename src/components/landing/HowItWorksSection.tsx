import { motion } from "framer-motion";
import { Search, Cpu, Rocket } from "lucide-react";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Diagnóstico",
    description: "Responda 5 perguntas sobre seu negócio e a Luna mapeia seu público, concorrência e oportunidades.",
  },
  {
    icon: Cpu,
    step: "02",
    title: "Geração Integrada",
    description: "9 agentes trabalham em cadeia: Luna → Atlas → Flux → Verso → Pixel → Canvas → Closer → Radar → Maestro.",
  },
  {
    icon: Rocket,
    step: "03",
    title: "Estrutura Completa",
    description: "O Maestro compila tudo: ofertas, funil, copy, criativos e plano de ação priorizado.",
  },
];

const HowItWorksSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="container max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Como <span className="text-primary">Funciona</span>
          </h2>
          <p className="text-muted-foreground text-lg">3 passos simples para sua estrutura digital completa.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/40 to-transparent" />
              )}
              <div className="w-24 h-24 rounded-2xl glass mx-auto mb-6 flex items-center justify-center relative">
                <item.icon className="w-10 h-10 text-primary" />
                <span className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-accent text-accent-foreground font-display font-bold text-sm flex items-center justify-center">
                  {item.step}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
