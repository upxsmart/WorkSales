
-- ══════════════════════════════════════════════════════════════
-- Função para incrementar campos de uso no profile
-- Chamada pela Edge Function via service role
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_profile_usage(
  _user_id uuid,
  _field   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _field NOT IN ('interactions_used', 'creatives_used') THEN
    RAISE EXCEPTION 'Campo inválido: %', _field;
  END IF;

  IF _field = 'interactions_used' THEN
    UPDATE public.profiles
    SET interactions_used = interactions_used + 1
    WHERE user_id = _user_id;
  ELSIF _field = 'creatives_used' THEN
    UPDATE public.profiles
    SET creatives_used = creatives_used + 1
    WHERE user_id = _user_id;
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- Fix: tornar a policy de INSERT em usage_logs restrita ao service role
-- (remover WITH CHECK (true) e usar uma política mais segura)
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Service role can insert usage logs" ON public.usage_logs;

-- Qualquer usuário autenticado pode inserir logs seus próprios
-- (a Edge Function usa service role que bypassa RLS)
CREATE POLICY "Authenticated users can insert own usage logs"
  ON public.usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════
-- Trigger em profiles para sincronizar plan_status automaticamente
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    name,
    plan,
    plan_status,
    interactions_used,
    interactions_limit,
    creatives_used,
    creatives_limit,
    projects_limit
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    'starter',
    'trial',
    0,
    100,
    0,
    10,
    1
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recriar o trigger handle_new_user se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
