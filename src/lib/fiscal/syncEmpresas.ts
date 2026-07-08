import { db, type Empresa } from "@/lib/db";

export async function sincronizarEmpresas() {
  const documents = await db.documents.toArray();
  const empresasMap = new Map<string, Empresa>();
  
  const nowIso = new Date().toISOString();

  for (const doc of documents) {
    const cnpjPrestador = doc.cnpj_prestador || "00000000000000";
    const nomePrestador = doc.nome_prestador || "Empresa Não Identificada";
    
    // Convert string to number safely just in case they were stored as string
    const vlrLiquido = Number(doc.valor_bruto || 0);
    const vlrIss = Number(doc.vlr_iss || 0);
    const vlrIrrf = Number(doc.vlr_irrf || 0);
    const vlrPis = Number(doc.vlr_pis || 0);
    const vlrCofins = Number(doc.vlr_cofins || 0);
    const vlrCsll = Number(doc.vlr_csll || 0);
    
    let emp = empresasMap.get(cnpjPrestador);
    if (!emp) {
      emp = {
        cnpj: cnpjPrestador,
        razao_social: nomePrestador,
        municipio: doc.municipio || "",
        primeira_importacao: doc.data_importacao || nowIso,
        ultima_importacao: doc.data_importacao || nowIso,
        quantidade_notas: 0,
        valor_total: 0,
        iss_total: 0,
        irrf_total: 0,
        pis_total: 0,
        cofins_total: 0,
        csll_total: 0,
        ativo: true,
        origem_cadastro: "IMPORTACAO"
      };
    }
    
    // Maintain min/max dates
    if (doc.data_importacao) {
      if (doc.data_importacao < emp.primeira_importacao) {
        emp.primeira_importacao = doc.data_importacao;
      }
      if (doc.data_importacao > emp.ultima_importacao) {
        emp.ultima_importacao = doc.data_importacao;
      }
    }
    
    emp.quantidade_notas += 1;
    emp.valor_total += vlrLiquido;
    emp.iss_total += vlrIss;
    emp.irrf_total += vlrIrrf;
    emp.pis_total += vlrPis;
    emp.cofins_total += vlrCofins;
    emp.csll_total += vlrCsll;
    
    empresasMap.set(cnpjPrestador, emp);
  }

  const empresasArray = Array.from(empresasMap.values());
  
  if (empresasArray.length > 0) {
    await db.empresas.bulkPut(empresasArray);
  }

  return {
    empresasProcessadas: empresasArray.length,
    notasProcessadas: documents.length
  };
}
