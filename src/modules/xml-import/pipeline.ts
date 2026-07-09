import { db } from "../../shared/services/db";
import type { FiscalDocument, Empresa, Cliente, ImportAudit } from "../../shared/types";
import { parseFiscalXml, buildHash } from "./parser";
import { classifyDocument } from "../classification/rulesEngine";
import { validateFiscalDocument } from "../fiscal-validation/validator";

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
  const toInsertDocs: FiscalDocument[] = [];
  
  // Cache current database records
  const currentEmpresas = await db.empresas.toArray();
  const empresasMap = new Map<string, Empresa>();
  for (const emp of currentEmpresas) {
    empresasMap.set(emp.cnpj, emp);
  }

  const currentClientes = await db.clientes.toArray();
  const clientesMap = new Map<string, Cliente>();
  for (const cli of currentClientes) {
    clientesMap.set(cli.cnpj, cli);
  }

  const rules = await db.classificationRules.toArray();
  const nowIso = new Date().toISOString();

  onProgress?.({ done: 0, total: all.length });

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

            const cnpjPrestador = parsed.nota.cnpj_prestador || "00000000000000";
            const nomePrestador = parsed.nota.nome_prestador || "Empresa Não Identificada";
            const cnpjTomador = parsed.nota.cnpj_tomador || "00000000000000";
            const nomeTomador = parsed.nota.nome_tomador || "Cliente Não Identificado";

            // 1. Auto Corporate Registry (Empresas)
            let emp = empresasMap.get(cnpjPrestador);
            if (!emp) {
              // Guess economic holding based on first 8 digits of CNPJ (standard root CNPJ)
              const cnpjHolding = cnpjPrestador.substring(0, 8);
              emp = {
                cnpj: cnpjPrestador,
                razao_social: nomePrestador,
                nome_fantasia: nomePrestador,
                municipio: parsed.nota.municipio || "",
                uf: "", // inferred or left empty
                inscricao_municipal: parsed.nota.codigo_servico ? parsed.nota.codigo_servico.substring(0, 8) : "",
                regime_tributario: "Simples Nacional", // default
                cnpj_holding: cnpjHolding,
                primeira_importacao: nowIso,
                ultima_importacao: nowIso,
                quantidade_notas: 0,
                valor_total: 0,
                iss_total: 0,
                irrf_total: 0,
                pis_total: 0,
                cofins_total: 0,
                csll_total: 0,
                ativo: true,
                origem_cadastro: "XML"
              };
            }
            emp.quantidade_notas += 1;
            emp.valor_total += Number(parsed.nota.valor_bruto || 0);
            emp.iss_total += Number(parsed.nota.vlr_iss || 0);
            emp.irrf_total += Number(parsed.nota.vlr_irrf || 0);
            emp.pis_total += Number(parsed.nota.vlr_pis || 0);
            emp.cofins_total += Number(parsed.nota.vlr_cofins || 0);
            emp.csll_total += Number(parsed.nota.vlr_csll || 0);
            emp.ultima_importacao = nowIso;
            empresasMap.set(cnpjPrestador, emp);

            // 2. Auto Client Registry (Clientes)
            let cli = clientesMap.get(cnpjTomador);
            if (!cli) {
              cli = {
                cnpj: cnpjTomador,
                razao_social: nomeTomador,
                municipio: parsed.nota.municipio || "",
                uf: "",
                primeira_nota: nowIso,
                ultima_nota: nowIso,
                valor_total: 0,
                quantidade_notas: 0,
                ativo: true
              };
            }
            cli.quantidade_notas += 1;
            cli.valor_total += Number(parsed.nota.valor_bruto || 0);
            cli.ultima_nota = nowIso;
            clientesMap.set(cnpjTomador, cli);

            // 3. Document validation
            const validation = validateFiscalDocument(parsed.nota);

            // 4. Compile document
            const rawDoc: FiscalDocument = {
              ...parsed.nota,
              status_manual: "Ativo",
              origem_arquivo: arquivo,
              data_importacao: nowIso,
              hash_documento: hash,
              empresa_cnpj: cnpjPrestador,
              empresa_nome: emp.razao_social,
              validacao_status: validation.status,
              validacao_alertas: validation.alertas,
            };

            // 5. Intelligent classification rules engine
            const classifiedDoc = classifyDocument(rawDoc, rules);

            toInsertDocs.push(classifiedDoc);
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

  // Bulk save
  if (toInsertDocs.length > 0) {
    await db.documents.bulkPut(toInsertDocs);
    const empresasParaSalvar = Array.from(empresasMap.values());
    if (empresasParaSalvar.length > 0) {
      await db.empresas.bulkPut(empresasParaSalvar);
    }
    const clientesParaSalvar = Array.from(clientesMap.values());
    if (clientesParaSalvar.length > 0) {
      await db.clientes.bulkPut(clientesParaSalvar);
    }
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
