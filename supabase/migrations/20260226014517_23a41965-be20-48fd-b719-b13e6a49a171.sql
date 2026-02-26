
-- 1. RPC to approve an agent output (validates ownership)
CREATE OR REPLACE FUNCTION public.approve_agent_output(_output_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the output belongs to the calling user's project
  IF NOT EXISTS (
    SELECT 1 FROM agent_outputs ao
    JOIN projects p ON p.id = ao.project_id
    WHERE ao.id = _output_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Output não encontrado ou não autorizado';
  END IF;

  UPDATE agent_outputs SET is_approved = true WHERE id = _output_id;
END;
$$;

-- 2. RPC to bulk approve outputs (for orchestrator)
CREATE OR REPLACE FUNCTION public.bulk_approve_agent_outputs(_output_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ALL outputs belong to the calling user
  IF EXISTS (
    SELECT 1 FROM unnest(_output_ids) AS oid
    LEFT JOIN agent_outputs ao ON ao.id = oid
    LEFT JOIN projects p ON p.id = ao.project_id
    WHERE p.user_id IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'Um ou mais outputs não autorizados';
  END IF;

  UPDATE agent_outputs SET is_approved = true WHERE id = ANY(_output_ids);
END;
$$;

-- 3. Trigger to prevent users from setting is_approved directly via RLS-level updates
-- Force is_approved = false on INSERT (only service_role/RPC can set true)
CREATE OR REPLACE FUNCTION public.enforce_approval_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (edge functions) and security definer functions to set is_approved freely
  -- For regular users (role = 'authenticated'), force is_approved = false
  IF current_setting('role', true) = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_approved := false;
    ELSIF TG_OP = 'UPDATE' AND OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
      NEW.is_approved := OLD.is_approved; -- prevent direct change
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_approval_workflow_trigger
  BEFORE INSERT OR UPDATE ON public.agent_outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_approval_workflow();
