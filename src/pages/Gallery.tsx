import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  ImageIcon, Download, Loader2, CheckSquare, Square,
  X, ZoomIn, ChevronLeft, ChevronRight, Images,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreativeImage {
  url: string;
  agent: "AG-IMG" | "AC-DC";
  projectId: string;
  projectName: string;
  createdAt: string;
  /** true when url is base64 (storage upload failed) */
  isBase64: boolean;
}

interface ProjectRef {
  id: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isBase64Url = (url: string) => url.startsWith("data:");

/** Download a single image (handles both https and base64) */
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

// ─── Component ────────────────────────────────────────────────────────────────

const Gallery = () => {
  const { user } = useAuth();
  const { projects } = useActiveProject();
  const { toast } = useToast();

  const [images, setImages] = useState<CreativeImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<number | null>(null); // index in `filtered`
  const [downloading, setDownloading] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchImages = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get all user projects to map ids → names
    const projectMap: Record<string, string> = {};
    for (const p of projects) projectMap[p.id] = p.name;

    // Fetch chat_messages for AG-IMG and AC-DC that contain images
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("id, agent_name, content, created_at, project_id")
      .in("agent_name", ["AG-IMG", "AC-DC"])
      .eq("role", "assistant")
      .order("created_at", { ascending: false });

    const result: CreativeImage[] = [];

    for (const msg of msgs || []) {
      // content may be JSON: { text, images: [...] }  OR  plain text
      let imgUrls: string[] = [];
      try {
        const parsed = JSON.parse(msg.content);
        if (Array.isArray(parsed?.images)) imgUrls = parsed.images;
      } catch {
        // plain text — no images
      }
      for (const url of imgUrls) {
        if (!url) continue;
        result.push({
          url,
          agent: msg.agent_name as "AG-IMG" | "AC-DC",
          projectId: msg.project_id,
          projectName: projectMap[msg.project_id] || "Projeto",
          createdAt: msg.created_at,
          isBase64: isBase64Url(url),
        });
      }
    }

    // Also pull from agent_outputs (approved outputs may store images)
    const { data: outputs } = await supabase
      .from("agent_outputs")
      .select("id, agent_name, output_data, created_at, project_id")
      .in("agent_name", ["AG-IMG", "AC-DC"])
      .order("created_at", { ascending: false });

    for (const out of outputs || []) {
      const data = out.output_data as Record<string, unknown> | null;
      if (!data) continue;
      const imgUrls: string[] = Array.isArray(data.images)
        ? (data.images as string[])
        : [];
      for (const url of imgUrls) {
        if (!url) continue;
        // Avoid duplicates (same url already added from chat_messages)
        if (result.some((r) => r.url === url)) continue;
        result.push({
          url,
          agent: out.agent_name as "AG-IMG" | "AC-DC",
          projectId: out.project_id,
          projectName: projectMap[out.project_id] || "Projeto",
          createdAt: out.created_at,
          isBase64: isBase64Url(url),
        });
      }
    }

    setImages(result);
    setLoading(false);
  }, [user, projects]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = images.filter((img) => {
    if (filterProject !== "all" && img.projectId !== filterProject) return false;
    if (filterAgent !== "all" && img.agent !== filterAgent) return false;
    return true;
  });

  // Unique projects that actually have images
  const projectsWithImages: ProjectRef[] = Array.from(
    new Map(images.map((i) => [i.projectId, i.projectName])).entries()
  ).map(([id, name]) => ({ id, name }));

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((i) => i.url)));
  const clearSelection = () => setSelected(new Set());
  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.url));

  // ── Download ───────────────────────────────────────────────────────────────

  const handleBatchDownload = async () => {
    const targets = filtered.filter((i) => selected.has(i.url));
    if (!targets.length) return;
    setDownloading(true);
    try {
      for (let idx = 0; idx < targets.length; idx++) {
        const img = targets[idx];
        const ext = img.isBase64 ? "png" : img.url.split(".").pop()?.split("?")[0] || "jpg";
        const filename = `criativo-${img.agent.toLowerCase()}-${idx + 1}.${ext}`;
        await downloadImage(img.url, filename);
        // Small gap so browser doesn't block multiple downloads
        await new Promise((r) => setTimeout(r, 300));
      }
      toast({ title: `${targets.length} imagen${targets.length > 1 ? "s" : ""} baixada${targets.length > 1 ? "s" : ""}!` });
    } catch {
      toast({ title: "Erro ao baixar", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleSingleDownload = async (img: CreativeImage, idx: number) => {
    const ext = img.isBase64 ? "png" : img.url.split(".").pop()?.split("?")[0] || "jpg";
    const filename = `criativo-${img.agent.toLowerCase()}-${idx + 1}.${ext}`;
    await downloadImage(img.url, filename);
  };

  // ── Lightbox nav ───────────────────────────────────────────────────────────

  const prevLightbox = () =>
    setLightbox((i) => (i !== null ? Math.max(0, i - 1) : null));
  const nextLightbox = () =>
    setLightbox((i) => (i !== null ? Math.min(filtered.length - 1, i + 1) : null));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightbox === null) return;
      if (e.key === "ArrowLeft") prevLightbox();
      if (e.key === "ArrowRight") nextLightbox();
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Galeria de Criativos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Todas as imagens geradas pelos agentes AG-IMG e AC-DC
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Images className="w-4 h-4" />
          <span>{images.length} criativo{images.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Filters + batch actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Project filter */}
        <Select value={filterProject} onValueChange={(v) => { setFilterProject(v); clearSelection(); }}>
          <SelectTrigger className="w-48 h-9 text-xs bg-card/50 border-border">
            <SelectValue placeholder="Todos os projetos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os projetos</SelectItem>
            {projectsWithImages.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Agent filter */}
        <Select value={filterAgent} onValueChange={(v) => { setFilterAgent(v); clearSelection(); }}>
          <SelectTrigger className="w-36 h-9 text-xs bg-card/50 border-border">
            <SelectValue placeholder="Todos os agentes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os agentes</SelectItem>
            <SelectItem value="AG-IMG" className="text-xs">AG-IMG</SelectItem>
            <SelectItem value="AC-DC" className="text-xs">AC-DC</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {/* Select all / batch download */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={allSelected ? clearSelection : selectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected
                ? <CheckSquare className="w-4 h-4 text-primary" />
                : <Square className="w-4 h-4" />}
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
                  className="h-8 text-xs gap-1.5"
                  onClick={handleBatchDownload}
                  disabled={downloading}
                >
                  {downloading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  Baixar selecionadas
                </Button>
                <button
                  onClick={clearSelection}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 gap-4 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground opacity-40" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg">Nenhum criativo encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              {images.length === 0
                ? "Gere imagens com o AG-IMG ou AC-DC para vê-las aqui."
                : "Tente ajustar os filtros."}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
        >
          <AnimatePresence>
            {filtered.map((img, idx) => {
              const isSelected = selected.has(img.url);
              return (
                <motion.div
                  key={img.url}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]"
                      : "border-border hover:border-primary/40"
                  }`}
                  onClick={() => setLightbox(idx)}
                >
                  {/* Image */}
                  <div className="aspect-square bg-muted/40">
                    <img
                      src={img.url}
                      alt={`Criativo ${img.agent} - ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightbox(idx); }}
                      className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                      title="Ver imagem"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSingleDownload(img, idx); }}
                      className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                      title="Baixar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Select checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(img.url); }}
                    className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground opacity-100"
                        : "bg-background/70 text-foreground opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  </button>

                  {/* Agent badge */}
                  <div className="absolute top-2 right-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      img.agent === "AG-IMG"
                        ? "bg-primary/90 text-primary-foreground"
                        : "bg-accent/90 text-accent-foreground"
                    }`}>
                      {img.agent}
                    </span>
                  </div>

                  {/* Base64 fallback badge */}
                  {img.isBase64 && (
                    <div className="absolute bottom-2 left-2">
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted/80 text-muted-foreground">
                        local
                      </span>
                    </div>
                  )}

                  {/* Project name */}
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-muted-foreground truncate">{img.projectName}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Lightbox */}
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
                onClick={(e) => { e.stopPropagation(); prevLightbox(); }}
                className="absolute left-4 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center hover:bg-card transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Next */}
            {lightbox < filtered.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); nextLightbox(); }}
                className="absolute right-4 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center hover:bg-card transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Image */}
            <motion.div
              key={lightbox}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-3xl max-h-[85vh] w-full flex flex-col items-center gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={filtered[lightbox].url}
                alt={`Criativo ${lightbox + 1}`}
                className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-2xl"
              />

              {/* Meta + download */}
              <div className="flex items-center gap-3 text-sm">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  filtered[lightbox].agent === "AG-IMG"
                    ? "bg-primary/20 text-primary"
                    : "bg-accent/20 text-accent"
                }`}>
                  {filtered[lightbox].agent}
                </span>
                <span className="text-muted-foreground">{filtered[lightbox].projectName}</span>
                <span className="text-muted-foreground">
                  {new Date(filtered[lightbox].createdAt).toLocaleDateString("pt-BR")}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 ml-2"
                  onClick={() => handleSingleDownload(filtered[lightbox], lightbox)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar
                </Button>
              </div>

              {/* Counter */}
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

export default Gallery;
