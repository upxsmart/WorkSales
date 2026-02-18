
-- Tabela para armazenar chaves de API de forma segura
CREATE TABLE public.api_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name TEXT NOT NULL UNIQUE,
  key_value TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  last_test_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.api_configs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler e gerenciar
CREATE POLICY "Admins can manage api configs"
ON public.api_configs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger de updated_at
CREATE TRIGGER update_api_configs_updated_at
BEFORE UPDATE ON public.api_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed com as 3 chaves gerenciáveis (Lovable AI é automática e não editável)
INSERT INTO public.api_configs (key_name, description) VALUES
  ('ANTHROPIC_API_KEY', 'Modelos Claude para os agentes de texto'),
  ('STRIPE_SECRET_KEY', 'Processamento de pagamentos e assinaturas'),
  ('RESEND_API_KEY', 'Envio de emails transacionais')
ON CONFLICT (key_name) DO NOTHING;
