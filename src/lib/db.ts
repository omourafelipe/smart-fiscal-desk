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
  hash_documento: string;  // SHA-256
  // Serviço (preenchido a partir da versão 2 do schema)
  item_lista_servico?: string;
  codigo_servico?: string;
  descricao_servico?: string;
  // Classificações (preenchidas a partir da versão 3 do schema)
  categoria?: string;
  grupo?: string;
  centro_receita?: string;
  subcategoria?: string;
  regra_aplicada_id?: number;
  municipio?: string;
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

export type RuleType = "cliente" | "palavra_chave" | "codigo_exato" | "faixa_codigo" | "municipio" | "padrao";

export interface TaxRule {
  id?: number;
  nome: string;
  tipo: RuleType;
  // Condições
  valor_cliente?: string;       // CNPJ ou nome do cliente
  valor_palavra_chave?: string; // palavra-chave na descrição do serviço
  valor_codigo_exato?: string;  // código municipal ou LC 116 exato
  valor_faixa_inicio?: string;  // código inicial da faixa
  valor_faixa_fim?: string;     // código final da faixa
  valor_municipio?: string;     // município (nome ou código IBGE)
  // Saídas gerenciais
  categoria: string;
  grupo: string;
  centro_receita: string;
  subcategoria: string;
}

class FiscalDB extends Dexie {
  documents!: Table<FiscalDocument, string>;
  groupCnpjs!: Table<GroupCnpj, string>;
  audits!: Table<ImportAudit, number>;
  taxRules!: Table<TaxRule, number>;

  constructor() {
    super("smart-fiscal-desk");
    this.version(1).stores({
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento",
      groupCnpjs: "cnpj",
      audits: "++id, data_hora",
    });
    // v2: adiciona campos opcionais de serviço (item_lista_servico, codigo_servico, descricao_servico)
    // Não requer novos índices — upgrade vazio é suficiente.
    this.version(2).stores({});
    // v3: adiciona regras tributárias para classificação gerencial
    this.version(3).stores({
      taxRules: "++id, tipo, categoria, grupo",
    });
  }
}

export const db = new FiscalDB();

export async function clearAllFiscalData() {
  await db.documents.clear();
  await db.audits.clear();
}
