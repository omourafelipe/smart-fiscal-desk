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
    const chave = String(inf["@_Id"] ?? "")
      .replace(/\D/g, "")
      .trim();

    // Extração dos novos campos
    const cnpjCliente = String(pick(inf, ["DPS", "infDPS", "toma", "CNPJ"]) ?? "").trim();
    const cpfCliente = String(pick(inf, ["DPS", "infDPS", "toma", "CPF"]) ?? "").trim();
    const cnpjCpfCliente = cnpjCliente || cpfCliente;

    const vlrLiquido = Number(pick(inf, ["DPS", "infDPS", "valores", "vLiq"]) ?? valor);
    const vlrIss = Number(
      pick(inf, ["DPS", "infDPS", "valores", "vISSRet"]) ??
        pick(inf, ["DPS", "infDPS", "valores", "vISS"]) ??
        0,
    );
    const issRetido =
      pick(inf, ["DPS", "infDPS", "valores", "iss", "RT"]) === 1 ||
      Number(pick(inf, ["DPS", "infDPS", "valores", "vISSRet"]) ?? 0) > 0
        ? "Sim"
        : "Não";

    const vlrCsll = Number(
      pick(inf, ["DPS", "infDPS", "valores", "vCSLL"]) ??
        pick(inf, ["DPS", "infDPS", "valores", "vRetCSLL"]) ??
        0,
    );
    const vlrIrrf = Number(
      pick(inf, ["DPS", "infDPS", "valores", "vIRRF"]) ??
        pick(inf, ["DPS", "infDPS", "valores", "vRetIRRF"]) ??
        0,
    );
    const cServ = String(pick(inf, ["DPS", "infDPS", "serv", "cServ"]) ?? "").trim();
    const dCompet =
      String(pick(inf, ["DPS", "infDPS", "dCompet"]) ?? "").trim() ||
      (dhEmi ? dhEmi.slice(0, 10) : "");

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
      cnpjCpfCliente,
      vlrLiquido,
      vlrIss,
      issRetido,
      vlrCsll,
      vlrIrrf,
      cServ,
      dCompet,
    };
  } catch (e) {
    console.error("parseNfseXml error", e);
    return null;
  }
}
