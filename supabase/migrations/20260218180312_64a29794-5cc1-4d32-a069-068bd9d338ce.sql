
-- 1. Colunas novas em projects para o orquestrador
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS big_idea TEXT,
  ADD COLUMN IF NOT EXISTS orchestrator_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS orchestrator_current_agent TEXT,
  ADD COLUMN IF NOT EXISTS master_plan JSONB DEFAULT '{}';

-- 2. Tabela de execuções do orquestrador
CREATE TABLE IF NOT EXISTS public.orchestrator_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  big_idea TEXT NOT NULL,
  collected_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'running',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 8,
  agent_results JSONB DEFAULT '{}',
  master_plan JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.orchestrator_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own orchestrator runs" ON public.orchestrator_runs
  FOR ALL USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  )
  WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- 3. Tabela conexões Meta Ads
CREATE TABLE IF NOT EXISTS public.meta_ads_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  meta_app_id TEXT,
  access_token TEXT NOT NULL DEFAULT '',
  ad_account_id TEXT NOT NULL DEFAULT '',
  pixel_id TEXT,
  page_id TEXT,
  instagram_account_id TEXT,
  token_expires_at TIMESTAMPTZ,
  connection_status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_id)
);

ALTER TABLE public.meta_ads_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meta connections" ON public.meta_ads_connections
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Cache de dados da Meta Ads API
CREATE TABLE IF NOT EXISTS public.meta_ads_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL,
  meta_object_id TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '1 hour'
);

ALTER TABLE public.meta_ads_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meta cache" ON public.meta_ads_cache
  FOR ALL USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  )
  WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- 5. Log de ações Meta Ads
CREATE TABLE IF NOT EXISTS public.meta_ads_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  meta_object_id TEXT,
  request_payload JSONB DEFAULT '{}',
  response_payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  executed_at TIMESTAMPTZ
);

ALTER TABLE public.meta_ads_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meta actions" ON public.meta_ads_actions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all meta actions" ON public.meta_ads_actions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Demandas entre agentes
CREATE TABLE IF NOT EXISTS public.agent_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  demand_type TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  reason TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  suggestion TEXT,
  status TEXT DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.agent_demands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent demands" ON public.agent_demands
  FOR ALL USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  )
  WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- 7. Colunas Meta Ads em plans_config
ALTER TABLE public.plans_config 
  ADD COLUMN IF NOT EXISTS meta_ads_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_ads_syncs_per_day INTEGER DEFAULT 0;

-- Trigger updated_at para meta_ads_connections
CREATE OR REPLACE FUNCTION public.update_meta_connection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_meta_ads_connections_updated_at
  BEFORE UPDATE ON public.meta_ads_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_meta_connection_updated_at();
