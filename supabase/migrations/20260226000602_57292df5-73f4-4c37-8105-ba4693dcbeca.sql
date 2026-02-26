
CREATE OR REPLACE FUNCTION public.increment_profile_usage(_user_id uuid, _field text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate field name
  IF _field NOT IN ('interactions_used', 'creatives_used') THEN
    RAISE EXCEPTION 'Campo inválido: %', _field;
  END IF;

  -- Security: only allow the user themselves or service_role to increment
  -- auth.uid() is NULL for service_role calls, which is the intended usage from edge functions
  IF auth.uid() IS NOT NULL AND auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Não autorizado: você só pode incrementar seu próprio uso';
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
$function$;
