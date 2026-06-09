import { XMLParser } from "fast-xml-parser";
import type { NotaFiscal } from "./db";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  trimValues: true,
});

function pick(obj: any, path: string[]): any {
  let cur = obj;
  for (const p of path) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

// Find NFSe node regardless of envelope wrapper
function findNFSe(obj: any): any {
  if (!obj || typeof obj !== "object") return null;
  if (obj.NFSe?.infNFSe) return obj.NFSe;
  for (const k of Object.keys(obj)) {
    const found = findNFSe(obj[k]);
    if (found) return found;
  }
  return null;
}

export function parseNfseXml(xml: string): NotaFiscal | null {
  try {
    const json = parser.parse(xml);
    const NFSe = findNFSe(json);
    if (!NFSe) return null;
    const inf = NFSe.infNFSe;
    if (!inf) return null;

    const nNFSe = String(inf.nNFSe ?? "").trim();
    const cnpjPrestador = String(pick(inf, ["emit", "CNPJ"]) ?? "").trim();
    const nomePrestador = String(pick(inf, ["emit", "xNome"]) ?? "").trim();
    const dhEmi = String(pick(inf, ["DPS", "infDPS", "dhEmi"]) ?? "").trim();
    const valorRaw = pick(inf, ["DPS", "infDPS", "valores", "vServPrest", "vServ"]);
    const valor = Number(valorRaw ?? 0) || 0;
    const cliente = String(pick(inf, ["DPS", "infDPS", "toma", "xNome"]) ?? "").trim();
    const servico = String(pick(inf, ["DPS", "infDPS", "serv", "cServ", "xDescServ"]) ?? "").trim();
    const cStat = String(inf.cStat ?? "").trim();
    const hasSubst = !!pick(inf, ["DPS", "infDPS", "subst"]);

    // Active statuses: 100 (autorizada). Cancelled: 101, 102, 135, 155 etc.
    const cancelCodes = new Set(["101", "102", "135", "155"]);
    const isCancelled = hasSubst || cancelCodes.has(cStat);

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
    };
  } catch (e) {
    console.error("parseNfseXml error", e);
    return null;
  }
}
