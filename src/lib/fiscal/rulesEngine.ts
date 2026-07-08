import { db, type FiscalDocument, type ClassificationRule } from "../db";
import { ClassificationEngine } from "../classification/classificationEngine";

/**
 * Classifica um único documento aplicando a regra correspondente do banco.
 */
export function classifyDocument(doc: FiscalDocument, rules: ClassificationRule[]): FiscalDocument {
  const result = ClassificationEngine.classify({
    codigoTributario: doc.codigo_servico,
    municipalCode:   doc.codigo_servico,
    lc116Code:       doc.item_lista_servico,
    description:     doc.descricao_servico,
    descricao_codigo_tributario: doc.descricao_codigo_tributario,
    descricao_nbs: doc.descricao_nbs,
    nbsCode: doc.codigo_nbs,
  } as any, rules);

  return {
    ...doc,
    categoria_sintetica:     result.categoria,
    categoria_origem:        result.categoriaOrigem,
    confianca_classificacao: result.confiancaClassificacao,
    tipo_servico:            result.grupo, // Tipo de Serviço
    categoria:               result.categoria, // compatibilidade
    grupo:                   result.grupo, // compatibilidade
  };
}

/**
 * Recalcula a classificação de todos os documentos no banco com base nas regras dinâmicas atuais.
 */
export async function recalculateAllClassifications(): Promise<void> {
  await reclassifyAllSintetico();
}

/**
 * Reclassifica todos os documentos usando o motor sintético automático baseado nas regras do banco.
 *
 * @param onProgress Callback com progresso { done, total }
 * @returns Estatísticas da reclassificação
 */
export async function reclassifyAllSintetico(
  onProgress?: (p: { done: number; total: number }) => void
): Promise<{ total: number; codigoTributario: number; lc116: number; nbs: number; heuristica: number; naoClassificado: number }> {
  const docs = await db.documents.toArray();
  const rules = await db.classificationRules.toArray();
  const total = docs.length;

  const stats = {
    total,
    codigoTributario: 0,
    lc116: 0,
    nbs: 0,
    heuristica: 0,
    naoClassificado: 0,
  };

  const updatedDocs: FiscalDocument[] = [];
  const BATCH = 100;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    // 1. Classificação via Motor
    const result = ClassificationEngine.classify({
      codigoTributario: doc.codigo_servico,
      municipalCode:   doc.codigo_servico,
      lc116Code:       doc.item_lista_servico,
      description:     doc.descricao_servico,
      descricao_codigo_tributario: doc.descricao_codigo_tributario,
      descricao_nbs: doc.descricao_nbs,
      nbsCode: doc.codigo_nbs,
    } as any, rules);

    // 2. Acumula estatísticas
    switch (result.categoriaOrigem) {
      case 'CODIGO_TRIBUTARIO': 
        if (result.fonteClassificacao === 'LC 116') stats.lc116++;
        else stats.codigoTributario++; 
        break;
      case 'LC116':             stats.lc116++;             break;
      case 'NBS':               stats.nbs++;               break;
      case 'HEURISTICA':        stats.heuristica++;        break;
      case 'NAO_CLASSIFICADO':  stats.naoClassificado++;   break;
    }

    // 3. Atualiza o documento
    const updatedDoc: FiscalDocument = {
      ...doc,
      categoria_sintetica:     result.categoria,
      categoria_origem:        result.categoriaOrigem,
      confianca_classificacao: result.confiancaClassificacao,
      tipo_servico:            result.grupo,
      categoria:               result.categoria,
      grupo:                   result.grupo,
    };

    updatedDocs.push(updatedDoc);

    // 4. Flush em lote
    if ((i + 1) % BATCH === 0 || i + 1 === total) {
      await db.documents.bulkPut(updatedDocs.splice(0, updatedDocs.length));
      onProgress?.({ done: i + 1, total });
    }
  }

  return stats;
}
