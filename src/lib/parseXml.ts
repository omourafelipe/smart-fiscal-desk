import { XMLParser } from "fast-xml-parser";
import type { NotaFiscal } from "./db";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
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
    const valorRaw = pick(inf, ["DPS", "infDPS", "valores", "vServPrest", "vServ"]);
    const valor = Number(valorRaw ?? 0) || 0;
    const cliente = String(pick(inf, ["DPS", "infDPS", "toma", "xNome"]) ?? "").trim();
    const servico = String(pick(inf, ["DPS", "infDPS", "serv", "cServ", "xDescServ"]) ?? "").trim();
    const cStat = String(inf.cStat ?? "").trim();
    const hasSubst = !!pick(inf, ["DPS", "infDPS", "subst"]);
    const chave = String(inf["@_Id"] ?? "").replace(/\D/g, "").trim();

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
      chave,
    };
  } catch (e) {
    console.error("parseNfseXml error", e);
    return null;
  }
}
