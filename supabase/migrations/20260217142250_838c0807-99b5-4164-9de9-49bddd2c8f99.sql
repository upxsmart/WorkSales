
-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Tabela user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para checar role sem recursão
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Policies para user_roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tabela knowledge_base para base de conhecimento dos agentes
CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_code text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active knowledge"
  ON public.knowledge_base FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage knowledge base"
  ON public.knowledge_base FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins podem gerenciar prompts
CREATE POLICY "Admins can manage prompts"
  ON public.agent_prompts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at para knowledge_base
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
