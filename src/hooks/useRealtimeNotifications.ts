import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AGENTS_CONFIG } from "@/lib/agents";

export const useRealtimeNotifications = (userId: string | undefined) => {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("output-approvals")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agent_outputs",
          filter: "is_approved=eq.true",
        },
        (payload) => {
          const agentName = payload.new.agent_name as string;
          const title = payload.new.title as string;
          const config = AGENTS_CONFIG[agentName as keyof typeof AGENTS_CONFIG];
          const label = config?.name || agentName;

          toast.success(`Output aprovado!`, {
            description: `${label}: ${title || "Novo output"}`,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
};
