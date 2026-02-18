
-- Habilitar Meta Ads no plano Professional: 4 sincronizações por dia
UPDATE public.plans_config
SET 
  meta_ads_enabled = true,
  meta_ads_syncs_per_day = 4,
  updated_at = now()
WHERE plan_code = 'professional';

-- Habilitar Meta Ads no plano Scale: 12 sincronizações por dia (3x mais)
UPDATE public.plans_config
SET 
  meta_ads_enabled = true,
  meta_ads_syncs_per_day = 12,
  updated_at = now()
WHERE plan_code = 'scale';
