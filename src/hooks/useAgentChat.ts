import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type Message = {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // public URLs for generated images (AC-DC)
};

export type AgentDemand = {
  agent_target: string;
  reason: string;
  suggestion: string;
  priority?: string;
  demand_type?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`;

/**
 * Extrai blocos de demanda JSON do texto de resposta do AT-GP.
 * Aceita ```json { ... } ``` ou JSON inline com agent_target.
 */
export function extractDemands(text: string): AgentDemand[] {
  const demands: AgentDemand[] = [];

  // Pattern 1: ```json ... ``` blocks
  const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.agent_target && parsed.reason) {
        demands.push(parsed as AgentDemand);
      }
      // Array of demands inside a single block
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.agent_target && item.reason) demands.push(item as AgentDemand);
        }
      }
    } catch { /* ignore malformed */ }
  }

  // Pattern 2: Inline JSON objects with agent_target key (not already found)
  if (demands.length === 0) {
    const inlineRegex = /\{\s*"agent_target"\s*:[\s\S]*?\}/g;
    while ((match = inlineRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.agent_target && parsed.reason) demands.push(parsed as AgentDemand);
      } catch { /* ignore */ }
    }
  }

  return demands;
}

export function useAgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = useCallback(
    async (
      input: string,
      agentName: string,
      projectId?: string,
      projectContext?: Record<string, unknown>,
      onDemandsFound?: (demands: AgentDemand[], fullText: string) => void,
      imageCount?: number
    ) => {
      const userMsg: Message = { role: "user", content: input };
      const allMessages = [...messages, userMsg];
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        // Get the current user's JWT (not the anon key)
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            messages: allMessages,
            agentName,
            projectId,
            projectContext,
            imageCount: imageCount ?? 1,
          }),
        });

        if (resp.status === 429) {
          toast({ title: "Limite excedido", description: "Aguarde alguns instantes e tente novamente.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        if (resp.status === 402) {
          toast({ title: "Créditos esgotados", description: "Adicione créditos para continuar usando a IA.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        if (!resp.ok) throw new Error("Falha ao conectar com IA");

        // AC-DC returns image JSON (X-Response-Type: image), others stream SSE
        const responseType = resp.headers.get("X-Response-Type");

        if (responseType === "image") {
          // Non-streaming image response
          const data = await resp.json();
          const assistantMsg: Message = {
            role: "assistant",
            content: data.text || "Criativo gerado! 🎨",
            images: data.images || [],
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsLoading(false);
          return;
        }

        // Streaming SSE for text agents
        if (!resp.body) throw new Error("Sem body na resposta");

        let assistantSoFar = "";

        const upsertAssistant = (chunk: string) => {
          assistantSoFar += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
              );
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        };

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch { /* ignore */ }
          }
        }

        // ── After stream: detect demands (AT-GP only) ──────────────
        if (agentName === "AT-GP" && onDemandsFound && assistantSoFar) {
          const found = extractDemands(assistantSoFar);
          if (found.length > 0) {
            onDemandsFound(found, assistantSoFar);
          }
        }
      } catch (e) {
        console.error(e);
        toast({ title: "Erro", description: "Não foi possível obter resposta da IA.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, toast]
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearMessages, setMessages };
}

