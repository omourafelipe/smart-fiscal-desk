import { XMLParser } from "fast-xml-parser";
import type { NotaFiscal, NotaFiscalTomada } from "./db";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

function pick(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// Find NFSe node regardless of envelope wrapper
function findNFSe(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  if (record.NFSe && typeof record.NFSe === "object") {
    const nfse = record.NFSe as Record<string, unknown>;
    if (nfse.infNFSe) return record.NFSe;
  }
  for (const k of Object.keys(record)) {
    const found = findNFSe(record[k]);
    if (found) return found;
  }
  return null;
}

function getNumberFallback(root: unknown, relativePaths: string[][]): number {
  for (const rel of relativePaths) {
    // Try under infNFSe -> DPS -> infDPS -> valores -> [rel]
    let val = pick(root, ["DPS", "infDPS", "valores", ...rel]);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    // Try under infNFSe -> valores -> [rel]
    val = pick(root, ["valores", ...rel]);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    // Try under infNFSe -> DPS -> infDPS -> [rel]
    val = pick(root, ["DPS", "infDPS", ...rel]);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    // Try directly on root
    val = pick(root, rel);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
}

function getIssRetido(root: unknown): "Sim" | "Não" {
  // tpRetISSQN: 1 = Retenção do ISSQN, 3 = Retenção Simples (Simples Nacional).
  // Qualquer outro valor (2 = Não Retido, ausente, ou apenas vISSRet > 0 sem
  // identificação explícita) é tratado como "Não".
  const rawVal = pick(root, ["DPS", "infDPS", "valores", "trib", "tribMun", "tpRetISSQN"]) ??
                 pick(root, ["valores", "trib", "tribMun", "tpRetISSQN"]) ??
                 pick(root, ["DPS", "infDPS", "valores", "tpRetISSQN"]) ??
                 pick(root, ["valores", "tpRetISSQN"]);
  if (rawVal === undefined || rawVal === null) return "Não";

  const tpRetISSQN = String(rawVal).trim().toLowerCase();
  if (tpRetISSQN === "1" || tpRetISSQN.startsWith("1") || tpRetISSQN.includes("retenção do issqn") || tpRetISSQN.includes("retencao do issqn")) return "Sim";
  if (tpRetISSQN === "3" || tpRetISSQN.startsWith("3") || tpRetISSQN.includes("retenção simples") || tpRetISSQN.includes("retencao simples")) return "Sim";
  return "Não";
}

export function parseNfseXml(xml: string): NotaFiscal | null {
  try {
    const json = parser.parse(xml);
    const NFSe = findNFSe(json) as Record<string, unknown> | null;
    if (!NFSe) return null;
    const inf = NFSe.infNFSe as Record<string, unknown> | null;
    if (!inf) return null;

    const nNFSe = String(inf.nNFSe ?? "").trim();
    const cnpjPrestador = String(pick(inf, ["emit", "CNPJ"]) ?? "").trim();
    const nomePrestador = String(pick(inf, ["emit", "xNome"]) ?? "").trim();
    let dhEmi = String(pick(inf, ["DPS", "infDPS", "dhEmi"]) ?? "").trim();
    if (dhEmi && isNaN(Date.parse(dhEmi))) {
      dhEmi = "";
    }
    const valor = getNumberFallback(inf, [
      ["vServPrest", "vServ"],
      ["vServ"]
    ]);
    const cliente = String(pick(inf, ["DPS", "infDPS", "toma", "xNome"]) ?? "").trim();
    const servico = String(
      pick(inf, ["DPS", "infDPS", "serv", "xDescServ"]) ??
      pick(inf, ["DPS", "infDPS", "serv", "cServ", "xDescServ"]) ??
      pick(inf, ["DPS", "infDPS", "serv", "cServ"]) ??
      ""
    ).trim();
    const cStat = String(inf.cStat ?? "").trim();
    const hasSubst = !!pick(inf, ["DPS", "infDPS", "subst"]);
    const chave = String(inf["@_Id"] ?? "")
      .replace(/\D/g, "")
      .trim();

    // Extração dos novos campos
    const cnpjCliente = String(pick(inf, ["DPS", "infDPS", "toma", "CNPJ"]) ?? "").trim();
    const cpfCliente = String(pick(inf, ["DPS", "infDPS", "toma", "CPF"]) ?? "").trim();
    const cnpjCpfCliente = cnpjCliente || cpfCliente;

    const vlrLiquido = getNumberFallback(inf, [
      ["vLiq"],
      ["vLiquido"]
    ]) || valor;

    // ISS retido na fonte (retido pelo tomador)
    // vISSRet é preenchido somente quando há retenção na fonte
    const vlrIssRetRaw = getNumberFallback(inf, [
      ["vISSRet"],
      ["trib", "tribMun", "vISSRet"]
    ]);

    // Valor genérico do ISS da nota (vISSQN / vISS — presente em todos os casos)
    const vlrIssQN = getNumberFallback(inf, [
      ["vISSQN"],
      ["vISS"],
      ["trib", "tribMun", "vISSQN"],
      ["trib", "tribMun", "vISS"]
    ]);

    // issRetido é calculado abaixo, mas precisamos saber antes para separar os valores
    const issRetidoFlag = getIssRetido(inf);

    // ISS retido: usa vISSRet quando disponível; caso contrário usa vISSQN quando a nota é retida
    const vlrIssRet = vlrIssRetRaw > 0
      ? vlrIssRetRaw
      : issRetidoFlag === "Sim"
        ? vlrIssQN
        : 0;

    // ISS a recolher: apenas quando a nota NÃO é retida na fonte
    const vlrIssRecolher = issRetidoFlag === "Não" ? vlrIssQN : 0;

    // vlrIss: valor total de ISS da nota (para exibição na tabela)
    const vlrIss = vlrIssRet > 0 ? vlrIssRet : vlrIssRecolher;

    const issRetido = issRetidoFlag;

    const vlrCsll = getNumberFallback(inf, [
      ["trib", "tribFed", "vRetCSLL"],
      ["trib", "tribFed", "vCSLL"],
      ["vRetCSLL"],
      ["vCSLL"]
    ]);

    const vlrIrrf = getNumberFallback(inf, [
      ["trib", "tribFed", "vRetIRRF"],
      ["trib", "tribFed", "vIRRF"],
      ["vRetIRRF"],
      ["vIRRF"]
    ]);

    const vlrPis = getNumberFallback(inf, [
      ["trib", "tribFed", "piscofins", "vPis"],
      ["piscofins", "vPis"],
      ["trib", "tribFed", "vRetPIS"],
      ["trib", "tribFed", "vPIS"],
      ["vRetPIS"],
      ["vPIS"],
      ["vPis"]
    ]);

    const vlrCofins = getNumberFallback(inf, [
      ["trib", "tribFed", "piscofins", "vCofins"],
      ["piscofins", "vCofins"],
      ["trib", "tribFed", "vRetCOFINS"],
      ["trib", "tribFed", "vCOFINS"],
      ["vRetCOFINS"],
      ["vCOFINS"],
      ["vCofins"]
    ]);

    const vlrInss = getNumberFallback(inf, [
      ["trib", "tribFed", "vRetCP"],
      ["trib", "tribFed", "vRetINSS"],
      ["trib", "tribFed", "vINSS"],
      ["vRetCP"],
      ["vRetINSS"],
      ["vINSS"]
    ]);

    const codTribNacional = String(
      pick(inf, ["DPS", "infDPS", "serv", "cServ", "cTribNac"]) ??
        pick(inf, ["DPS", "infDPS", "serv", "cTribNac"]) ??
        pick(inf, ["DPS", "infDPS", "serv", "cServ"]) ??
        "",
    ).trim();

    let dCompet = String(
      pick(inf, ["DPS", "infDPS", "dCompet"]) ??
      pick(inf, ["dCompet"]) ??
      pick(inf, ["Competencia"]) ??
      pick(inf, ["competencia"]) ??
      ""
    ).trim();

    // If it is just YYYY-MM (7 chars), append -01 to make it YYYY-MM-DD
    if (dCompet.length === 7 && dCompet.includes("-")) {
      dCompet = `${dCompet}-01`;
    } else if (dCompet.length === 6 && !dCompet.includes("-")) {
      // YYYYMM format
      dCompet = `${dCompet.slice(0, 4)}-${dCompet.slice(4, 6)}-01`;
    } else if (dCompet && isNaN(Date.parse(dCompet))) {
      dCompet = "";
    }

    if (!dCompet) {
      dCompet = dhEmi ? dhEmi.slice(0, 10) : "";
    }

    if (!nNFSe || !cnpjPrestador) return null;

    return {
      id: `${nNFSe}_${cnpjPrestador}`,
      nNFSe,
      cnpjPrestador,
      nomePrestador,
      dhEmi,
      valor,
      cliente,
      servico,
      cStat,
      status: "válida", // placeholder – final status comes from Excel
      chave,
      cnpjCpfCliente,
      vlrLiquido,
      vlrIss,
      vlrIssRet,
      vlrIssRecolher,
      issRetido,
      vlrCsll,
      vlrIrrf,
      vlrPis,
      vlrCofins,
      vlrInss,
      codTribNacional,
      dCompet,
    };
  } catch (e) {
    console.error("parseNfseXml error", e);
    return null;
  }
}

/**
 * Parseia um XML de NFS-e Nacional na perspectiva do TOMADOR.
 * Retorna null se o CNPJ do tomador não estiver na lista de CNPJs do grupo.
 *
 * @param xml      Conteúdo do arquivo XML
 * @param cnpjsGrupo  Set de CNPJs (apenas dígitos) das empresas do grupo
 */
export function parseNfseXmlTomada(
  xml: string,
  cnpjsGrupo: Set<string>,
): NotaFiscalTomada | null {
  try {
    const json = parser.parse(xml);
    const NFSe = findNFSe(json) as Record<string, unknown> | null;
    if (!NFSe) return null;
    const inf = NFSe.infNFSe as Record<string, unknown> | null;
    if (!inf) return null;

    // Tomador: empresa do grupo que contratou o serviço
    const cnpjTomador = String(pick(inf, ["DPS", "infDPS", "toma", "CNPJ"]) ?? "").trim().replace(/\D/g, "");
    const nomeTomador = String(pick(inf, ["DPS", "infDPS", "toma", "xNome"]) ?? "").trim();

    // Valida se o tomador é uma empresa do grupo
    if (!cnpjTomador || !cnpjsGrupo.has(cnpjTomador)) return null;

    // Prestador: fornecedor externo que emitiu a nota
    const cnpjPrestador = String(pick(inf, ["emit", "CNPJ"]) ?? "").trim();
    const nomePrestador = String(pick(inf, ["emit", "xNome"]) ?? "").trim();

    if (!cnpjPrestador) return null;

    const nNFSe = String(inf.nNFSe ?? "").trim();
    if (!nNFSe) return null;

    let dhEmi = String(pick(inf, ["DPS", "infDPS", "dhEmi"]) ?? "").trim();
    if (dhEmi && isNaN(Date.parse(dhEmi))) dhEmi = "";

    const valor = getNumberFallback(inf, [
      ["vServPrest", "vServ"],
      ["vServ"],
    ]);

    const vlrLiquido = getNumberFallback(inf, [
      ["vLiq"],
      ["vLiquido"],
    ]) || valor;

    const servico = String(
      pick(inf, ["DPS", "infDPS", "serv", "xDescServ"]) ??
      pick(inf, ["DPS", "infDPS", "serv", "cServ", "xDescServ"]) ??
      pick(inf, ["DPS", "infDPS", "serv", "cServ"]) ??
      ""
    ).trim();

    const cStat = String(inf.cStat ?? "").trim();

    const chave = String(inf["@_Id"] ?? "")
      .replace(/\D/g, "")
      .trim();

    const codTribNacional = String(
      pick(inf, ["DPS", "infDPS", "serv", "cServ", "cTribNac"]) ??
        pick(inf, ["DPS", "infDPS", "serv", "cTribNac"]) ??
        pick(inf, ["DPS", "infDPS", "serv", "cServ"]) ??
        "",
    ).trim();

    // ISS — responsabilidade do tomador de reter quando aplicável
    const issRetidoFlag = getIssRetido(inf);
    const vlrIssRetRaw = getNumberFallback(inf, [
      ["vISSRet"],
      ["trib", "tribMun", "vISSRet"],
    ]);
    const vlrIssQN = getNumberFallback(inf, [
      ["vISSQN"],
      ["vISS"],
      ["trib", "tribMun", "vISSQN"],
      ["trib", "tribMun", "vISS"],
    ]);
    // ISS RETIDO apenas o que estiver identificado como "Retenção do ISSQN" ou "Retenção Simples"
    const vlrIssRet = issRetidoFlag === "Sim"
      ? (vlrIssRetRaw > 0 ? vlrIssRetRaw : vlrIssQN)
      : 0;

    // Retenções federais
    const vlrCsll = getNumberFallback(inf, [
      ["trib", "tribFed", "vRetCSLL"],
      ["trib", "tribFed", "vCSLL"],
      ["vRetCSLL"],
    ]);
    const vlrIrrf = getNumberFallback(inf, [
      ["trib", "tribFed", "vRetIRRF"],
      ["trib", "tribFed", "vIRRF"],
      ["vRetIRRF"],
    ]);
    const vlrPis = getNumberFallback(inf, [
      ["trib", "tribFed", "piscofins", "vPis"],
      ["trib", "tribFed", "vRetPIS"],
      ["trib", "tribFed", "vPIS"],
      ["vRetPIS"],
      ["vPis"],
    ]);
    const vlrCofins = getNumberFallback(inf, [
      ["trib", "tribFed", "piscofins", "vCofins"],
      ["trib", "tribFed", "vRetCOFINS"],
      ["trib", "tribFed", "vCOFINS"],
      ["vRetCOFINS"],
      ["vCofins"],
    ]);
    const vlrInss = getNumberFallback(inf, [
      ["trib", "tribFed", "vRetCP"],
      ["trib", "tribFed", "vRetINSS"],
      ["vRetCP"],
      ["vRetINSS"],
    ]);

    // Competência
    let dCompet = String(
      pick(inf, ["DPS", "infDPS", "dCompet"]) ??
        pick(inf, ["dCompet"]) ??
        "",
    ).trim();
    if (dCompet.length === 7 && dCompet.includes("-")) {
      dCompet = `${dCompet}-01`;
    } else if (dCompet.length === 6 && !dCompet.includes("-")) {
      dCompet = `${dCompet.slice(0, 4)}-${dCompet.slice(4, 6)}-01`;
    } else if (dCompet && isNaN(Date.parse(dCompet))) {
      dCompet = "";
    }
    if (!dCompet) dCompet = dhEmi ? dhEmi.slice(0, 10) : "";

    return {
      id: `tomada_${nNFSe}_${cnpjPrestador}`,
      nNFSe,
      cnpjTomador,
      nomeTomador,
      cnpjPrestador,
      nomePrestador,
      dhEmi,
      dCompet,
      valor,
      vlrLiquido,
      servico,
      codTribNacional,
      cStat,
      status: "válida",
      chave,
      issRetido: issRetidoFlag,
      vlrIssRet,
      vlrIrrf,
      vlrCsll,
      vlrPis,
      vlrCofins,
      vlrInss,
    };
  } catch (e) {
    console.error("parseNfseXmlTomada error", e);
    return null;
  }
}
