import React, { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

interface ImportZoneProps {
  onFilesProcessed: (files: FileList) => void;
  importing: boolean;
  progress: { done: number; total: number } | null;
  title?: string;
  subtitle?: string;
  accept?: string;
}

export function ImportZone({
  onFilesProcessed,
  importing,
  progress,
  title = "Arraste seus arquivos XML ou ZIP aqui",
  subtitle = "Arquivos da NFS-e Padrão Nacional (XML) ou lote compactado (ZIP). Processamento 100% no navegador.",
  accept = ".zip,.xml",
}: ImportZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      onFilesProcessed(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onFilesProcessed(e.target.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !importing && fileRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
        importing ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
      } ${
        dragOver
          ? "border-indigo-600 bg-indigo-500/[0.04] scale-[1.01] shadow-lg shadow-indigo-500/5"
          : "border-border hover:border-indigo-500/55 hover:bg-muted/40"
      }`}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        disabled={importing}
        onChange={handleFileChange}
      />

      {importing ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center animate-spin">
            <Loader2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Importando notas fiscais...</p>
            {progress && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Lendo XML {progress.done} de {progress.total} (
                {Math.round((progress.done / progress.total) * 100)}%)
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <p className="text-[10px] text-muted-foreground mt-1 max-w-sm mx-auto">
              {subtitle}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
