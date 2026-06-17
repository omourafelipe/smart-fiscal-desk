import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
});

export interface CanonicalNota {
  id_nota: string;
  data_competencia: string;
  cnpj_prestador: string;
  cnpj_tomador: string;
  nome_prestador?: string;
  nome_tomador?: string;
  valor_bruto: number;
  valor_retido: number;
  valor_liquido: number;
  // Serviço
  item_lista_servico?: string;  // ex: "01.01" (LC 116)
  codigo_servico?: string;      // código municipal
  descricao_servico?: string;   // discriminação do serviço
}

export type ParseResult =
  | { ok: true; nota: CanonicalNota }
  | { ok: false; error: string };

function lower(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(lower);
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    r[k.toLowerCase()] = lower(v);
  }
  return r;
}

function get(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function onlyDigits(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function findInfNfse(root: unknown): Record<string, unknown> | null {
  if (!root || typeof root !== "object") return null;
  const r = root as Record<string, unknown>;
  if (r.infnfse && typeof r.infnfse === "object") return r as Record<string, unknown>;
  for (const v of Object.values(r)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const f = findInfNfse(item);
        if (f) return f;
      }
    } else if (v && typeof v === "object") {
      const f = findInfNfse(v);
      if (f) return f;
    }
  }
  return null;
}

function pickFirst(obj: unknown, paths: string[][]): unknown {
  for (const p of paths) {
    const v = get(obj, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback simples (não criptográfico) — não esperado em browsers modernos
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return `fallback_${h}`;
}

/**
 * Parser canônico resiliente. Nunca lança exceção.
 * Aceita estruturas: NFSe/infNFSe, Nfse/InfNfse, CompNfse/Nfse/InfNfse.
 */
export function parseFiscalXml(xml: string): ParseResult {
  if (!xml || typeof xml !== "string") {
    return { ok: false, error: "XML vazio ou inválido" };
  }
  let json: unknown;
  try {
    json = parser.parse(xml);
  } catch (e) {
    return { ok: false, error: "XML inválido (falha de parse)" };
  }
  const normalized = lower(json);
  const wrapper = findInfNfse(normalized) as Record<string, unknown> | null;
  if (!wrapper) {
    return { ok: false, error: "Estrutura XML não reconhecida" };
  }
  const inf = wrapper.infnfse as Record<string, unknown>;

  // id_nota: atributo Id do infNFSe (ou nNFSe + cnpj prestador como fallback)
  const idAttr = String((inf as any)["@_id"] ?? "").trim();
  const nNfse = String(get(inf, ["nnfse"]) ?? "").trim();

  // CNPJs
  const cnpjPrestador = onlyDigits(
    pickFirst(inf, [
      ["dps", "infdps", "prest", "cnpj"],
      ["emit", "cnpj"],
      ["prest", "cnpj"],
    ])
  );
  const cnpjTomador = onlyDigits(
    pickFirst(inf, [
      ["dps", "infdps", "toma", "cnpj"],
      ["toma", "cnpj"],
      ["dps", "infdps", "toma", "cpf"],
      ["toma", "cpf"],
    ])
  );

  const nomePrestador = String(
    pickFirst(inf, [["dps", "infdps", "prest", "xnome"], ["emit", "xnome"], ["prest", "xnome"]]) ?? ""
  ).trim();
  const nomeTomador = String(
    pickFirst(inf, [["dps", "infdps", "toma", "xnome"], ["toma", "xnome"]]) ?? ""
  ).trim();

  // id_nota obrigatório
  const id_nota = idAttr || (nNfse && cnpjPrestador ? `${nNfse}_${cnpjPrestador}` : "");
  if (!id_nota) {
    return { ok: false, error: "id_nota ausente (Id/nNFSe obrigatório)" };
  }

  // Competência: YYYY-MM-DD
  let dCompet = String(
    pickFirst(inf, [["dps", "infdps", "dcompet"], ["dcompet"], ["competencia"]]) ?? ""
  ).trim();
  if (dCompet.length === 7 && dCompet.includes("-")) dCompet = `${dCompet}-01`;
  else if (dCompet.length === 6 && /^\d{6}$/.test(dCompet)) {
    dCompet = `${dCompet.slice(0, 4)}-${dCompet.slice(4, 6)}-01`;
  }
  if (dCompet) dCompet = dCompet.split("T")[0];
  if (dCompet && isNaN(Date.parse(dCompet))) dCompet = "";
  if (!dCompet) {
    const dh = String(pickFirst(inf, [["dps", "infdps", "dhemi"], ["dhemi"]]) ?? "").trim();
    if (dh && !isNaN(Date.parse(dh))) dCompet = dh.split("T")[0];
  }

  // Valores
  const valor_bruto = num(
    pickFirst(inf, [
      ["dps", "infdps", "valores", "vservprest", "vserv"],
      ["dps", "infdps", "valores", "vserv"],
      ["valores", "vservprest", "vserv"],
      ["valores", "vserv"],
      ["valores", "valorservicos"],
      ["servico", "valores", "valorservicos"],
    ])
  );

  const valor_retido = num(
    pickFirst(inf, [
      ["valores", "vtotalret"],
      ["dps", "infdps", "valores", "vtotalret"],
      ["valores", "valortotalretencoes"],
    ])
  );

  let valor_liquido = num(
    pickFirst(inf, [
      ["valores", "vliq"],
      ["dps", "infdps", "valores", "vliq"],
      ["valores", "valorliquidonfse"],
      ["valores", "valorliquido"],
    ])
  );
  if (valor_liquido <= 0) {
    valor_liquido = Math.max(0, valor_bruto - valor_retido);
  }

  // ── Serviço ───────────────────────────────────────────────────────
  // ItemListaServico (código LC 116, ex: "01.01")
  const item_lista_servico = String(
    pickFirst(inf, [
      ["dps", "infdps", "serv", "cserv", "lc116"],
      ["dps", "infdps", "serv", "itemlistaservico"],
      ["serv", "itemlistaservico"],
      ["servico", "itemlistaservico"],
      ["inftributacao", "itemlistaservico"],
    ]) ?? ""
  ).trim() || undefined;

  // Código do Serviço (código municipal)
  const codigo_servico = String(
    pickFirst(inf, [
      ["dps", "infdps", "serv", "cserv", "cmunic"],
      ["dps", "infdps", "serv", "codigoservico"],
      ["serv", "codigoservico"],
      ["servico", "codigoservico"],
      ["servico", "codigotributacaomunicipio"],
    ]) ?? ""
  ).trim() || undefined;

  // Descrição / Discriminação do serviço
  const rawDesc = String(
    pickFirst(inf, [
      ["dps", "infdps", "serv", "descserv"],
      ["dps", "infdps", "serv", "xdiscriminacao"],
      ["serv", "discriminacao"],
      ["servico", "discriminacao"],
      ["servico", "descricao"],
    ]) ?? ""
  ).trim();
  // Truncar a 120 chars para não poluir storage/display
  const descricao_servico = rawDesc ? rawDesc.slice(0, 120) : undefined;

  return {
    ok: true,
    nota: {
      id_nota,
      data_competencia: dCompet,
      cnpj_prestador: cnpjPrestador,
      cnpj_tomador: cnpjTomador,
      nome_prestador: nomePrestador || undefined,
      nome_tomador: nomeTomador || undefined,
      valor_bruto,
      valor_retido,
      valor_liquido,
      item_lista_servico,
      codigo_servico,
      descricao_servico,
    },
  };
}

export async function buildHash(nota: CanonicalNota): Promise<string> {
  return sha256(`${nota.id_nota}|${nota.cnpj_prestador}|${nota.valor_bruto}`);
}
