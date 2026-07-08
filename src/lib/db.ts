import Dexie, { type Table } from "dexie";
import { tributaryCodeMapping } from "./classification/tributaryCodeMapping";
import { lc116Mapping } from "./classification/lc116Mapping";
import { nbsMapping } from "./classification/nbsMapping";
import { keywordMapping } from "./classification/keywordMapping";

export type StatusManual = "Ativo" | "Cancelado";
export type CategoriaOrigem = "CODIGO_TRIBUTARIO" | "LC116" | "NBS" | "HEURISTICA" | "NAO_CLASSIFICADO";

export interface ClassificationRule {
  id?: number;
  prioridade: number; // 1: Código exato, 2: Descrição código, 3: Descrição NBS, 4: Palavra-chave, 5: Fallback
  tipo_regra: 'codigo_tributario' | 'descricao_codigo' | 'descricao_nbs' | 'palavra_chave' | 'fallback';
  padrao_busca: string;
  tipo_servico: string; // ex: "Tecnologia"
  categoria_sintetica: string; // ex: "Tecnologia" ou "Assistência à Saúde"
  descricao_regra?: string;
}

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
  // Serviço
  item_lista_servico?: string;
  codigo_servico?: string;
  descricao_servico?: string;
  // Classificações manuais (legacy/compatibilidade)
  categoria?: string;
  grupo?: string;
  centro_receita?: string;
  subcategoria?: string;
  regra_aplicada_id?: number;
  // Classificação Sintética Automática
  categoria_sintetica?: string;
  categoria_origem?: CategoriaOrigem;
  confianca_classificacao?: number; // 0-100
  municipio?: string;
  vlr_iss?: number;
  vlr_iss_ret?: number;
  vlr_iss_recolher?: number;
  iss_retido?: "Sim" | "Não";
  vlr_csll?: number;
  vlr_irrf?: number;
  vlr_pis?: number;
  vlr_cofins?: number;
  vlr_inss?: number;
  raw?: string;
  // Grupo Econômico
  empresa_cnpj?: string;
  empresa_nome?: string;
  // Novos campos do PRD
  descricao_codigo_tributario?: string;
  codigo_nbs?: string;
  descricao_nbs?: string;
  tipo_servico?: string;
  iss_proprio?: number;
  data_emissao?: string; // YYYY-MM-DD
}

export interface Empresa {
  cnpj: string; // Chave primária
  razao_social: string;
  nome_fantasia?: string;
  municipio?: string;
  uf?: string;
  primeira_importacao: string; // ISO Date
  ultima_importacao: string; // ISO Date
  quantidade_notas: number;
  valor_total: number;
  iss_total: number;
  irrf_total: number;
  pis_total: number;
  cofins_total: number;
  csll_total: number;
  ativo: boolean;
  origem_cadastro: "XML" | "MANUAL" | "IMPORTACAO";
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
  empresas!: Table<Empresa, string>;
  classificationRules!: Table<ClassificationRule, number>;

  constructor() {
    super("smart-fiscal-desk");
    this.version(1).stores({
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento",
      groupCnpjs: "cnpj",
      audits: "++id, data_hora",
    });
    // v2: adiciona campos opcionais de serviço (item_lista_servico, codigo_servico, descricao_servico)
    this.version(2).stores({});
    // v3: adiciona regras tributárias para classificação gerencial
    this.version(3).stores({
      taxRules: "++id, tipo, categoria, grupo",
    });
    // v4: adiciona classificação sintética automática (PRD Sintético)
    this.version(4).stores({
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento, categoria_sintetica, categoria_origem",
    });
    // v5: adiciona tabela de empresas do grupo (PRD)
    this.version(5).stores({
      empresas: "cnpj",
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento, categoria_sintetica, categoria_origem, empresa_cnpj",
    });
    // v6: tabela central de regras de classificação
    this.version(6).stores({
      classificationRules: "++id, prioridade, tipo_regra, padrao_busca",
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento, categoria_sintetica, categoria_origem, empresa_cnpj, tipo_servico, data_emissao",
    });
  }
}

export const db = new FiscalDB();

export const TIPO_TO_CATEGORIA_MAP: Record<string, string> = {
  'Plano de Saúde': 'Assistência à Saúde',
  'Serviços Hospitalares': 'Assistência à Saúde',
  'Diagnóstico Laboratorial': 'Assistência à Saúde',
  'Atendimento Médico': 'Assistência à Saúde',
  'Consultoria': 'Consultorias',
  'Consultoria Tributária': 'Consultorias',
  'Consultoria Jurídica': 'Consultorias',
  'Consultoria Empresarial': 'Consultorias',
  'Tecnologia': 'Tecnologia',
  'Treinamentos': 'Educação',
  'Educação': 'Educação',
  'Locação': 'Locação',
  'Publicidade': 'Marketing',
  'Transporte': 'Logística',
  'Engenharia': 'Obras e Engenharia',
  'Construção Civil': 'Obras e Engenharia',
  'Serviços Administrativos': 'Serviços Administrativos',
  'Jurídico': 'Consultorias',
  'Financeiro': 'Financeiro',
  'Outros Serviços': 'Outros Serviços',
};

async function seedClassificationRules() {
  const count = await db.classificationRules.count();
  if (count > 0) return;

  const rulesToInsert: ClassificationRule[] = [];

  // 1. Prioridade 1: Código Tributário Municipal (tributaryCodeMapping)
  Object.entries(tributaryCodeMapping).forEach(([code, mapping]) => {
    rulesToInsert.push({
      prioridade: 1,
      tipo_regra: 'codigo_tributario',
      padrao_busca: code,
      tipo_servico: mapping.categoria,
      categoria_sintetica: TIPO_TO_CATEGORIA_MAP[mapping.categoria] || 'Outros Serviços',
      descricao_regra: `Código Municipal: ${code} (${mapping.subgrupo})`
    });
  });

  // 2. Prioridade 1: Código LC 116 (lc116Mapping)
  Object.entries(lc116Mapping).forEach(([code, mapping]) => {
    rulesToInsert.push({
      prioridade: 1,
      tipo_regra: 'codigo_tributario',
      padrao_busca: code,
      tipo_servico: mapping.categoria,
      categoria_sintetica: TIPO_TO_CATEGORIA_MAP[mapping.categoria] || 'Outros Serviços',
      descricao_regra: `Código LC 116: ${code} (${mapping.subgrupo})`
    });
  });

  // 3. Prioridade 2: Descrição do Código Tributário (Heurística baseada em códigos oficiais)
  const defaultDescRules: { padrao: string; servico: string }[] = [
    { padrao: "desenvolvimento de sistemas", servico: "Tecnologia" },
    { padrao: "licenciamento de software", servico: "Tecnologia" },
    { padrao: "processamento de dados", servico: "Tecnologia" },
    { padrao: "medicina de grupo", servico: "Plano de Saúde" },
    { padrao: "clinicas e hospitais", servico: "Serviços Hospitalares" },
    { padrao: "consultas medicas", servico: "Atendimento Médico" },
    { padrao: "analises clinicas", servico: "Diagnóstico Laboratorial" },
    { padrao: "assessoria empresarial", servico: "Consultoria" },
    { padrao: "consultoria tecnica", servico: "Consultoria" },
    { padrao: "locacao de bens moveis", servico: "Locação" },
    { padrao: "publicidade e propaganda", servico: "Publicidade" },
    { padrao: "transporte municipal", servico: "Transporte" },
    { padrao: "projetos de engenharia", servico: "Engenharia" },
    { padrao: "construcao de edificios", servico: "Construção Civil" },
    { padrao: "limpeza e conservacao", servico: "Serviços Administrativos" },
    { padrao: "vigilancia e seguranca", servico: "Serviços Administrativos" }
  ];
  defaultDescRules.forEach((r) => {
    rulesToInsert.push({
      prioridade: 2,
      tipo_regra: 'descricao_codigo',
      padrao_busca: r.padrao,
      tipo_servico: r.servico,
      categoria_sintetica: TIPO_TO_CATEGORIA_MAP[r.servico] || 'Outros Serviços',
      descricao_regra: `Filtro de descrição oficial do código tributário`
    });
  });

  // 4. Prioridade 3: Descrição NBS (nbsMapping)
  Object.entries(nbsMapping).forEach(([nbsDesc, mapping]) => {
    rulesToInsert.push({
      prioridade: 3,
      tipo_regra: 'descricao_nbs',
      padrao_busca: nbsDesc,
      tipo_servico: mapping.categoria,
      categoria_sintetica: TIPO_TO_CATEGORIA_MAP[mapping.categoria] || 'Outros Serviços',
      descricao_regra: `Descrição NBS similar`
    });
  });

  // 5. Prioridade 4: Palavras-chave (keywordMapping)
  keywordMapping.forEach(([keyword, mapping]) => {
    rulesToInsert.push({
      prioridade: 4,
      tipo_regra: 'palavra_chave',
      padrao_busca: keyword,
      tipo_servico: mapping.categoria,
      categoria_sintetica: TIPO_TO_CATEGORIA_MAP[mapping.categoria] || 'Outros Serviços',
      descricao_regra: `Heurística de palavra-chave na descrição`
    });
  });

  // 6. Prioridade 5: Fallback padrão ("Outros Serviços")
  rulesToInsert.push({
    prioridade: 5,
    tipo_regra: 'fallback',
    padrao_busca: '*',
    tipo_servico: 'Outros Serviços',
    categoria_sintetica: 'Outros Serviços',
    descricao_regra: 'Fallback caso nenhuma regra corresponda'
  });

  await db.classificationRules.bulkAdd(rulesToInsert);
}

db.on("ready", async () => {
  try {
    await seedClassificationRules();
  } catch (err) {
    console.error("Falha ao semear regras de classificação:", err);
  }
});

export async function clearAllFiscalData() {
  await db.documents.clear();
  await db.audits.clear();
}

