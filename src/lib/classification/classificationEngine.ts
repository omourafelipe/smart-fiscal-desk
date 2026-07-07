import {
  ServiceDataInput,
  ClassificationResult,
  MappingEntry,
  ClassificationSource,
  ConfidenceLevel,
} from './types';
import { serviceTypeMapping } from './serviceTypeMapping';
import { municipalServiceMapping } from './municipalServiceMapping';
import { lc116Mapping } from './lc116Mapping';
import { nbsMapping } from './nbsMapping';
import { keywordMapping } from './keywordMapping';

export class ClassificationEngine {
  /**
   * Classifica um serviço baseado nos dados recebidos do XML da NFS-e.
   * Aplica a ordem de prioridade definida:
   * 1. Tipo de Serviço
   * 2. Código Municipal
   * 3. LC 116/2003
   * 4. NBS
   * 5. Palavras-chave na descrição
   * 6. Fallback Manual
   */
  public static classify(data: ServiceDataInput): ClassificationResult {
    // 1. Tipo de Serviço (Prioridade 1, Confiança: Muito Alta)
    if (data.serviceType) {
      const normalizedServiceType = data.serviceType.trim().toLowerCase();
      const match = serviceTypeMapping[normalizedServiceType];
      if (match) {
        return this.buildResult(data, match, 'Tipo de Serviço', 'Muito Alta');
      }
    }

    // 2. Código Municipal (Prioridade 2, Confiança: Alta)
    if (data.municipalCode) {
      const normalizedMunicipalCode = data.municipalCode.trim();
      const match = municipalServiceMapping[normalizedMunicipalCode];
      if (match) {
        return this.buildResult(data, match, 'Código Municipal', 'Alta');
      }
    }

    // 3. LC 116/2003 (Prioridade 3, Confiança: Alta)
    if (data.lc116Code) {
      const normalizedLc116Code = data.lc116Code.trim();
      const match = lc116Mapping[normalizedLc116Code];
      if (match) {
        return this.buildResult(data, match, 'LC 116', 'Alta');
      }
    }

    // 4. Código NBS (Prioridade 4, Confiança: Alta)
    if (data.nbsCode) {
      const normalizedNbsCode = data.nbsCode.trim();
      const match = nbsMapping[normalizedNbsCode];
      if (match) {
        return this.buildResult(data, match, 'NBS', 'Alta');
      }
    }

    // 5. Descrição Similar / Palavras-chave (Prioridade 5, Confiança: Média)
    if (data.description) {
      const descriptionLowerCase = data.description.toLowerCase();
      // Procura a primeira palavra-chave que dê match na descrição
      for (const [keyword, mapping] of Object.entries(keywordMapping)) {
        if (descriptionLowerCase.includes(keyword)) {
          return this.buildResult(data, mapping, 'Descrição Similar', 'Média');
        }
      }
    }

    // 6. Nenhuma regra atendeu (Fallback Manual, Confiança: Baixa)
    const fallbackMapping: MappingEntry = {
      categoria: 'Não Classificado',
      grupo: 'Pendente',
      subgrupo: 'Pendente',
    };
    return this.buildResult(data, fallbackMapping, 'Manual', 'Baixa');
  }

  /**
   * Constrói o objeto de resultado de classificação.
   */
  private static buildResult(
    input: ServiceDataInput,
    mapping: MappingEntry,
    source: ClassificationSource,
    confidence: ConfidenceLevel
  ): ClassificationResult {
    return {
      categoria: mapping.categoria,
      grupo: mapping.grupo,
      subgrupo: mapping.subgrupo,
      tipoOriginal: input.serviceType || null,
      codigoMunicipal: input.municipalCode || null,
      codigoLc116: input.lc116Code || null,
      codigoNbs: input.nbsCode || null,
      descricaoOriginal: input.description || null,
      fonteClassificacao: source,
      nivelConfianca: confidence,
    };
  }
}
