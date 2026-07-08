import {
  ServiceDataInput,
  ClassificationResult,
  CategoriaOrigem,
} from './types';
import { ClassificationRule } from '../db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─── Motor Principal Dinâmico ──────────────────────────────────────────────────

export class ClassificationEngine {
  /**
   * Classifica um serviço NFS-e usando as regras cadastradas no banco de dados.
   *
   * As regras são ordenadas por prioridade (1 a 5) e ID decrescente.
   */
  public static classify(data: ServiceDataInput, rules: ClassificationRule[]): ClassificationResult {
    const sortedRules = [...rules].sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
      return (b.id || 0) - (a.id || 0);
    });

    const codigoTributario = normalizeCode(data.codigoTributario || data.municipalCode || '');
    const lc116 = normalizeCode(data.lc116Code || '');
    
    // Campos detalhados passados a partir do parser atualizado
    const xmlDescCodigo = normalizeText((data as any).descricao_codigo_tributario || '');
    const xmlDescNbs = normalizeText((data as any).descricao_nbs || '');
    const description = normalizeText(data.description || '');

    for (const rule of sortedRules) {
      const patternNorm = normalizeText(rule.padrao_busca);

      if (rule.tipo_regra === 'codigo_tributario') {
        const cleanPattern = normalizeCode(rule.padrao_busca);
        if (cleanPattern && (codigoTributario === cleanPattern || lc116 === cleanPattern)) {
          return this.buildResult(data, rule, 'CODIGO_TRIBUTARIO', 100);
        }
      }

      if (rule.tipo_regra === 'descricao_codigo') {
        if (patternNorm && (xmlDescCodigo.includes(patternNorm) || description.includes(patternNorm))) {
          return this.buildResult(data, rule, 'CODIGO_TRIBUTARIO', 95);
        }
      }

      if (rule.tipo_regra === 'descricao_nbs') {
        if (patternNorm && (xmlDescNbs.includes(patternNorm) || description.includes(patternNorm))) {
          return this.buildResult(data, rule, 'NBS', 90);
        }
      }

      if (rule.tipo_regra === 'palavra_chave') {
        if (patternNorm && description.includes(patternNorm)) {
          return this.buildResult(data, rule, 'HEURISTICA', 70);
        }
      }

      if (rule.tipo_regra === 'fallback') {
        return this.buildResult(data, rule, 'NAO_CLASSIFICADO', 0);
      }
    }

    // Fallback de segurança se nenhuma regra cadastrada coincidir
    return this.buildResult(
      data,
      {
        prioridade: 5,
        tipo_regra: 'fallback',
        padrao_busca: '*',
        tipo_servico: 'Outros Serviços',
        categoria_sintetica: 'Outros Serviços'
      },
      'NAO_CLASSIFICADO',
      0
    );
  }

  // ─── Builder ────────────────────────────────────────────────────────────────

  private static buildResult(
    input: ServiceDataInput,
    rule: ClassificationRule,
    origem: CategoriaOrigem,
    confianca: number
  ): ClassificationResult {
    const nivelConfianca =
      confianca >= 95 ? 'Muito Alta' :
      confianca >= 90 ? 'Alta'       :
      confianca >= 70 ? 'Média'      :
                        'Baixa';

    const fonteClassificacao =
      rule.tipo_regra === 'codigo_tributario' ? 'Código Municipal' :
      rule.tipo_regra === 'descricao_codigo' ? 'LC 116'           :
      rule.tipo_regra === 'descricao_nbs'     ? 'NBS'              :
      rule.tipo_regra === 'palavra_chave'     ? 'Descrição Similar':
                                                'Manual';

    return {
      categoria:               rule.categoria_sintetica, // Categoria Sintética
      grupo:                   rule.tipo_servico,        // Tipo de Serviço
      subgrupo:                rule.tipo_servico,
      tipoOriginal:            input.serviceType || null,
      codigoMunicipal:         input.municipalCode || input.codigoTributario || null,
      codigoLc116:             input.lc116Code || null,
      codigoNbs:               (input as any).nbsCode || null,
      descricaoOriginal:       input.description || null,
      fonteClassificacao,
      nivelConfianca,
      categoriaOrigem:         origem,
      confiancaClassificacao:  confianca,
    };
  }
}
