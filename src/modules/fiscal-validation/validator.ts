import type { FiscalDocument } from "../../shared/types";

export interface ValidationResult {
  status: "valido" | "inconsistente";
  alertas: string[];
}

export function validateFiscalDocument(doc: Partial<FiscalDocument>): ValidationResult {
  const alertas: string[] = [];

  // 1. Mandatory Fields Check
  if (!doc.cnpj_prestador) alertas.push("CNPJ do Prestador não informado.");
  if (!doc.cnpj_tomador) alertas.push("CNPJ do Tomador não informado.");
  if (!doc.data_competencia) alertas.push("Competência não informada.");
  if (!doc.municipio) alertas.push("Município do serviço não identificado.");
  if (!doc.item_lista_servico) alertas.push("Item da LC 116/03 não informado.");

  // 2. Math Consistency Check (Valor Líquido = Bruto - Retenções)
  const bruto = Number(doc.valor_bruto || 0);
  const retido = Number(doc.valor_retido || 0);
  const liquido = Number(doc.valor_liquido || 0);
  
  // Accept tiny rounding difference (<= 0.05 BRL)
  if (Math.abs(bruto - retido - liquido) > 0.05) {
    alertas.push(
      `Inconsistência nos valores declarados: Bruto (R$ ${bruto.toFixed(2)}) - Retido (R$ ${retido.toFixed(2)}) difere do Líquido (R$ ${liquido.toFixed(2)}).`
    );
  }

  // 3. Tax Retention & Rates Check
  const iss = Number(doc.vlr_iss || 0);
  if (bruto > 0 && iss > 0) {
    const aliquotaCalculada = (iss / bruto) * 100;
    // ISS rate is normally between 2.0% and 5.0% in Brazil
    if (aliquotaCalculada < 1.9 || aliquotaCalculada > 5.1) {
      alertas.push(
        `Alíquota efetiva de ISS incomum: ${aliquotaCalculada.toFixed(2)}% (fora da faixa padrão de 2% a 5%).`
      );
    }
  }

  // 4. LC 116 Standard Checks (Ensure standard format e.g. "01.01" or "1.01")
  if (doc.item_lista_servico) {
    const cleanedLc = doc.item_lista_servico.replace(/\D/g, "");
    if (cleanedLc.length === 0) {
      alertas.push(`Código LC 116 inválido: "${doc.item_lista_servico}"`);
    }
  }

  return {
    status: alertas.length > 0 ? "inconsistente" : "valido",
    alertas,
  };
}
