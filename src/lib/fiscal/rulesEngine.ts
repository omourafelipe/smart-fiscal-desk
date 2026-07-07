import { db, type FiscalDocument, type TaxRule } from "../db";

const PRIORIDADES = {
  cliente: 1,
  palavra_chave: 2,
  codigo_exato: 3,
  faixa_codigo: 4,
  municipio: 5,
  padrao: 6,
};

/**
 * Normaliza um CNPJ removendo tudo exceto números.
 */
function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/**
 * Normaliza códigos de serviço para comparação (ex: remove pontos, hifens e espaços)
 */
function cleanCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Valida se um documento fiscal atende às condições de uma regra específica.
 */
export function matchRule(doc: FiscalDocument, rule: TaxRule): boolean {
  switch (rule.tipo) {
    case "cliente": {
      if (!rule.valor_cliente) return false;
      const cleanVal = cleanCnpj(rule.valor_cliente);
      const cleanDocTomador = cleanCnpj(doc.cnpj_tomador || "");
      
      // Se a regra for CNPJ e bater com o tomador
      if (cleanVal && cleanDocTomador === cleanVal) return true;
      
      // Fallback: busca por nome do tomador
      const searchName = rule.valor_cliente.toLowerCase().trim();
      const docName = (doc.nome_tomador || "").toLowerCase().trim();
      if (searchName && docName.includes(searchName)) return true;
      
      return false;
    }

    case "palavra_chave": {
      if (!rule.valor_palavra_chave) return false;
      const kw = rule.valor_palavra_chave.toLowerCase().trim();
      const desc = (doc.descricao_servico || "").toLowerCase().trim();
      return desc.includes(kw);
    }

    case "codigo_exato": {
      if (!rule.valor_codigo_exato) return false;
      const target = cleanCode(rule.valor_codigo_exato);
      const docCod = cleanCode(doc.codigo_servico || "");
      const docItem = cleanCode(doc.item_lista_servico || "");
      return docCod === target || docItem === target;
    }

    case "faixa_codigo": {
      if (!rule.valor_faixa_inicio || !rule.valor_faixa_fim) return false;
      const start = cleanCode(rule.valor_faixa_inicio);
      const end = cleanCode(rule.valor_faixa_fim);
      
      const docCod = cleanCode(doc.codigo_servico || "");
      const docItem = cleanCode(doc.item_lista_servico || "");
      
      const checkRange = (val: string) => {
        if (!val) return false;
        // Se puder converter para número, compara numericamente
        const numVal = Number(val);
        const numStart = Number(start);
        const numEnd = Number(end);
        if (!isNaN(numVal) && !isNaN(numStart) && !isNaN(numEnd)) {
          return numVal >= numStart && numVal <= numEnd;
        }
        // Caso contrário, comparação lexicográfica
        return val >= start && val <= end;
      };

      return checkRange(docCod) || checkRange(docItem);
    }

    case "municipio": {
      if (!rule.valor_municipio) return false;
      const mRule = rule.valor_municipio.toLowerCase().trim();
      const mDoc = (doc.municipio || "").toLowerCase().trim();
      return mDoc.includes(mRule);
    }

    case "padrao":
      return true;

    default:
      return false;
  }
}

/**
 * Classifica um único documento aplicando a regra correspondente de maior prioridade.
 */
export function classifyDocument(doc: FiscalDocument, rules: TaxRule[]): FiscalDocument {
  const matchingRules = rules.filter((rule) => matchRule(doc, rule));

  if (matchingRules.length === 0) {
    // Limpa a classificação caso não haja correspondência
    return {
      ...doc,
      categoria: undefined,
      grupo: undefined,
      centro_receita: undefined,
      subcategoria: undefined,
      regra_aplicada_id: undefined,
    };
  }

  // Ordena por ordem de prioridade (menor valor de PRIORIDADE primeiro)
  // E dentro da mesma prioridade, ordena pelo ID mais novo da regra (mais específica/recente)
  matchingRules.sort((a, b) => {
    const prioA = PRIORIDADES[a.tipo] || 99;
    const prioB = PRIORIDADES[b.tipo] || 99;
    if (prioA !== prioB) return prioA - prioB;
    return (b.id || 0) - (a.id || 0);
  });

  const rule = matchingRules[0];

  return {
    ...doc,
    categoria: rule.categoria,
    grupo: rule.grupo,
    centro_receita: rule.centro_receita,
    subcategoria: rule.subcategoria,
    regra_aplicada_id: rule.id,
  };
}

/**
 * Recalcula a classificação de todos os documentos no banco com base nas regras atuais.
 */
export async function recalculateAllClassifications(rules?: TaxRule[]): Promise<void> {
  const activeRules = rules || (await db.taxRules.toArray());
  const docs = await db.documents.toArray();
  
  const updatedDocs = docs.map((doc) => classifyDocument(doc, activeRules));
  
  if (updatedDocs.length > 0) {
    await db.documents.bulkPut(updatedDocs);
  }
}
