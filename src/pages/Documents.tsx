import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, Trash2, Download, Search,
  File, FileImage, FileSpreadsheet, Loader2,
} from "lucide-react";

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: string;
  created_at: string;
  project_id: string | null;
}

const CATEGORIES = ["general", "proposta", "contrato", "briefing", "relatório", "outro"];

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mime: string) => {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("spreadsheet") || mime.includes("csv")) return FileSpreadsheet;
  return File;
};

const Documents = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setDocs((data as Document[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: "Arquivo muito grande", description: `${file.name} excede 20MB.`, variant: "destructive" });
        continue;
      }

      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        category: "general",
      });

      if (dbError) {
        toast({ title: "Erro ao salvar", description: dbError.message, variant: "destructive" });
      }
    }

    toast({ title: "Upload concluído!" });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchDocs();
  };

  const handleDownload = async (doc: Document) => {
    const { data } = await supabase.storage.from("documents").download(doc.file_path);
    if (!data) {
      toast({ title: "Erro ao baixar", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (doc: Document) => {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    toast({ title: "Documento excluído." });
    fetchDocs();
  };

  const filtered = docs.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "all" || d.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">Documentos</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus arquivos e documentos do projeto.</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Enviando..." : "Upload"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar documentos..."
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-xl p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold mb-2">
            {docs.length === 0 ? "Nenhum documento ainda" : "Nenhum resultado"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {docs.length === 0 ? "Faça upload dos seus primeiros arquivos." : "Tente outro termo de busca."}
          </p>
          {docs.length === 0 && (
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" /> Enviar arquivo
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((doc, i) => {
              const IconComp = getFileIcon(doc.mime_type);
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass glass-hover rounded-xl px-5 py-3 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <IconComp className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatSize(doc.file_size)}</span>
                      <span className="capitalize">{doc.category}</span>
                      <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(doc)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Documents;
