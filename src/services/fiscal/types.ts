export interface ClassifyServiceRequest {
  descricao_servico: string;
}

export interface ClassifyServiceResponse {
  categoria: string;
  grupo: string;
  centro_receita: string;
  subcategoria: string;
  nivel_confianca: 'Muito Alta' | 'Alta' | 'Média' | 'Baixa';
  score_confianca: number; // 0.0 a 1.0
}

export interface TomadorDocumento {
  documento: string; // normalizado (somente números)
  tipo: 'CPF' | 'CNPJ' | 'Desconhecido';
  valido: boolean;
  formatado: string;
  nome_sugerido?: string; // nome do tomador se encontrado (por exemplo, associado ao CPF/CNPJ mockado)
}

export interface ClassificationFeedback {
  descricao_servico: string;
  categoria_sugerida: string;
  categoria_correta: string;
  grupo_correto: string;
  centro_receita_correto: string;
  subcategoria_correta: string;
  aprovado: boolean;
}
