import { XMLParser } from "fast-xml-parser";
import type { NotaFiscal, NotaFiscalTomada } from "./db";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true, // Strips namespace prefixes (e.g. tc:infNFSe -> infNFSe)
});

function pick(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// Recursively converts all keys in an object/array to lowercase
function lowercaseKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(lowercaseKeys);
  }
  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    result[key.toLowerCase()] = lowercaseKeys(record[key]);
  }
  return result;
}

// Find NFSe node regardless of envelope wrapper (casing-agnostic search)
function findNFSe(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  
  // If the object itself has infnfse or infdps, then this is the NFSe node
  if (record.infnfse || record.infdps) {
    return record;
  }
  
  // If we have a nested nfse property
  if (record.nfse && typeof record.nfse === "object") {
    const nfse = record.nfse as Record<string, unknown>;
    if (nfse.infnfse || nfse.infdps) return nfse;
  }
  
  for (const k of Object.keys(record)) {
    if (Array.isArray(record[k])) {
      for (const item of record[k]) {
        const found = findNFSe(item);
        if (found) return found;
      }
    } else {
      const found = findNFSe(record[k]);
      if (found) return found;
    }
  }
  return null;
}

function getNumberFallback(root: unknown, relativePaths: string[][]): number {
  for (const rel of relativePaths) {
    // Try under infNFSe -> DPS -> infDPS -> valores -> [rel]
    let val = pick(root, ["dps", "infdps", "valores", ...rel]);
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
    val = pick(root, ["dps", "infdps", ...rel]);
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
  // tpRetISSQN:
  // 1 = Não Retido (Prestador recolhe)
  // 2 = Retido pelo Tomador (único considerado retido)
  // 3 = Retido por Intermediário (desconsiderado conforme solicitação)
  const rawVal = pick(root, ["dps", "infdps", "valores", "trib", "tribmun", "tpretissqn"]) ??
                 pick(root, ["valores", "trib", "tribmun", "tpretissqn"]) ??
                 pick(root, ["dps", "infdps", "valores", "tpretissqn"]) ??
                 pick(root, ["valores", "tpretissqn"]);
  if (rawVal === undefined || rawVal === null) return "Não";

  const tpRetISSQN = String(rawVal).trim().toLowerCase();
  if (tpRetISSQN === "2" || tpRetISSQN.startsWith("2") || tpRetISSQN.includes("tomador") || tpRetISSQN.includes("retenção") || tpRetISSQN.includes("retencao")) return "Sim";
  return "Não";
}

function getMunicipalCode(inf: unknown): string {
  return String(
    // Padrão Nacional
    pick(inf, ["dps", "infdps", "serv", "cserv", "ctribmun"]) ??
    pick(inf, ["serv", "cserv", "ctribmun"]) ??
    
    // ABRASF / Outros
    pick(inf, ["dps", "infdps", "serv", "codigotributacaomunicipio"]) ??
    pick(inf, ["servico", "codigotributacaomunicipio"]) ??
    pick(inf, ["codigotributacaomunicipio"]) ??

    pick(inf, ["dps", "infdps", "serv", "codigoservicomunicipio"]) ??
    pick(inf, ["servico", "codigoservicomunicipio"]) ??
    pick(inf, ["codigoservicomunicipio"]) ??

    // Fallbacks
    pick(inf, ["dps", "infdps", "serv", "cserv"]) ??
    pick(inf, ["serv", "cserv"]) ??
    ""
  ).trim();
}

function getNbsCode(inf: unknown): string {
  return String(
    // Padrão Nacional / Webservice atualizado
    pick(inf, ["dps", "infdps", "serv", "cnbs"]) ??
    pick(inf, ["dps", "infdps", "serv", "cserv", "cnbs"]) ??
    pick(inf, ["serv", "cnbs"]) ??
    pick(inf, ["serv", "cserv", "cnbs"]) ??

    // ABRASF v2.04
    pick(inf, ["dps", "infdps", "serv", "codigonbs"]) ??
    pick(inf, ["servico", "codigonbs"]) ??
    pick(inf, ["codigonbs"]) ??
    ""
  ).trim();
}

export function parseNfseXml(xml: string): NotaFiscal | null {
  try {
    const json = parser.parse(xml);
    const normalizedJson = lowercaseKeys(json);
    const NFSe = findNFSe(normalizedJson) as Record<string, unknown> | null;
    if (!NFSe) return null;
    const inf = (NFSe.infnfse || NFSe.infdps) as Record<string, unknown> | null;
    if (!inf) return null;

    const nNFSe = String(inf.nnfse ?? "").trim();
    const cnpjPrestador = String(pick(inf, ["emit", "cnpj"]) ?? "").trim();
    const nomePrestador = String(pick(inf, ["emit", "xnome"]) ?? "").trim();
    let dhEmi = String(pick(inf, ["dps", "infdps", "dhemi"]) ?? "").trim();
    if (dhEmi && isNaN(Date.parse(dhEmi))) {
      dhEmi = "";
    }
    const valor = getNumberFallback(inf, [
      ["vserv"],
      ["vservprest"],
      ["valorservicos"],
      ["servico", "valores", "valorservicos"],
      ["servico", "valores", "vserv"],
      ["servico", "vserv"],
      ["serv", "valores", "vserv"],
      ["serv", "valores", "vservprest"],
      ["serv", "vserv"],
      ["valores", "vserv"],
      ["valores", "vservprest"],
      ["valores", "valorservicos"]
    ]);
    const cliente = String(pick(inf, ["dps", "infdps", "toma", "xnome"]) ?? "").trim();
    const servico = String(
      pick(inf, ["dps", "infdps", "serv", "xdescserv"]) ??
      pick(inf, ["dps", "infdps", "serv", "cserv", "xdescserv"]) ??
      pick(inf, ["dps", "infdps", "serv", "cserv"]) ??
      ""
    ).trim();
    const cStat = String(inf.cstat ?? "").trim();
    const hasSubst = !!pick(inf, ["dps", "infdps", "subst"]);
    const chave = String(inf["@_id"] ?? "")
      .replace(/\D/g, "")
      .trim();

    // Extração dos novos campos
    const cnpjCliente = String(pick(inf, ["dps", "infdps", "toma", "cnpj"]) ?? "").trim();
    const cpfCliente = String(pick(inf, ["dps", "infdps", "toma", "cpf"]) ?? "").trim();
    const cnpjCpfCliente = cnpjCliente || cpfCliente;

    // vlrLiquidoRaw extracted here, to be recalibrated below after federal taxes and ISS retido are known
    const vlrLiquidoRaw = getNumberFallback(inf, [
      ["vliq"],
      ["vliquido"],
      ["valores", "valorliquidonfse"],
      ["valores", "valorliquido"],
      ["valores", "vliq"],
      ["valores", "vliquido"]
    ]);

    // ISS retido na fonte (retido pelo tomador)
    // vISSRet é preenchido somente quando há retenção na fonte
    const vlrIssRetRaw = getNumberFallback(inf, [
      ["vissret"],
      ["trib", "tribmun", "vissret"],
      ["valores", "valorissretido"],
      ["valores", "vissret"]
    ]);

    // Valor genérico do ISS da nota (vISSQN / vISS — presente em todos os casos)
    const vlrIssQN = getNumberFallback(inf, [
      ["vissqn"],
      ["viss"],
      ["trib", "tribmun", "vissqn"],
      ["trib", "tribmun", "viss"],
      ["valores", "valoriss"],
      ["valores", "vissqn"],
      ["valores", "viss"]
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
      ["trib", "tribfed", "vretcsll"],
      ["trib", "tribfed", "vcsll"],
      ["vretcsll"],
      ["vcsll"],
      ["valores", "valorcsll"],
      ["valores", "vcsll"]
    ]);

    const vlrIrrf = getNumberFallback(inf, [
      ["trib", "tribfed", "vretirrf"],
      ["trib", "tribfed", "virrf"],
      ["vretirrf"],
      ["virrf"],
      ["valores", "valorir"],
      ["valores", "virrf"]
    ]);

    const vlrPis = getNumberFallback(inf, [
      ["trib", "tribfed", "piscofins", "vpis"],
      ["piscofins", "vpis"],
      ["trib", "tribfed", "vretpis"],
      ["trib", "tribfed", "vpis"],
      ["vretpis"],
      ["vpis"],
      ["valores", "valorpis"],
      ["valores", "vpis"]
    ]);

    const vlrCofins = getNumberFallback(inf, [
      ["trib", "tribfed", "piscofins", "vcofins"],
      ["piscofins", "vcofins"],
      ["trib", "tribfed", "vretcofins"],
      ["trib", "tribfed", "vcofins"],
      ["vretcofins"],
      ["vcofins"],
      ["valores", "valorcofins"],
      ["valores", "vcofins"]
    ]);

    const vlrInss = getNumberFallback(inf, [
      ["trib", "tribfed", "vretcp"],
      ["trib", "tribfed", "vretinss"],
      ["trib", "tribfed", "vinss"],
      ["vretcp"],
      ["vretinss"],
      ["vinss"],
      ["valores", "valorinss"],
      ["valores", "vinss"]
    ]);

    // Recalibrate Net Value (vlrLiquido)
    const withholdings = vlrCsll + vlrIrrf + vlrPis + vlrCofins + vlrInss + vlrIssRet;
    let vlrLiquido = vlrLiquidoRaw;
    if (vlrLiquido <= 0 || (vlrLiquido === valor && withholdings > 0)) {
      vlrLiquido = valor - withholdings;
    }

    const nbs = getNbsCode(inf);
    const cTribNac = String(
      pick(inf, ["dps", "infdps", "serv", "ctribnac"]) ??
        pick(inf, ["dps", "infdps", "serv", "cserv", "ctribnac"]) ??
        pick(inf, ["serv", "ctribnac"]) ??
        "",
    ).trim();
    const municipal = getMunicipalCode(inf);
    const codTribNacional = cTribNac || nbs || municipal;

    let dCompet = String(
      pick(inf, ["dps", "infdps", "dcompet"]) ??
      pick(inf, ["dcompet"]) ??
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
  cnpjsGrupo?: Set<string>,
): NotaFiscalTomada | null {
  try {
    const json = parser.parse(xml);
    const normalizedJson = lowercaseKeys(json);
    const NFSe = findNFSe(normalizedJson) as Record<string, unknown> | null;
    if (!NFSe) return null;
    const inf = (NFSe.infnfse || NFSe.infdps) as Record<string, unknown> | null;
    if (!inf) return null;

    // Tomador: empresa do grupo que contratou o serviço
    const cnpjTomador = String(pick(inf, ["dps", "infdps", "toma", "cnpj"]) ?? "").trim().replace(/\D/g, "");
    const nomeTomador = String(pick(inf, ["dps", "infdps", "toma", "xnome"]) ?? "").trim();

    // Valida se o tomador é uma empresa do grupo (apenas se a lista cnpjsGrupo estiver populada)
    if (!cnpjTomador) return null;
    if (cnpjsGrupo) {
      const hasFn = typeof (cnpjsGrupo as any).has === "function";
      const size = typeof (cnpjsGrupo as any).size === "number" ? (cnpjsGrupo as any).size : 0;
      if (hasFn) {
        if (size > 0 && !cnpjsGrupo.has(cnpjTomador)) return null;
      } else if (Array.isArray(cnpjsGrupo)) {
        if (cnpjsGrupo.length > 0 && !(cnpjsGrupo as any).includes(cnpjTomador)) return null;
      } else {
        console.warn("parseNfseXmlTomada: cnpjsGrupo is not a Set or Array:", typeof cnpjsGrupo, cnpjsGrupo);
      }
    }

    // Prestador: fornecedor externo que emitiu a nota
    const cnpjPrestador = String(pick(inf, ["emit", "cnpj"]) ?? "").trim();
    const nomePrestador = String(pick(inf, ["emit", "xnome"]) ?? "").trim();

    if (!cnpjPrestador) return null;

    const nNFSe = String(inf.nnfse ?? "").trim();
    if (!nNFSe) return null;

    let dhEmi = String(pick(inf, ["dps", "infdps", "dhemi"]) ?? "").trim();
    if (dhEmi && isNaN(Date.parse(dhEmi))) dhEmi = "";

    const valor = getNumberFallback(inf, [
      ["vserv"],
      ["vservprest"],
      ["valorservicos"],
      ["servico", "valores", "valorservicos"],
      ["servico", "valores", "vserv"],
      ["servico", "vserv"],
      ["serv", "valores", "vserv"],
      ["serv", "valores", "vservprest"],
      ["serv", "vserv"],
      ["valores", "vserv"],
      ["valores", "vservprest"],
      ["valores", "valorservicos"]
    ]);

    // vlrLiquidoRaw extracted here, to be recalibrated below after federal taxes and ISS retido are known
    const vlrLiquidoRaw = getNumberFallback(inf, [
      ["vliq"],
      ["vliquido"],
      ["valores", "valorliquidonfse"],
      ["valores", "valorliquido"],
      ["valores", "vliq"],
      ["valores", "vliquido"]
    ]);

    const servico = String(
      pick(inf, ["dps", "infdps", "serv", "xdescserv"]) ??
      pick(inf, ["dps", "infdps", "serv", "cserv", "xdescserv"]) ??
      pick(inf, ["dps", "infdps", "serv", "cserv"]) ??
      ""
    ).trim();

    const cStat = String(inf.cstat ?? "").trim();

    const chave = String(inf["@_id"] ?? "")
      .replace(/\D/g, "")
      .trim();

    const nbs = getNbsCode(inf);
    const cTribNac = String(
      pick(inf, ["dps", "infdps", "serv", "ctribnac"]) ??
        pick(inf, ["dps", "infdps", "serv", "cserv", "ctribnac"]) ??
        pick(inf, ["serv", "ctribnac"]) ??
        "",
    ).trim();
    const municipal = getMunicipalCode(inf);
    const codTribNacional = cTribNac || nbs || municipal;

    // ISS — responsabilidade do tomador de reter quando aplicável
    const issRetidoFlag = getIssRetido(inf);
    const vlrIssRetRaw = getNumberFallback(inf, [
      ["vissret"],
      ["trib", "tribmun", "vissret"],
      ["valores", "valorissretido"],
      ["valores", "vissret"],
    ]);
    const vlrIssQN = getNumberFallback(inf, [
      ["vissqn"],
      ["viss"],
      ["trib", "tribmun", "vissqn"],
      ["trib", "tribmun", "viss"],
      ["valores", "valoriss"],
      ["valores", "vissqn"],
      ["valores", "viss"],
    ]);
    // ISS RETIDO apenas o que estiver identificado como "Retenção do ISSQN" ou "Retenção Simples"
    const vlrIssRet = issRetidoFlag === "Sim"
      ? (vlrIssRetRaw > 0 ? vlrIssRetRaw : vlrIssQN)
      : 0;
    const vlrIss = vlrIssRet > 0 ? vlrIssRet : vlrIssQN;

    // Retenções federais
    const vlrCsll = getNumberFallback(inf, [
      ["trib", "tribfed", "vretcsll"],
      ["trib", "tribfed", "vcsll"],
      ["vretcsll"],
      ["valores", "valorcsll"],
      ["valores", "vcsll"]
    ]);
    const vlrIrrf = getNumberFallback(inf, [
      ["trib", "tribfed", "vretirrf"],
      ["trib", "tribfed", "virrf"],
      ["vretirrf"],
      ["valores", "valorir"],
      ["valores", "virrf"]
    ]);
    const vlrPis = getNumberFallback(inf, [
      ["trib", "tribfed", "piscofins", "vpis"],
      ["trib", "tribfed", "vretpis"],
      ["trib", "tribfed", "vpis"],
      ["vretpis"],
      ["vpis"],
      ["valores", "valorpis"],
      ["valores", "vpis"]
    ]);
    const vlrCofins = getNumberFallback(inf, [
      ["trib", "tribfed", "piscofins", "vcofins"],
      ["trib", "tribfed", "vretcofins"],
      ["trib", "tribfed", "vcofins"],
      ["vretcofins"],
      ["vcofins"],
      ["valores", "valorcofins"],
      ["valores", "vcofins"]
    ]);
    const vlrInss = getNumberFallback(inf, [
      ["trib", "tribfed", "vretcp"],
      ["trib", "tribfed", "vretinss"],
      ["vretcp"],
      ["vretinss"],
      ["valores", "valorinss"],
      ["valores", "vinss"]
    ]);

    // Recalibrate Net Value (vlrLiquido)
    const withholdings = vlrCsll + vlrIrrf + vlrPis + vlrCofins + vlrInss + vlrIssRet;
    let vlrLiquido = vlrLiquidoRaw;
    if (vlrLiquido <= 0 || (vlrLiquido === valor && withholdings > 0)) {
      vlrLiquido = valor - withholdings;
    }

    // Competência
    let dCompet = String(
      pick(inf, ["dps", "infdps", "dcompet"]) ??
        pick(inf, ["dcompet"]) ??
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
      vlrIss,
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
