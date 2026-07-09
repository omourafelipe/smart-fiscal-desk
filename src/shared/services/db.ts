import Dexie, { type Table } from "dexie";
import { tributaryCodeMapping } from "../../lib/classification/tributaryCodeMapping";
import { lc116Mapping } from "../../lib/classification/lc116Mapping";
import { nbsMapping } from "../../lib/classification/nbsMapping";
import { keywordMapping } from "../../lib/classification/keywordMapping";
import type {
  FiscalDocument,
  Empresa,
  Cliente,
  ImportAudit,
  ClassificationRule,
  TaxRule
} from "../types";

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

class FiscalDB extends Dexie {
  documents!: Table<FiscalDocument, string>;
  audits!: Table<ImportAudit, number>;
  taxRules!: Table<TaxRule, number>;
  empresas!: Table<Empresa, string>;
  clientes!: Table<Cliente, string>;
  classificationRules!: Table<ClassificationRule, number>;

  constructor() {
    super("smart-fiscal-desk");
    
    // Maintain old schemas for seamless updates
    this.version(1).stores({
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento",
      groupCnpjs: "cnpj",
      audits: "++id, data_hora",
    });
    this.version(2).stores({});
    this.version(3).stores({
      taxRules: "++id, tipo, categoria, grupo",
    });
    this.version(4).stores({
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento, categoria_sintetica, categoria_origem",
    });
    this.version(5).stores({
      empresas: "cnpj",
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento, categoria_sintetica, categoria_origem, empresa_cnpj",
    });
    this.version(6).stores({
      classificationRules: "++id, prioridade, tipo_regra, padrao_busca",
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento, categoria_sintetica, categoria_origem, empresa_cnpj, tipo_servico, data_emissao",
    });
    
    // v7: Add Data Warehouse Analytics (clientes, additional query indices)
    this.version(7).stores({
      clientes: "cnpj, razao_social, primeira_nota, ultima_nota",
      empresas: "cnpj, cnpj_holding",
      documents: "id_nota, data_competencia, cnpj_prestador, cnpj_tomador, status_manual, hash_documento, categoria_sintetica, categoria_origem, empresa_cnpj, tipo_servico, data_emissao, validacao_status",
    });
  }
}

export const db = new FiscalDB();

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
  await db.empresas.clear();
  await db.clientes.clear();
}
