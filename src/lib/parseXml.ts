import { XMLParser } from "fast-xml-parser";
import type { NotaFiscal } from "./db";

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
  // Try to find tpRetISSQN under tribMun: 1 = Retido, 2 = Não Retido
  const tpRetISSQN = pick(root, ["DPS", "infDPS", "valores", "trib", "tribMun", "tpRetISSQN"]) ??
                     pick(root, ["valores", "trib", "tribMun", "tpRetISSQN"]) ??
                     pick(root, ["DPS", "infDPS", "valores", "tpRetISSQN"]) ??
                     pick(root, ["valores", "tpRetISSQN"]);
  if (tpRetISSQN === 1 || tpRetISSQN === "1") return "Sim";
  if (tpRetISSQN === 2 || tpRetISSQN === "2") return "Não";

  // Try to find RT (Retido)
  const rt = pick(root, ["DPS", "infDPS", "valores", "trib", "tribMun", "RT"]) ??
             pick(root, ["valores", "trib", "tribMun", "RT"]) ??
             pick(root, ["DPS", "infDPS", "valores", "iss", "RT"]) ??
             pick(root, ["valores", "iss", "RT"]) ??
             pick(root, ["DPS", "infDPS", "valores", "RT"]) ??
             pick(root, ["valores", "RT"]);
  if (rt === 1 || rt === "1") return "Sim";
  if (rt === 2 || rt === "2") return "Não";

  // Try to check if vISSRet is greater than 0
  const vISSRet = getNumberFallback(root, [
    ["vISSRet"],
    ["trib", "tribMun", "vISSRet"],
    ["trib", "vISSRet"]
  ]);
  if (vISSRet > 0) return "Sim";

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
    const servico = String(pick(inf, ["DPS", "infDPS", "serv", "cServ", "xDescServ"]) ?? "").trim();
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

    const vlrIss = getNumberFallback(inf, [
      ["vISSRet"],
      ["vISSQN"],
      ["vISS"],
      ["trib", "tribMun", "vISSQN"],
      ["trib", "tribMun", "vISSRet"],
      ["trib", "tribMun", "vISS"]
    ]);

    const issRetido = getIssRetido(inf);

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

    // Advanced cancellation & substitution logic
    // Active statuses: 100 (autorizada). Cancelled: 101, 102, 135, 155 etc.
    const cancelCodes = new Set(["101", "102", "135", "155"]);
    
    // Check for cancellation/substitution events or tags
    const jsonStr = JSON.stringify(json).toLowerCase();
    const hasCancellationKeywords =
      jsonStr.includes("pedidocancelamento") ||
      jsonStr.includes("infpedcanc") ||
      jsonStr.includes("cannfse") ||
      jsonStr.includes("cancelamento") ||
      jsonStr.includes("substituicao") ||
      jsonStr.includes("substnfse") ||
      jsonStr.includes("substituida") ||
      jsonStr.includes("dsubst");

    const situacao = pick(inf, ["situacao"]) ?? pick(inf, ["DPS", "infDPS", "situacao"]);
    const isCancelled =
      hasSubst ||
      cancelCodes.has(cStat) ||
      situacao === "2" || situacao === 2 || // 2 = Cancelada
      situacao === "3" || situacao === 3 || // 3 = Substituída
      hasCancellationKeywords;

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
      status: isCancelled ? "cancelada" : "ativa",
      chave,
      cnpjCpfCliente,
      vlrLiquido,
      vlrIss,
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
