import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CHECKOUT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;

export function useCheckout() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { toast } = useToast();

  const startCheckout = async (planCode: string) => {
    setLoadingPlan(planCode);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const resp = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ plan_code: planCode }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.url) {
        throw new Error(data.error || "Erro ao criar sessão de checkout");
      }

      // Redirecionar para o Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      toast({
        title: "Erro no checkout",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível iniciar o pagamento. Tente novamente.",
        variant: "destructive",
      });
      setLoadingPlan(null);
    }
  };

  return { startCheckout, loadingPlan };
}
