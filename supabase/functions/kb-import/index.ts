import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── PDF parsing & scraping ───────────────────────────────────────────
// (moved to top for readability)

// Parse PDF using pdf.js via CDN (via text extraction)
async function extractPdfText(base64Data: string): Promise<string> {
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  try {
    const text = extractReadableText(bytes);
    if (text.length > 100) return text;
  } catch (_) { /* fall through */ }
  return "[Conteúdo do PDF não pôde ser extraído automaticamente. Cole o texto manualmente.]";
}

function extractReadableText(bytes: Uint8Array): string {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const raw = decoder.decode(bytes);
  const lines: string[] = [];
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    const strRegex = /\\(([^)]{1,200})\\)/g;
    let strMatch;
    while ((strMatch = strRegex.exec(block)) !== null) {
      const txt = strMatch[1]
        .replace(/\\\\n/g, "\n")
        .replace(/\\\\r/g, "")
        .replace(/\\(/g, "(")
        .replace(/\\)/g, ")")
        .trim();
      if (txt.length > 2 && /[a-zA-ZÀ-ÿ]/.test(txt)) {
        lines.push(txt);
      }
    }
  }
  if (lines.length === 0) {
    let current = "";
    const result: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      if ((c >= 32 && c <= 126) || c === 10 || c === 13) {
        current += String.fromCharCode(c);
      } else {
        if (current.length > 20 && /[a-zA-Z]{3,}/.test(current)) {
          result.push(current.trim());
        }
        current = "";
      }
    }
    return result.join("\n").slice(0, 15000);
  }
  return lines.join("\n").slice(0, 15000);
}

async function scrapeUrl(url: string): Promise<string> {
  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("URL inválida");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Apenas URLs HTTP/HTTPS são permitidas");
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBot/1.0)",
      Accept: "text/html,application/xhtml+xml,text/plain",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/plain")) {
    return (await response.text()).slice(0, 20000);
  }
  const html = await response.text();
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
  const titleMatch = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const result = title ? `# ${title}\n\n${cleaned}` : cleaned;
  return result.slice(0, 20000);
}

async function segmentWithAI(
  content: string,
  agentCode: string,
  source: string,
  lovableApiKey: string
): Promise<Array<{ title: string; content: string; category: string }>> {
  const systemPrompt = `Você é um especialista em organizar bases de conhecimento para agentes de IA.
Receberá um texto bruto e deve segmentá-lo em itens de conhecimento coesos e bem estruturados.

Para o agente ${agentCode}, extraia blocos de conhecimento distintos.
Cada item deve ter:
- title: título conciso e descritivo (máx 80 chars)
- content: conteúdo completo, estruturado em markdown se possível (máx 3000 chars por item)
- category: uma das categorias: framework, metodologia, estrategia, referencia, exemplo, processo, conceito

Retorne APENAS um JSON válido com array de objetos: [{"title":"...","content":"...","category":"..."}]
Não inclua texto fora do JSON. Máximo de 10 itens por importação.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Fonte: ${source}\n\nConteúdo para segmentar:\n\n${content.slice(0, 12000)}`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI segmentation failed: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "[]";
  const jsonMatch = raw.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON array");
  const parsed = JSON.parse(jsonMatch[0]);
  return Array.isArray(parsed) ? parsed : [];
}

// Allowed agent codes for validation
const VALID_AGENT_CODES = [
  "AA-D100", "AO-GO", "AJ-AF", "AM-CC", "AC-DC", "AE-C", "AT-GP", "AG-IMG", "ACO",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: require admin role ──────────────────────────────────────
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role using service role client
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── API Key ───────────────────────────────────────────────────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { type, agentCode } = body;

    // ── Input validation ──────────────────────────────────────────────
    if (!type || typeof type !== "string") {
      return new Response(JSON.stringify({ error: "Tipo de importação é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!agentCode || typeof agentCode !== "string" || !VALID_AGENT_CODES.includes(agentCode)) {
      return new Response(JSON.stringify({ error: "Código do agente inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawContent = "";
    let source = "texto colado";

    if (type === "text") {
      rawContent = body.content || "";
      if (typeof rawContent !== "string" || rawContent.length > 50000) {
        return new Response(JSON.stringify({ error: "Conteúdo inválido (máximo 50.000 caracteres)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      source = "texto colado";
    } else if (type === "url") {
      const url = body.url;
      if (!url || typeof url !== "string" || url.length > 2000) {
        return new Response(JSON.stringify({ error: "URL inválida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      source = url;
      rawContent = await scrapeUrl(url);
    } else if (type === "pdf") {
      const base64 = body.base64;
      if (!base64 || typeof base64 !== "string" || base64.length > 10_000_000) {
        return new Response(JSON.stringify({ error: "Arquivo PDF inválido (máximo ~7.5MB)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      source = (typeof body.filename === "string" ? body.filename.slice(0, 200) : "arquivo.pdf");
      rawContent = await extractPdfText(base64);
    } else if (type === "txt") {
      const base64 = body.base64;
      if (!base64 || typeof base64 !== "string" || base64.length > 5_000_000) {
        return new Response(JSON.stringify({ error: "Arquivo inválido (máximo ~3.7MB)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      source = (typeof body.filename === "string" ? body.filename.slice(0, 200) : "arquivo.txt");
      rawContent = atob(base64);
    } else {
      return new Response(JSON.stringify({ error: `Tipo de importação inválido: ${type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rawContent || rawContent.length < 10) {
      return new Response(
        JSON.stringify({ error: "Conteúdo extraído muito curto ou vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const items = await segmentWithAI(rawContent, agentCode, source, LOVABLE_API_KEY);

    return new Response(
      JSON.stringify({ success: true, items, rawLength: rawContent.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("kb-import error:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
