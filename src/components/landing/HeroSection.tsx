import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(231_70%_60%/0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(38_92%_55%/0.08),transparent_50%)]" />
      
      <div className="container relative z-10 text-center max-w-5xl mx-auto pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
        >
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-sm text-muted-foreground">Plataforma #1 para Infoprodutores</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-5xl md:text-7xl font-bold leading-tight mb-6"
        >
          Construa Seu Império Digital com{" "}
          <span className="gradient-text">7 Agentes de IA</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed"
        >
          Do diagnóstico de audiência à orquestração completa do funil — 
          7 agentes especializados trabalham em ecossistema para criar sua 
          estrutura de negócio digital completa.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg" className="gradient-primary text-primary-foreground px-8 py-6 text-lg glow-primary" onClick={() => navigate("/auth")}>
            Começar Agora
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button variant="outline" size="lg" className="px-8 py-6 text-lg border-border/50 hover:border-primary/50">
            Ver Demonstração
          </Button>
        </motion.div>

        {/* Agent orbit visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-20 relative"
        >
          <div className="grid grid-cols-4 md:grid-cols-7 gap-3 max-w-2xl mx-auto">
            {["AA-D100", "AO-GO", "AJ-AF", "AE-C", "AM-CC", "AC-DC", "ACO"].map((code, i) => (
              <motion.div
                key={code}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2.5, delay: i * 0.2, repeat: Infinity, ease: "easeInOut" }}
                className="glass rounded-xl p-3 text-center glow-primary"
              >
                <span className="text-xs font-display font-bold text-primary">{code}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
