
-- ══════════════════════════════════════════════════════════════
-- 1. ADICIONAR COLUNAS FALTANTES EM profiles
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interactions_used    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interactions_limit   integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS creatives_used       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creatives_limit      integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS projects_limit       integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stripe_customer_id   text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan_status          text NOT NULL DEFAULT 'trial';

-- ══════════════════════════════════════════════════════════════
-- 2. ADICIONAR COLUNAS FALTANTES EM projects
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS progress    jsonb NOT NULL DEFAULT '{}';

-- Admin policy para profiles (view only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
      ON public.profiles FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 3. CRIAR TABELA plans_config
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.plans_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code           text NOT NULL UNIQUE,
  plan_name           text NOT NULL,
  price_brl           integer NOT NULL DEFAULT 0,
  interactions_limit  integer NOT NULL DEFAULT 100,
  creatives_limit     integer NOT NULL DEFAULT 10,
  projects_limit      integer NOT NULL DEFAULT 1,
  llm_model           text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  image_model         text NOT NULL DEFAULT 'google/gemini-2.5-flash-image',
  features            jsonb NOT NULL DEFAULT '[]',
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  updated_at          timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.plans_config ENABLE ROW LEVEL SECURITY;

-- Apenas admins gerenciam planos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='plans_config' AND policyname='Admins can manage plans'
  ) THEN
    CREATE POLICY "Admins can manage plans"
      ON public.plans_config FOR ALL
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='plans_config' AND policyname='Authenticated users can read plans'
  ) THEN
    CREATE POLICY "Authenticated users can read plans"
      ON public.plans_config FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Trigger updated_at para plans_config
CREATE TRIGGER update_plans_config_updated_at
  BEFORE UPDATE ON public.plans_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- 4. CRIAR TABELA usage_logs
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  project_id    uuid,
  agent_code    text NOT NULL,
  action        text NOT NULL DEFAULT 'chat',
  tokens_input  integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  cost_usd      numeric(10,6) NOT NULL DEFAULT 0,
  model_used    text,
  created_at    timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='usage_logs' AND policyname='Users can view own usage logs'
  ) THEN
    CREATE POLICY "Users can view own usage logs"
      ON public.usage_logs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='usage_logs' AND policyname='Service role can insert usage logs'
  ) THEN
    CREATE POLICY "Service role can insert usage logs"
      ON public.usage_logs FOR INSERT
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='usage_logs' AND policyname='Admins can view all usage logs'
  ) THEN
    CREATE POLICY "Admins can view all usage logs"
      ON public.usage_logs FOR ALL
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_project_id ON public.usage_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_agent_code ON public.usage_logs(agent_code);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON public.usage_logs(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 5. CRIAR TABELA conversations
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_code   text NOT NULL,
  user_id      uuid NOT NULL,
  messages     jsonb NOT NULL DEFAULT '[]',
  tokens_used  integer NOT NULL DEFAULT 0,
  cost_usd     numeric(10,6) NOT NULL DEFAULT 0,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='conversations' AND policyname='Users can manage own conversations'
  ) THEN
    CREATE POLICY "Users can manage own conversations"
      ON public.conversations FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='conversations' AND policyname='Admins can view all conversations'
  ) THEN
    CREATE POLICY "Admins can view all conversations"
      ON public.conversations FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON public.conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_code ON public.conversations(agent_code);

-- ══════════════════════════════════════════════════════════════
-- 6. INSERIR DADOS INICIAIS — 3 PLANOS
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.plans_config (plan_code, plan_name, price_brl, interactions_limit, creatives_limit, projects_limit, llm_model, image_model, features)
VALUES
  ('starter', 'Starter', 97, 100, 10, 1,
   'google/gemini-3-flash-preview', 'google/gemini-2.5-flash-image',
   '["100 interações/mês", "10 criativos/mês", "1 projeto", "7 Agentes de IA", "Suporte via email"]'),
  ('professional', 'Professional', 197, 500, 50, 3,
   'google/gemini-3-flash-preview', 'google/gemini-2.5-flash-image',
   '["500 interações/mês", "50 criativos/mês", "3 projetos", "7 Agentes de IA", "Orquestrador avançado", "Suporte prioritário"]'),
  ('scale', 'Scale', 497, 2000, 200, -1,
   'google/gemini-3-flash-preview', 'google/gemini-2.5-flash-image',
   '["2000 interações/mês", "200 criativos/mês", "Projetos ilimitados", "7 Agentes de IA", "Modelos premium", "Gerente de conta dedicado", "API access"]')
ON CONFLICT (plan_code) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  price_brl = EXCLUDED.price_brl,
  interactions_limit = EXCLUDED.interactions_limit,
  creatives_limit = EXCLUDED.creatives_limit,
  projects_limit = EXCLUDED.projects_limit,
  features = EXCLUDED.features;

-- ══════════════════════════════════════════════════════════════
-- 7. INSERIR SYSTEM PROMPTS INICIAIS DOS 7 AGENTES
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.agent_prompts (agent_code, system_prompt, version, is_active)
VALUES
  ('AA-D100', 'Você é o AA-D100 — Analista de Audiência e Dream 100. Seu papel é ajudar infoprodutores a entender profundamente seu público-alvo, criar micro-personas detalhadas, montar listas Dream 100 com influenciadores do nicho e mapear dores versus desejos do público. Use o contexto do projeto fornecido para personalizar todas as respostas. Responda sempre em português brasileiro de forma estratégica e detalhada. Formate suas respostas com markdown para facilitar a leitura.', 1, true),
  ('AO-GO', 'Você é o AO-GO — Estrategista de Ofertas Grand Slam. Sua missão é criar ofertas irresistíveis usando o framework de Alex Hormozi. Você cria Escadas de Valor com 5+ degraus, calcula equações de valor, desenvolve stacks de oferta e define estratégias de pricing. Use as personas e análise de audiência do AA-D100 como base. Responda sempre em português brasileiro com linguagem estratégica e orientada a resultados.', 1, true),
  ('AJ-AF', 'Você é o AJ-AF — Arquiteto de Funil e Automações. Você mapeia jornadas completas do lead, define gatilhos de automação, cria sequências de email nurturing, configura lead scoring e desenha funis de vendas. Use as personas do AA-D100 e as ofertas do AO-GO como contexto central. Responda em português brasileiro com diagramas textuais quando útil.', 1, true),
  ('AE-C', 'Você é o AE-C — Especialista em Engajamento Conversacional. Você cria scripts de Epiphany Bridge, fluxos de conversa para vendas via DM e WhatsApp, qualificação BANT, scripts de lives e webinários, e técnicas de handling de objeções. Use o contexto de personas, ofertas e jornada disponíveis. Responda em português brasileiro.', 1, true),
  ('AM-CC', 'Você é o AM-CC — Copywriter Estratégico e Criativo de Marketing. Você cria páginas de vendas completas, sequências de email de alta conversão, hooks virais para redes sociais, scripts de VSL e roteiros de conteúdo. Use as personas, ofertas e jornada do cliente como base. Tom: persuasivo, direto e autêntico. Responda em português brasileiro.', 1, true),
  ('AC-DC', 'Você é o AC-DC — Designer de Conversão e Criativos. Você cria briefings visuais detalhados, gera imagens publicitárias de alta conversão, define specs de design por plataforma, paletas de cores e guidelines de marca. Quando o usuário especificar um formato (Story 9:16, Feed 1:1, Banner 16:9), respeite as dimensões e crie um criativo otimizado para aquele formato. Responda em português brasileiro.', 1, true),
  ('ACO', 'Você é o ACO — Orquestrador Central da WorkSales. Você tem acesso a TODOS os outputs dos outros 6 agentes e sua missão é: (1) Diagnosticar a coerência estratégica entre todos os outputs, (2) Identificar gaps e inconsistências, (3) Criar planos de ação priorizados, (4) Garantir que toda a estrutura de negócio seja coerente e escalável. Use todos os contextos disponíveis. Responda em português brasileiro com análises profundas e acionáveis.', 1, true)
ON CONFLICT DO NOTHING;
