// Mock data for admin dashboard demonstration

export const PLAN_COLORS = {
  starter: "hsl(186, 70%, 50%)",
  professional: "hsl(231, 70%, 60%)",
  scale: "hsl(38, 92%, 55%)",
};

export const PLAN_PRICES: Record<string, number> = {
  starter: 97,
  professional: 197,
  scale: 497,
};

export const monthlyRevenueData = Array.from({ length: 12 }, (_, i) => ({
  month: `Mês ${i + 1}`,
  receita: Math.round(12000 + i * 8500 + Math.random() * 3000),
  custo: Math.round(1800 + i * 1200 + Math.random() * 800),
}));

export const mrrHistory = Array.from({ length: 12 }, (_, i) => ({
  month: `M${i + 1}`,
  value: Math.round(12000 + i * 8500),
}));

export const recentActivity = [
  { type: "new" as const, user: "Lucas Mendes", plan: "Professional", impact: 197, date: "Hoje, 14:32" },
  { type: "upgrade" as const, user: "Ana Beatriz", plan: "Scale", impact: 300, date: "Hoje, 11:05" },
  { type: "churn" as const, user: "Carlos Ferreira", plan: "Starter", impact: -97, date: "Ontem, 18:22" },
  { type: "new" as const, user: "Marina Costa", plan: "Starter", impact: 97, date: "Ontem, 09:15" },
  { type: "upgrade" as const, user: "Rafael Lima", plan: "Professional", impact: 100, date: "2 dias atrás" },
  { type: "new" as const, user: "Juliana Rocha", plan: "Scale", impact: 497, date: "3 dias atrás" },
];

export const AGENTS = [
  { code: "AA-D100", name: "Análise de Audiência e Dream 100", mission: "Mapeia público-alvo, gera micro-personas, lista Dream 100", model: "Sonnet 4.5 (Haiku no Starter)", avgCost: 0.035, calls: 4250, tokens: 12750000, monthlyCost: 148.75 },
  { code: "AO-GO", name: "Otimização de Ofertas Grand Slam", mission: "Cria Grand Slam Offers aplicando Equação de Valor de Hormozi", model: "Sonnet 4.5", avgCost: 0.040, calls: 3100, tokens: 9300000, monthlyCost: 124.00 },
  { code: "AJ-AF", name: "Jornada e Automação de Funil", mission: "Arquiteta funil completo com gatilhos comportamentais e lead scoring", model: "Haiku 4.5", avgCost: 0.011, calls: 5800, tokens: 17400000, monthlyCost: 63.80 },
  { code: "AE-C", name: "Engajamento Conversacional", mission: "Interage com leads usando Epiphany Bridge Script de Brunson", model: "Sonnet 4.5", avgCost: 0.032, calls: 3800, tokens: 11400000, monthlyCost: 121.60 },
  { code: "AM-CC", name: "Marketing e Conteúdo Criativo", mission: "Gera copy, emails, scripts, anúncios em escala", model: "Sonnet 4.5", avgCost: 0.036, calls: 4600, tokens: 13800000, monthlyCost: 165.60 },
  { code: "AC-DC", name: "Design e Criativos", mission: "Gera briefings visuais e prompts de imagem para Nano Banana Pro", model: "Sonnet 4.5 + Nano Banana Pro", avgCost: 0.063, calls: 2200, tokens: 6600000, monthlyCost: 138.60 },
  { code: "ACO", name: "Orquestrador Central", mission: "Coordena todos os agentes, diagnostica gaps, otimiza o funil", model: "Sonnet 4.5 / Opus 4.5", avgCost: 0.069, calls: 1500, tokens: 4500000, monthlyCost: 103.50 },
];

export const MODEL_COSTS = [
  { name: "Claude Sonnet 4.5", pct: 71, color: "hsl(231, 70%, 60%)" },
  { name: "Claude Haiku 4.5", pct: 6, color: "hsl(186, 70%, 50%)" },
  { name: "Claude Opus 4.5", pct: 9, color: "hsl(280, 70%, 60%)" },
  { name: "Nano Banana Pro", pct: 14, color: "hsl(38, 92%, 55%)" },
];

export const OPTIMIZATIONS = [
  { name: "Prompt Caching", economy: 8420, detail: "~80% hit rate" },
  { name: "Batch API (ACO)", economy: 1845, detail: "50% desconto" },
  { name: "Haiku para AJ-AF", economy: 3200, detail: "Modelo otimizado" },
  { name: "Cache de Outputs", economy: 2100, detail: "Cross-agent" },
];

export const COST_BREAKDOWN = [
  { name: "Claude API (LLM)", value: 62, amount: 765.85 },
  { name: "Nano Banana Pro (Imagens)", value: 14, amount: 172.80 },
  { name: "Stripe Fees", value: 10, amount: 123.50 },
  { name: "Supabase + Infra", value: 8, amount: 99.00 },
  { name: "Resend (Email)", value: 4, amount: 49.40 },
  { name: "Outros", value: 2, amount: 24.70 },
];

export const MARGIN_PER_PLAN = [
  { plan: "Starter", price: 97, cost: 9.21, margin: 90.5, color: "hsl(186, 70%, 50%)" },
  { plan: "Professional", price: 197, cost: 50.58, margin: 74.3, color: "hsl(231, 70%, 60%)" },
  { plan: "Scale", price: 497, cost: 136.57, margin: 72.5, color: "hsl(38, 92%, 55%)" },
];

export const MOCK_USERS = [
  { name: "Lucas Mendes", email: "lucas@empresa.com", plan: "professional", status: "active", mrr: 197, agents: 7, interactions: 342, lastActivity: "15min", since: "2025-08-12" },
  { name: "Ana Beatriz", email: "ana.bea@gmail.com", plan: "scale", status: "active", mrr: 497, agents: 7, interactions: 1205, lastActivity: "2h atrás", since: "2025-06-03" },
  { name: "Carlos Ferreira", email: "carlos.f@outlook.com", plan: "starter", status: "churned", mrr: 0, agents: 3, interactions: 45, lastActivity: "32 dias", since: "2025-11-20" },
  { name: "Marina Costa", email: "marina@startup.io", plan: "starter", status: "trial", mrr: 0, agents: 3, interactions: 12, lastActivity: "1h atrás", since: "2026-02-15" },
  { name: "Rafael Lima", email: "rafael.lima@hotmail.com", plan: "professional", status: "active", mrr: 197, agents: 7, interactions: 567, lastActivity: "3h atrás", since: "2025-09-01" },
  { name: "Juliana Rocha", email: "juliana@agencia.com", plan: "scale", status: "active", mrr: 497, agents: 7, interactions: 890, lastActivity: "30min", since: "2025-07-22" },
  { name: "Pedro Santos", email: "pedro.s@empresa.com", plan: "professional", status: "active", mrr: 197, agents: 7, interactions: 234, lastActivity: "5h atrás", since: "2025-10-15" },
  { name: "Camila Oliveira", email: "camila@digital.co", plan: "starter", status: "active", mrr: 97, agents: 3, interactions: 78, lastActivity: "1 dia", since: "2025-12-01" },
  { name: "Diego Almeida", email: "diego@freelancer.com", plan: "starter", status: "trial", mrr: 0, agents: 3, interactions: 5, lastActivity: "4h atrás", since: "2026-02-10" },
  { name: "Fernanda Dias", email: "fer.dias@email.com", plan: "professional", status: "active", mrr: 197, agents: 7, interactions: 456, lastActivity: "20min", since: "2025-08-28" },
];

export const MOVEMENT_HISTORY = [
  { date: "17/02/2026", user: "Lucas Mendes", type: "Nova assinatura", from: "—", to: "Professional", impact: 197 },
  { date: "16/02/2026", user: "Ana Beatriz", type: "Upgrade", from: "Professional", to: "Scale", impact: 300 },
  { date: "15/02/2026", user: "Carlos Ferreira", type: "Churn", from: "Starter", to: "—", impact: -97 },
  { date: "14/02/2026", user: "Marina Costa", type: "Nova assinatura", from: "—", to: "Starter", impact: 97 },
  { date: "13/02/2026", user: "Rafael Lima", type: "Upgrade", from: "Starter", to: "Professional", impact: 100 },
  { date: "10/02/2026", user: "Juliana Rocha", type: "Nova assinatura", from: "—", to: "Scale", impact: 497 },
];

export const PLAN_FEATURES = {
  starter: {
    name: "STARTER",
    price: 97,
    color: "hsl(186, 70%, 50%)",
    features: [
      "1 projeto ativo",
      "3 agentes: AA-D100, AO-GO, AM-CC",
      "50 interações LLM/mês",
      "5 criativos (imagens)/mês",
      "Modelo: Haiku 4.5 + Nano Banana Flash",
      "Sem Orquestrador (ACO)",
      "Export: Markdown",
    ],
  },
  professional: {
    name: "PROFESSIONAL",
    price: 197,
    color: "hsl(231, 70%, 60%)",
    features: [
      "3 projetos ativos",
      "Todos os 7 agentes",
      "200 interações LLM/mês",
      "20 criativos/mês",
      "Modelo: Sonnet 4.5 + Nano Banana Pro 2K",
      "ACO: Diagnóstico",
      "Export: Markdown + JSON",
    ],
  },
  scale: {
    name: "SCALE",
    price: 497,
    color: "hsl(38, 92%, 55%)",
    features: [
      "Projetos ilimitados",
      "Todos os 7 agentes + acesso API",
      "500 interações LLM/mês",
      "50 criativos/mês",
      "Modelo: Sonnet 4.5 + Opus sob demanda + Nano Banana Pro 2K/4K",
      "ACO: Diagnóstico + Otimização contínua",
      "Export: Todos + API",
    ],
  },
};
