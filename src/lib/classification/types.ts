export type ConfidenceLevel = 'Muito Alta' | 'Alta' | 'Média' | 'Baixa';

export type ClassificationSource = 
  | 'Tipo de Serviço'
  | 'Código Municipal'
  | 'LC 116'
  | 'NBS'
  | 'Descrição Similar'
  | 'Manual';

export interface ServiceDataInput {
  serviceType?: string;
  municipalCode?: string;
  lc116Code?: string;
  nbsCode?: string;
  description?: string;
  cnae?: string;
}

export interface ClassificationResult {
  categoria: string;
  grupo: string;
  subgrupo: string;
  tipoOriginal: string | null;
  codigoMunicipal: string | null;
  codigoLc116: string | null;
  codigoNbs: string | null;
  descricaoOriginal: string | null;
  fonteClassificacao: ClassificationSource;
  nivelConfianca: ConfidenceLevel;
}

export interface MappingEntry {
  categoria: string;
  grupo: string;
  subgrupo: string;
}
