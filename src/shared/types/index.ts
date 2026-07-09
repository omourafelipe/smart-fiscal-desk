export type StatusManual = "Ativo" | "Cancelado";
export type CategoriaOrigem = "CODIGO_TRIBUTARIO" | "LC116" | "NBS" | "HEURISTICA" | "NAO_CLASSIFICADO";

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
  item_lista_servico?: string;  // ex: "01.01" (LC 116)
  codigo_servico?: string;      // código municipal
  descricao_servico?: string;   // discriminação do serviço
  
  // Classificações manuais / automáticas
  categoria?: string;
  grupo?: string;
  centro_receita?: string;
  subcategoria?: string;
  regra_aplicada_id?: number;
  
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
  
  // Auditoria e Validação Fiscal
  validacao_status?: "valido" | "inconsistente" | "erro";
  validacao_alertas?: string[]; // lista de inconsistências encontradas
}

export interface Empresa {
  cnpj: string; // Chave primária
  razao_social: string;
  nome_fantasia?: string;
  municipio?: string;
  uf?: string;
  inscricao_municipal?: string;
  regime_tributario?: string;
  cnpj_holding?: string; // para relacionamento e consolidação de grupo econômico
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

export interface Cliente {
  cnpj: string; // Chave primária
  razao_social: string;
  municipio?: string;
  uf?: string;
  primeira_nota: string;
  ultima_nota: string;
  valor_total: number;
  quantidade_notas: number;
  ativo: boolean;
}

export interface EconomicGroup {
  cnpj_holding: string;
  nome_grupo: string;
  empresas_associadas: string[]; // lista de CNPJ
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

export interface ClassificationRule {
  id?: number;
  prioridade: number; // 1: Código exato, 2: Descrição código, 3: Descrição NBS, 4: Palavra-chave, 5: Fallback
  tipo_regra: 'codigo_tributario' | 'descricao_codigo' | 'descricao_nbs' | 'palavra_chave' | 'fallback';
  padrao_busca: string;
  tipo_servico: string; // ex: "Tecnologia"
  categoria_sintetica: string; // ex: "Tecnologia" ou "Assistência à Saúde"
  descricao_regra?: string;
}

export interface TaxRule {
  id?: number;
  nome: string;
  tipo: "cliente" | "palavra_chave" | "codigo_exato" | "faixa_codigo" | "municipio" | "padrao";
  valor_cliente?: string;
  valor_palavra_chave?: string;
  valor_codigo_exato?: string;
  valor_faixa_inicio?: string;
  valor_faixa_fim?: string;
  valor_municipio?: string;
  categoria: string;
  grupo: string;
  centro_receita: string;
  subcategoria: string;
}
