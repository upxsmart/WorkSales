import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  ImageIcon, Download, Loader2, CheckSquare, Square,
  X, ZoomIn, ChevronLeft, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  story:          "Story 9:16",
  "feed-square":  "Feed 1:1",
  "feed-portrait":"Feed 4:5",
  banner:         "Banner 16:9",
  unknown:        "Outro",
};

const FORMAT_RATIO_HINTS: Array<{ key: string; patterns: RegExp[] }> = [
  { key: "story",         patterns: [/9[_:x]16/i, /1080.?x.?1920/i, /story/i] },
  { key: "feed-square",   patterns: [/1[_:x]1/i, /1080.?x.?1080/i, /feed\s*square/i] },
  { key: "feed-portrait", patterns: [/4[_:x]5/i, /1080.?x.?1350/i, /portrait/i] },
  { key: "banner",        patterns: [/16[_:x]9/i, /1200.?x.?628/i, /banner/i] },
];

interface CreativeImage {
  url: string;
  agent: "AG-IMG" | "AC-DC";
  format: string;      // story | feed-square | feed-portrait | banner | unknown
  createdAt: string;
  isBase64: boolean;
  briefing?: string;   // first 80 chars of user message that triggered it
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isBase64Url = (url: string) => url.startsWith("data:");

/** Detect image format from the briefing/context text */
function detectFormat(context: string): string {
  for (const fmt of FORMAT_RATIO_HINTS) {
    if (fmt.patterns.some((p) => p.test(context))) return fmt.key;
  }
  return "unknown";
}

async function downloadImage(url: string, filename: string) {
  if (isBase64Url(url)) {
    const [header, data] = url.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/png";
    const binary = atob(data);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } else {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }
}

// ─── Format pills ─────────────────────────────────────────────────────────────

const FORMAT_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "story", label: "Story" },
  { key: "feed-square", label: "Feed" },
  { key: "feed-portrait", label: "Feed 4:5" },
  { key: "banner", label: "Banner" },
  { key: "unknown", label: "Outro" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ProjectGalleryProps {
  projectId: string;
  projectName: string;
}

const ProjectGallery = ({ projectId, projectName }: ProjectGalleryProps) => {
  const { toast } = useToast();

  const [images, setImages] = useState<CreativeImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFormat, setFilterFormat] = useState("all");
  const [filterAgent, setFilterAgent] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ── Fetch images for this project ─────────────────────────────────────────

  const fetchImages = useCallback(async () => {
    setLoading(true);
    const result: CreativeImage[] = [];

    // chat_messages — each assistant msg may have JSON with images[]
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("id, agent_name, content, created_at, project_id")
      .eq("project_id", projectId)
      .in("agent_name", ["AG-IMG", "AC-DC"])
      .eq("role", "assistant")
      .order("created_at", { ascending: false });

    // We also want the preceding user messages (briefings) for format detection
    const { data: userMsgs } = await supabase
      .from("chat_messages")
      .select("id, agent_name, content, created_at")
      .eq("project_id", projectId)
      .in("agent_name", ["AG-IMG", "AC-DC"])
      .eq("role", "user")
      .order("created_at", { ascending: false });

    // Build a simple "last user message before this timestamp" lookup
    const userMsgList = userMsgs || [];

    for (const msg of msgs || []) {
      let imgUrls: string[] = [];
      let msgText = "";
      try {
        const parsed = JSON.parse(msg.content);
        if (Array.isArray(parsed?.images)) imgUrls = parsed.images;
        if (typeof parsed?.text === "string") msgText = parsed.text;
      } catch {
        // plain text, no images
      }

      // Find nearest user message that came before this assistant message
      const preceding = userMsgList
        .filter(
          (u) =>
            u.agent_name === msg.agent_name &&
            new Date(u.created_at) <= new Date(msg.created_at)
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      const contextText = (preceding?.content || "") + " " + msgText;
      const format = detectFormat(contextText);

      for (const url of imgUrls) {
        if (!url) continue;
        result.push({
          url,
          agent: msg.agent_name as "AG-IMG" | "AC-DC",
          format,
          createdAt: msg.created_at,
          isBase64: isBase64Url(url),
          briefing: preceding?.content?.slice(0, 80),
        });
      }
    }

    // agent_outputs — may store approved images
    const { data: outputs } = await supabase
      .from("agent_outputs")
      .select("id, agent_name, output_data, created_at")
      .eq("project_id", projectId)
      .in("agent_name", ["AG-IMG", "AC-DC"])
      .order("created_at", { ascending: false });

    for (const out of outputs || []) {
      const data = out.output_data as Record<string, unknown> | null;
      if (!data) continue;
      const imgUrls: string[] = Array.isArray(data.images) ? (data.images as string[]) : [];
      const contextText = String(data.text || "") + String(data.briefing || "");
      const format = detectFormat(contextText);
      for (const url of imgUrls) {
        if (!url || result.some((r) => r.url === url)) continue;
        result.push({
          url,
          agent: out.agent_name as "AG-IMG" | "AC-DC",
          format,
          createdAt: out.created_at,
          isBase64: isBase64Url(url),
        });
      }
    }

    setImages(result);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = images.filter((img) => {
    if (filterFormat !== "all" && img.format !== filterFormat) return false;
    if (filterAgent !== "all" && img.agent !== filterAgent) return false;
    return true;
  });

  const formatCounts = Object.fromEntries(
    FORMAT_FILTERS.slice(1).map((f) => [f.key, images.filter((i) => i.format === f.key).length])
  );

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleSelect = (url: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.url));
  const selectAll = () => setSelected(new Set(filtered.map((i) => i.url)));
  const clearSelection = () => setSelected(new Set());

  // ── Download ──────────────────────────────────────────────────────────────

  const handleBatchDownload = async () => {
    const targets = filtered.filter((i) => selected.has(i.url));
    if (!targets.length) return;
    setDownloading(true);
    try {
      for (let idx = 0; idx < targets.length; idx++) {
        const img = targets[idx];
        const ext = img.isBase64 ? "png" : img.url.split(".").pop()?.split("?")[0] || "jpg";
        const label = FORMAT_LABELS[img.format] ?? img.format;
        const filename = `${projectName}-${img.agent}-${label}-${idx + 1}.${ext}`
          .toLowerCase()
          .replace(/\s+/g, "-");
        await downloadImage(img.url, filename);
        await new Promise((r) => setTimeout(r, 280));
      }
      toast({ title: `${targets.length} imagem${targets.length > 1 ? "ns" : ""} baixada${targets.length > 1 ? "s" : ""}!` });
      clearSelection();
    } catch {
      toast({ title: "Erro ao baixar", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleSingleDownload = async (img: CreativeImage, idx: number) => {
    const ext = img.isBase64 ? "png" : img.url.split(".").pop()?.split("?")[0] || "jpg";
    const label = FORMAT_LABELS[img.format] ?? img.format;
    const filename = `${projectName}-${img.agent}-${label}-${idx + 1}.${ext}`
      .toLowerCase()
      .replace(/\s+/g, "-");
    await downloadImage(img.url, filename);
  };

  // ── Lightbox navigation ───────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightbox === null) return;
      if (e.key === "ArrowLeft") setLightbox((i) => (i !== null ? Math.max(0, i - 1) : null));
      if (e.key === "ArrowRight") setLightbox((i) => (i !== null ? Math.min(filtered.length - 1, i + 1) : null));
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, filtered.length]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-muted-foreground opacity-40" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum criativo gerado ainda</p>
          <p className="text-xs text-muted-foreground mt-0.5">Gere imagens com o AG-IMG ou AC-DC para vê-las aqui.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-4">

      {/* ── Top toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Format pills */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          {FORMAT_FILTERS.map((f) => {
            const count = f.key === "all" ? images.length : (formatCounts[f.key] ?? 0);
            if (f.key !== "all" && count === 0) return null;
            const active = filterFormat === f.key;
            return (
              <button
                key={f.key}
                onClick={() => { setFilterFormat(f.key); clearSelection(); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {f.label}
                <span className={`text-[10px] ${active ? "text-primary/70" : "text-muted-foreground/60"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Agent filter */}
        <div className="flex gap-1">
          {["all", "AG-IMG", "AC-DC"].map((a) => (
            <button
              key={a}
              onClick={() => { setFilterAgent(a); clearSelection(); }}
              className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                filterAgent === a
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {a === "all" ? "Todos" : a}
            </button>
          ))}
        </div>
      </div>

      {/* ── Batch actions bar (shows when items selected) ── */}
      <AnimatePresence>
        {filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 flex-wrap"
          >
            <button
              onClick={allSelected ? clearSelection : selectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected
                ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                : <Square className="w-3.5 h-3.5" />}
              {allSelected ? "Desmarcar todos" : "Selecionar todos"}
            </button>

            {selected.size > 0 && (
              <>
                <span className="text-xs text-muted-foreground">
                  {selected.size} selecionada{selected.size !== 1 ? "s" : ""}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 px-2.5"
                  onClick={handleBatchDownload}
                  disabled={downloading}
                >
                  {downloading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Download className="w-3 h-3" />}
                  Baixar selecionadas
                </Button>
                <button
                  onClick={clearSelection}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} criativo{filtered.length !== 1 ? "s" : ""}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Image grid ── */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nenhum criativo para o filtro selecionado.
        </p>
      ) : (
        <motion.div layout className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          <AnimatePresence>
            {filtered.map((img, idx) => {
              const isSelected = selected.has(img.url);
              return (
                <motion.div
                  key={img.url}
                  layout
                  initial={{ opacity: 0, scale: 0.93 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.93 }}
                  transition={{ delay: idx * 0.025 }}
                  className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]"
                      : "border-border hover:border-primary/40"
                  }`}
                  onClick={() => setLightbox(idx)}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-muted/40">
                    <img
                      src={img.url}
                      alt={`Criativo ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightbox(idx); }}
                      className="w-7 h-7 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSingleDownload(img, idx); }}
                      className="w-7 h-7 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(img.url); }}
                    className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground opacity-100"
                        : "bg-background/70 text-foreground opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {isSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                  </button>

                  {/* Agent badge */}
                  <span className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                    img.agent === "AG-IMG"
                      ? "bg-primary/90 text-primary-foreground"
                      : "bg-accent/90 text-accent-foreground"
                  }`}>
                    {img.agent}
                  </span>

                  {/* Format label */}
                  {img.format !== "unknown" && (
                    <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] text-muted-foreground">{FORMAT_LABELS[img.format]}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightbox !== null && filtered[lightbox] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-lg p-4"
            onClick={() => setLightbox(null)}
          >
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center hover:bg-card transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Prev */}
            {lightbox > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox((i) => Math.max(0, (i ?? 1) - 1)); }}
                className="absolute left-4 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center hover:bg-card transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Next */}
            {lightbox < filtered.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox((i) => Math.min(filtered.length - 1, (i ?? 0) + 1)); }}
                className="absolute right-4 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center hover:bg-card transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Image + meta */}
            <motion.div
              key={lightbox}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative max-w-2xl max-h-[85vh] w-full flex flex-col items-center gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={filtered[lightbox].url}
                alt={`Criativo ${lightbox + 1}`}
                className="max-h-[68vh] max-w-full rounded-xl object-contain shadow-2xl"
              />

              <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  filtered[lightbox].agent === "AG-IMG"
                    ? "bg-primary/20 text-primary"
                    : "bg-accent/20 text-accent"
                }`}>
                  {filtered[lightbox].agent}
                </span>
                <span className="text-muted-foreground text-xs">
                  {FORMAT_LABELS[filtered[lightbox].format] ?? filtered[lightbox].format}
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(filtered[lightbox].createdAt).toLocaleDateString("pt-BR")}
                </span>
                {filtered[lightbox].briefing && (
                  <span className="text-muted-foreground text-xs italic truncate max-w-xs">
                    "{filtered[lightbox].briefing}…"
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => handleSingleDownload(filtered[lightbox], lightbox)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {lightbox + 1} / {filtered.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectGallery;
