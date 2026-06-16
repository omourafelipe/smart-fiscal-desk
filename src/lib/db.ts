import Dexie, { type Table } from "dexie";

export type StatusManual = "Ativo" | "Cancelado";

export interface FiscalDocument {
  id_nota: string;
  data_competencia: string; // YYYY-MM-DD
  cnpj_prestador: string;
  cnpj_tomador: string;
  nome_prestador?: string;
  nome_tomador?: string;
  valor_bruto: number;
  valor_retido: number;
  valor_liquido: number;
  status_manual: StatusManual;
  origem_arquivo: string;
  data_importacao: string; // ISO
  hash_documento: string; // SHA-256
}

export interface GroupCnpj {
  cnpj: string; // somente dígitos
  nome?: string;
  criado_em: string;
}

export interface ImportAudit {
  id?: number;
  data_hora: string;
  arquivo: string;
  xmls_encontrados: number;
  importadas: number;
  duplicadas: number;
  erros: number;
  detalhes_erros: { arquivo: string; motivo: string }[];
}

class FiscalDB extends Dexie {
  documents!: Table<FiscalDocument, string>;
  groupCnpjs!: Table<GroupCnpj, string>;
  audits!: Table<ImportAudit, number>;

  constructor() {
    super("smart-fiscal-desk");
    this.version(1).stores({
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento",
      groupCnpjs: "cnpj",
      audits: "++id, data_hora",
    });
  }
}

export const db = new FiscalDB();

export async function clearAllFiscalData() {
  await db.documents.clear();
  await db.audits.clear();
}
