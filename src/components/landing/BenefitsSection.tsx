import { motion } from "framer-motion";
import { Users, Target, Zap, MessageSquare, PenTool, Palette, Megaphone, ImagePlay, Brain } from "lucide-react";

const benefits = [
  {
    icon: Users,
    agent: "Luna",
    title: "Audiência & Personas",
    description: "Luna investiga seu público a fundo: micro-personas, Dream 100 e mapa de dores × desejos.",
  },
  {
    icon: Target,
    agent: "Atlas",
    title: "Ofertas Grand Slam",
    description: "Atlas constrói ofertas irresistíveis com Escada de Valor e equação de Hormozi.",
  },
  {
    icon: Zap,
    agent: "Flux",
    title: "Funil Inteligente",
    description: "Flux projeta funis com gatilhos comportamentais, sequências de email e lead scoring.",
  },
  {
    icon: PenTool,
    agent: "Verso",
    title: "Copy que Converte",
    description: "Verso escreve páginas de venda, hooks virais, VSL e sequências de email de alta conversão.",
  },
  {
    icon: Palette,
    agent: "Pixel",
    title: "Criativos & Identidade",
    description: "Pixel dirige sua identidade visual com briefings, prompts de IA e specs por plataforma.",
  },
  {
    icon: MessageSquare,
    agent: "Closer",
    title: "Scripts de Vendas",
    description: "Closer cria scripts de Epiphany Bridge e fluxos de conversa com qualificação BANT.",
  },
  {
    icon: Megaphone,
    agent: "Radar",
    title: "Tráfego Pago",
    description: "Radar planeja e otimiza suas campanhas Meta Ads com foco em CPL, ROAS e conversão.",
  },
  {
    icon: ImagePlay,
    agent: "Canvas",
    title: "Imagens HD",
    description: "Canvas transforma briefings em criativos publicitários prontos para publicar.",
  },
  {
    icon: Brain,
    agent: "Maestro",
    title: "Orquestração Total",
    description: "Maestro coordena toda a equipe e compila seu plano completo de negócio digital.",
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
            Sua Equipe de IA em{" "}
            <span className="text-accent">Um Ecossistema</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            9 agentes especializados que trabalham juntos para construir seu negócio digital.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, i) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass glass-hover rounded-2xl p-6 group cursor-default"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs font-display font-semibold text-accent uppercase tracking-wider">{benefit.agent}</span>
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
