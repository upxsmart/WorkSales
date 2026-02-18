import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Parse PDF using pdf.js via CDN (via text extraction)
async function extractPdfText(base64Data: string): Promise<string> {
  // Decode base64 to bytes
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Use Lovable AI to extract text from PDF description
  // Since Deno doesn't have a native PDF parser, we'll use a heuristic text extractor
  // that extracts readable text from PDF binary
  try {
    const text = extractReadableText(bytes);
    if (text.length > 100) return text;
  } catch (_) { /* fall through */ }

  return "[Conteúdo do PDF não pôde ser extraído automaticamente. Cole o texto manualmente.]";
}

// Simple heuristic to extract readable ASCII text from PDF bytes
function extractReadableText(bytes: Uint8Array): string {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const raw = decoder.decode(bytes);

  // Extract text between BT/ET markers (PDF text objects)
  const lines: string[] = [];
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let match;

  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    // Extract strings in parentheses
    const strRegex = /\(([^)]{1,200})\)/g;
    let strMatch;
    while ((strMatch = strRegex.exec(block)) !== null) {
      const txt = strMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .trim();
      if (txt.length > 2 && /[a-zA-ZÀ-ÿ]/.test(txt)) {
        lines.push(txt);
      }
    }
  }

  if (lines.length === 0) {
    // Fallback: extract readable ASCII runs
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

// Scrape URL content and return clean text
async function scrapeUrl(url: string): Promise<string> {
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
    return await response.text();
  }

  const html = await response.text();

  // Strip HTML tags and extract clean text
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

  // Extract title from HTML
  const titleMatch = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  const result = title ? `# ${title}\n\n${cleaned}` : cleaned;
  return result.slice(0, 20000);
}

// Use Lovable AI to segment & summarize content into KB items
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

  // Extract JSON from response (may have markdown code blocks)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON array");

  const parsed = JSON.parse(jsonMatch[0]);
  return Array.isArray(parsed) ? parsed : [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { type, agentCode } = body;

    let rawContent = "";
    let source = "texto colado";

    if (type === "text") {
      rawContent = body.content || "";
      source = "texto colado";
    } else if (type === "url") {
      const url = body.url;
      if (!url) throw new Error("URL não fornecida");
      source = url;
      rawContent = await scrapeUrl(url);
    } else if (type === "pdf") {
      const base64 = body.base64;
      if (!base64) throw new Error("Arquivo PDF não fornecido");
      source = body.filename || "arquivo.pdf";
      rawContent = await extractPdfText(base64);
    } else if (type === "txt") {
      // Plain text file content, base64 encoded
      const base64 = body.base64;
      if (!base64) throw new Error("Arquivo não fornecido");
      source = body.filename || "arquivo.txt";
      rawContent = atob(base64);
    } else {
      throw new Error(`Tipo de importação inválido: ${type}`);
    }

    if (!rawContent || rawContent.length < 10) {
      return new Response(
        JSON.stringify({ error: "Conteúdo extraído muito curto ou vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Segment content into KB items using AI
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
