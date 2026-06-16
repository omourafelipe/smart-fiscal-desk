import { db, type FiscalDocument, type ImportAudit } from "@/lib/db";
import { parseFiscalXml, buildHash } from "./parser";

export interface ImportSummary {
  encontrados: number;
  importadas: number;
  duplicadas: number;
  erros: number;
  detalhesErros: { arquivo: string; motivo: string }[];
}

export interface ImportProgress {
  done: number;
  total: number;
}

async function unzipFile(file: File): Promise<{ name: string; xml: string }[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.toLowerCase().endsWith(".xml")
  );
  const out: { name: string; xml: string }[] = [];
  for (const e of entries) {
    try {
      const xml = await e.async("string");
      out.push({ name: e.name, xml });
    } catch {
      out.push({ name: e.name, xml: "" });
    }
  }
  return out;
}

async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export async function importFiles(
  files: File[],
  onProgress?: (p: ImportProgress) => void
): Promise<ImportSummary> {
  // 1. Coleta todos os XMLs (de ZIPs e XMLs soltos)
  type XmlEntry = { arquivo: string; xml: string };
  const all: XmlEntry[] = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".zip")) {
        const entries = await unzipFile(file);
        for (const e of entries) {
          all.push({ arquivo: `${file.name} :: ${e.name}`, xml: e.xml });
        }
      } else if (name.endsWith(".xml")) {
        const xml = await readTextFile(file);
        all.push({ arquivo: file.name, xml });
      }
    } catch (e: any) {
      all.push({ arquivo: file.name, xml: "" });
    }
  }

  const summary: ImportSummary = {
    encontrados: all.length,
    importadas: 0,
    duplicadas: 0,
    erros: 0,
    detalhesErros: [],
  };

  const existingHashes = new Set<string>(
    (await db.documents.toArray()).map((d) => d.hash_documento)
  );
  const seenInBatch = new Set<string>();
  const toInsert: FiscalDocument[] = [];

  onProgress?.({ done: 0, total: all.length });
  const nowIso = new Date().toISOString();

  for (let i = 0; i < all.length; i++) {
    const { arquivo, xml } = all[i];
    if (!xml) {
      summary.erros++;
      summary.detalhesErros.push({ arquivo, motivo: "Arquivo vazio ou ilegível" });
    } else {
      const parsed = parseFiscalXml(xml);
      if (!parsed.ok) {
        summary.erros++;
        summary.detalhesErros.push({ arquivo, motivo: parsed.error });
      } else {
        try {
          const hash = await buildHash(parsed.nota);
          if (existingHashes.has(hash) || seenInBatch.has(hash)) {
            summary.duplicadas++;
          } else {
            seenInBatch.add(hash);
            toInsert.push({
              ...parsed.nota,
              status_manual: "Ativo",
              origem_arquivo: arquivo,
              data_importacao: nowIso,
              hash_documento: hash,
            });
            summary.importadas++;
          }
        } catch (e: any) {
          summary.erros++;
          summary.detalhesErros.push({
            arquivo,
            motivo: e?.message || "Erro inesperado ao processar nota",
          });
        }
      }
    }
    if ((i + 1) % 25 === 0 || i + 1 === all.length) {
      onProgress?.({ done: i + 1, total: all.length });
    }
  }

  // Grava em lote (bulkPut sobrescreve por id_nota — mas só inserimos não-duplicadas por hash)
  if (toInsert.length > 0) {
    await db.documents.bulkPut(toInsert);
  }

  const audit: ImportAudit = {
    data_hora: nowIso,
    arquivo: files.map((f) => f.name).join(", "),
    xmls_encontrados: summary.encontrados,
    importadas: summary.importadas,
    duplicadas: summary.duplicadas,
    erros: summary.erros,
    detalhes_erros: summary.detalhesErros.slice(0, 100),
  };
  await db.audits.add(audit);

  return summary;
}
