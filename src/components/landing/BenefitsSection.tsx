import { motion } from "framer-motion";
import { Users, Target, Zap, BarChart3, MessageSquare, Palette } from "lucide-react";

const benefits = [
  {
    icon: Users,
    title: "Personas Profundas",
    description: "Micro-personas com dores, desejos, objeções e gatilhos de compra gerados por IA.",
  },
  {
    icon: Target,
    title: "Ofertas Irresistíveis",
    description: "Grand Slam Offers com Escada de Valor completa usando a equação de Hormozi.",
  },
  {
    icon: Zap,
    title: "Funil Automatizado",
    description: "Jornada do lead com gatilhos comportamentais, email sequences e lead scoring.",
  },
  {
    icon: MessageSquare,
    title: "Engajamento Humanizado",
    description: "Scripts de Epiphany Bridge e fluxos de conversa com qualificação BANT.",
  },
  {
    icon: BarChart3,
    title: "Copy que Converte",
    description: "Páginas de venda, sequências de email, hooks de anúncio e scripts de vídeo.",
  },
  {
    icon: Palette,
    title: "Criativos Profissionais",
    description: "Briefings visuais completos, prompts de imagem e specs por plataforma.",
  },
];

const BenefitsSection = () => {
  return (
    <section className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(231_70%_60%/0.05),transparent_70%)]" />
      <div className="container max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Tudo que Você Precisa em{" "}
            <span className="text-accent">Um Ecossistema</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            6 capacidades integradas que transformam dados em resultados reais.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, i) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass glass-hover rounded-2xl p-6 group cursor-default"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <benefit.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{benefit.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
