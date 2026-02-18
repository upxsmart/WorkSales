import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X, FileText, Link, Upload, ClipboardPaste, Loader2,
  Check, ChevronRight, AlertCircle, Sparkles, Trash2,
} from "lucide-react";

type KBPreviewItem = {
  title: string;
  content: string;
  category: string;
  selected: boolean;
};

type ImportMode = "text" | "url" | "file" | null;

interface KBImportModalProps {
  agentCode: string;
  onClose: () => void;
  onImported: () => void;
}

const IMPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kb-import`;

const categoryColors: Record<string, string> = {
  framework: "bg-primary/10 text-primary",
  metodologia: "bg-accent/10 text-accent",
  estrategia: "bg-secondary text-secondary-foreground",
  referencia: "bg-muted text-muted-foreground",
  exemplo: "bg-primary/5 text-primary",
  processo: "bg-accent/5 text-accent",
  conceito: "bg-muted text-muted-foreground",
};

export default function KBImportModal({ agentCode, onClose, onImported }: KBImportModalProps) {
  const [mode, setMode] = useState<ImportMode>(null);
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<KBPreviewItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setMode(null);
    setTextInput("");
    setUrlInput("");
    setPreview([]);
    setIsLoading(false);
  };

  // ── Call edge function to parse & segment ──
  const runImport = async (body: object) => {
    setIsLoading(true);
    setPreview([]);
    try {
      const resp = await fetch(IMPORT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ ...body, agentCode }),
      });

      const data = await resp.json();

      if (!resp.ok || data.error) {
        toast.error(data.error || "Erro ao importar");
        return;
      }

      if (!data.items || data.items.length === 0) {
        toast.warning("Nenhum item de conhecimento foi identificado no conteúdo.");
        return;
      }

      setPreview(data.items.map((item: Omit<KBPreviewItem, "selected">) => ({ ...item, selected: true })));
      toast.success(`${data.items.length} item(s) identificados pela IA!`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao conectar com o servidor de importação.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextImport = () => {
    if (!textInput.trim()) return;
    runImport({ type: "text", content: textInput });
  };

  const handleUrlImport = () => {
    if (!urlInput.trim()) return;
    const url = urlInput.startsWith("http") ? urlInput : `https://${urlInput}`;
    runImport({ type: "url", url });
  };

  const handleFile = (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isTxt = file.type === "text/plain" || file.name.endsWith(".txt");

    if (!isPdf && !isTxt) {
      toast.error("Apenas arquivos .txt e .pdf são suportados.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // result is a data URL like "data:application/pdf;base64,..."
      const base64 = result.split(",")[1];
      runImport({
        type: isPdf ? "pdf" : "txt",
        base64,
        filename: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setMode("file");
      handleFile(file);
    }
  };

  // ── Save selected items to knowledge_base ──
  const handleSave = async () => {
    const toSave = preview.filter((i) => i.selected);
    if (toSave.length === 0) {
      toast.warning("Selecione pelo menos um item para importar.");
      return;
    }

    setIsSaving(true);
    const inserts = toSave.map((item) => ({
      agent_code: agentCode,
      title: item.title,
      content: item.content,
      category: item.category,
      is_active: true,
    }));

    const { error } = await supabase.from("knowledge_base").insert(inserts);

    setIsSaving(false);

    if (error) {
      toast.error("Erro ao salvar itens: " + error.message);
    } else {
      toast.success(`${toSave.length} item(s) importados com sucesso!`);
      onImported();
      onClose();
    }
  };

  const toggleItem = (idx: number) => {
    setPreview((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item))
    );
  };

  const removeItem = (idx: number) => {
    setPreview((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectedCount = preview.filter((i) => i.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col glass rounded-2xl border border-border shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-sm">Importar para KB · {agentCode}</h2>
              <p className="text-xs text-muted-foreground">A IA segmenta o conteúdo automaticamente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Mode selector */}
          {!isLoading && preview.length === 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: "text", icon: ClipboardPaste, label: "Colar texto" },
                { id: "url", icon: Link, label: "Link / URL" },
                { id: "file", icon: Upload, label: ".TXT ou PDF" },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setMode(mode === id ? null : id as ImportMode)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-sm transition-all ${
                    mode === id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border glass glass-hover text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Text paste */}
          <AnimatePresence>
            {mode === "text" && !isLoading && preview.length === 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <label className="text-xs text-muted-foreground font-medium">Cole o conteúdo abaixo:</label>
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Cole aqui qualquer texto: frameworks, metodologias, artigos, documentação, transcrições de vídeo, notas..."
                  className="min-h-[200px] bg-secondary/30 text-sm"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{textInput.length} caracteres</span>
                  <Button onClick={handleTextImport} disabled={!textInput.trim()}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Segmentar com IA
                  </Button>
                </div>
              </motion.div>
            )}

            {/* URL input */}
            {mode === "url" && !isLoading && preview.length === 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <label className="text-xs text-muted-foreground font-medium">URL do conteúdo:</label>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
                    placeholder="https://exemplo.com/artigo ou blog post..."
                    className="bg-secondary/30"
                    autoFocus
                  />
                  <Button onClick={handleUrlImport} disabled={!urlInput.trim()}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O conteúdo da página será extraído e segmentado pela IA em itens de conhecimento.
                </p>
              </motion.div>
            )}

            {/* File upload */}
            {mode === "file" && !isLoading && preview.length === 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    dragOver
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  <Upload className={`w-8 h-8 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-center">
                    <p className="text-sm font-medium">Arraste aqui ou clique para selecionar</p>
                    <p className="text-xs text-muted-foreground mt-1">Suporta .txt e .pdf · Máx. 20MB</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,text/plain,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading state */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 gap-4"
            >
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">IA segmentando o conteúdo...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Identificando frameworks, conceitos e metodologias
                </p>
              </div>
            </motion.div>
          )}

          {/* Preview items */}
          {preview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    {preview.length} item(s) identificados
                  </span>
                  <span className="text-xs text-muted-foreground">· {selectedCount} selecionados</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreview((p) => p.map((i) => ({ ...i, selected: true })))}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Todos
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    onClick={() => setPreview((p) => p.map((i) => ({ ...i, selected: false })))}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Nenhum
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    onClick={reset}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reimportar
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {preview.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`rounded-xl border p-4 transition-all cursor-pointer ${
                      item.selected
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/50 bg-muted/20 opacity-60"
                    }`}
                    onClick={() => toggleItem(idx)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Checkbox visual */}
                        <div
                          className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            item.selected
                              ? "border-primary bg-primary"
                              : "border-border"
                          }`}
                        >
                          {item.selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-display font-semibold text-sm truncate">{item.title}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                categoryColors[item.category] || "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {item.category}
                            </span>
                          </div>
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 font-sans">
                            {item.content}
                          </pre>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state warning */}
          {!isLoading && preview.length === 0 && mode === null && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
              <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Escolha uma fonte acima. A IA vai ler o conteúdo e criar automaticamente os itens de KB prontos para revisão e importação.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} size="sm">
            Cancelar
          </Button>
          {preview.length > 0 && (
            <Button
              onClick={handleSave}
              disabled={isSaving || selectedCount === 0}
              className="gradient-primary text-primary-foreground"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Importar {selectedCount} item{selectedCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
