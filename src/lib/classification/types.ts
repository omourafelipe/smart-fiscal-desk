// ─── Tipos de Origem da Classificação ────────────────────────────────────────
export type CategoriaOrigem =
  | 'CODIGO_TRIBUTARIO'  // Código municipal 6 dígitos – confiança 100
  | 'LC116'             // Código LC 116 – confiança 95
  | 'NBS'               // Descrição/código NBS – confiança 90
  | 'HEURISTICA'        // Palavras-chave na descrição – confiança 70
  | 'NAO_CLASSIFICADO'; // Nenhuma regra encontrada – confiança 0

// ─── Nível de Confiança (legível) ────────────────────────────────────────────
export type ConfidenceLevel = 'Muito Alta' | 'Alta' | 'Média' | 'Baixa';

// ─── Fonte histórica (compatibilidade) ───────────────────────────────────────
export type ClassificationSource =
  | 'Tipo de Serviço'
  | 'Código Municipal'
  | 'LC 116'
  | 'NBS'
  | 'Descrição Similar'
  | 'Manual';

// ─── 16 Categorias Sintéticas Executivas ─────────────────────────────────────
export const CATEGORIAS_SINTETICAS = [
  'Plano de Saúde',
  'Serviços Hospitalares',
  'Atendimento Médico',
  'Diagnóstico Laboratorial',
  'Consultoria',
  'Tecnologia',
  'Educação',
  'Locação',
  'Transporte',
  'Publicidade',
  'Construção Civil',
  'Engenharia',
  'Jurídico',
  'Financeiro',
  'Serviços Administrativos',
  'Outros Serviços',
] as const;

export type CategoriaSintetica = (typeof CATEGORIAS_SINTETICAS)[number];

// ─── Input para o motor de classificação ─────────────────────────────────────
export interface ServiceDataInput {
  /** Código tributário municipal (ex: "042201") */
  codigoTributario?: string;
  /** Código LC 116 (ex: "4.01", "1.01") */
  lc116Code?: string;
  /** Código do serviço municipal (ex: "040301") */
  municipalCode?: string;
  /** Código NBS */
  nbsCode?: string;
  /** Descrição livre do serviço (discriminação da nota) */
  description?: string;
  // legacy support
  serviceType?: string;
  cnae?: string;
}

// ─── Resultado do Motor ───────────────────────────────────────────────────────
export interface ClassificationResult {
  /** Categoria sintética executiva */
  categoria: string;
  /** Grupo operacional (compatibilidade) */
  grupo: string;
  /** Subgrupo analítico */
  subgrupo: string;
  /** Campos legacy */
  tipoOriginal: string | null;
  codigoMunicipal: string | null;
  codigoLc116: string | null;
  codigoNbs: string | null;
  descricaoOriginal: string | null;
  fonteClassificacao: ClassificationSource;
  nivelConfianca: ConfidenceLevel;
  // ─── Campos do PRD ───
  /** Origem da classificação (para `categoria_origem`) */
  categoriaOrigem: CategoriaOrigem;
  /** Pontuação 0–100 (para `confianca_classificacao`) */
  confiancaClassificacao: number;
}

// ─── Entrada de mapeamento ────────────────────────────────────────────────────
export interface MappingEntry {
  categoria: string;
  grupo: string;
  subgrupo: string;
}
