-- Encrypt/decrypt functions
CREATE OR REPLACE FUNCTION public.encrypt_sensitive(plain_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _key text;
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN RETURN plain_text; END IF;
  IF left(plain_text, 4) = 'enc:' THEN RETURN plain_text; END IF;
  SELECT decrypted_secret INTO _key FROM vault.decrypted_secrets WHERE name = 'app_encryption_key' LIMIT 1;
  IF _key IS NULL THEN RAISE EXCEPTION 'Encryption key not found in vault'; END IF;
  RETURN 'enc:' || encode(extensions.pgp_sym_encrypt(plain_text, _key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive(cipher_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _key text;
BEGIN
  IF cipher_text IS NULL OR cipher_text = '' THEN RETURN cipher_text; END IF;
  IF left(cipher_text, 4) != 'enc:' THEN RETURN cipher_text; END IF;
  SELECT decrypted_secret INTO _key FROM vault.decrypted_secrets WHERE name = 'app_encryption_key' LIMIT 1;
  IF _key IS NULL THEN RAISE EXCEPTION 'Encryption key not found in vault'; END IF;
  RETURN extensions.pgp_sym_decrypt(decode(substring(cipher_text from 5), 'base64'), _key);
END;
$$;

-- Trigger functions
CREATE OR REPLACE FUNCTION public.trigger_encrypt_api_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.key_value IS NOT NULL AND NEW.key_value != '' AND left(NEW.key_value, 4) != 'enc:' THEN
    NEW.key_value := public.encrypt_sensitive(NEW.key_value);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_encrypt_meta_token()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.access_token IS NOT NULL AND NEW.access_token != '' AND left(NEW.access_token, 4) != 'enc:' THEN
    NEW.access_token := public.encrypt_sensitive(NEW.access_token);
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers
CREATE TRIGGER encrypt_api_config_trigger
  BEFORE INSERT OR UPDATE OF key_value ON public.api_configs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_encrypt_api_config();

CREATE TRIGGER encrypt_meta_token_trigger
  BEFORE INSERT OR UPDATE OF access_token ON public.meta_ads_connections
  FOR EACH ROW EXECUTE FUNCTION public.trigger_encrypt_meta_token();

-- Encrypt existing data
UPDATE public.api_configs
SET key_value = public.encrypt_sensitive(key_value)
WHERE key_value IS NOT NULL AND key_value != '' AND left(key_value, 4) != 'enc:';

UPDATE public.meta_ads_connections
SET access_token = public.encrypt_sensitive(access_token)
WHERE access_token IS NOT NULL AND access_token != '' AND left(access_token, 4) != 'enc:';