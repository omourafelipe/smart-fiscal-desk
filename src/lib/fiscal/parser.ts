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
  municipio?: string;
  vlr_iss?: number;
  vlr_iss_ret?: number;
  vlr_iss_recolher?: number;
  iss_retido?: "Sim" | "Não";
  vlr_csll?: number;
  vlr_irrf?: number;
  vlr_pis?: number;
  vlr_cofins?: number;
  vlr_inss?: number;
  raw?: string;
  // Novos campos do PRD
  data_emissao: string;
  codigo_nbs?: string;
  descricao_nbs?: string;
  descricao_codigo_tributario?: string;
  iss_proprio: number;
}

export type ParseResult =
  | { ok: true; nota: CanonicalNota }
  | { ok: false; error: string };

const LC116_DESCRIPTIONS: Record<string, string> = {
  "0101": "Análise e desenvolvimento de sistemas",
  "101": "Análise e desenvolvimento de sistemas",
  "01.01": "Análise e desenvolvimento de sistemas",
  "0102": "Programação",
  "102": "Programação",
  "01.02": "Programação",
  "0103": "Processamento de dados e congêneres",
  "103": "Processamento de dados e congêneres",
  "01.03": "Processamento de dados e congêneres",
  "0104": "Elaboração de programas de computadores, inclusive de jogos eletrônicos",
  "104": "Elaboração de programas de computadores, inclusive de jogos eletrônicos",
  "01.04": "Elaboração de programas de computadores, inclusive de jogos eletrônicos",
  "0105": "Licenciamento ou cessão de direito de uso de programas de computação",
  "105": "Licenciamento ou cessão de direito de uso de programas de computação",
  "01.05": "Licenciamento ou cessão de direito de uso de programas de computação",
  "0106": "Assessoria e consultoria em informática",
  "106": "Assessoria e consultoria em informática",
  "01.06": "Assessoria e consultoria em informática",
  "0107": "Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados",
  "107": "Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados",
  "01.07": "Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados",
  "0108": "Planejamento, confecção, manutenção e atualização de páginas eletrônicas",
  "108": "Planejamento, confecção, manutenção e atualização de páginas eletrônicas",
  "01.08": "Planejamento, confecção, manutenção e atualização de páginas eletrônicas",
  "0301": "Locação de bens móveis",
  "301": "Locação de bens móveis",
  "03.01": "Locação de bens móveis",
  "0401": "Medicina e biomedicina",
  "401": "Medicina e biomedicina",
  "04.01": "Medicina e biomedicina",
  "0402": "Análises clínicas, patologia, eletricidade médica, radioterapia, quimioterapia, ultra-sonografia, ressonância magnética, radiologia, tomografia e congêneres",
  "402": "Análises clínicas, patologia, eletricidade médica, radioterapia, quimioterapia, ultra-sonografia, ressonância magnética, radiologia, tomografia e congêneres",
  "04.02": "Análises clínicas, patologia, eletricidade médica, radioterapia, quimioterapia, ultra-sonografia, ressonância magnética, radiologia, tomografia e congêneres",
  "0403": "Hospitais, clínicas, sanatórios, manicômios, casas de saúde, prontos-socorros, ambulatórios e congêneres",
  "403": "Hospitais, clínicas, sanatórios, manicômios, casas de saúde, prontos-socorros, ambulatórios e congêneres",
  "04.03": "Hospitais, clínicas, sanatórios, manicômios, casas de saúde, prontos-socorros, ambulatórios e congêneres",
  "0422": "Planos de medicina de grupo ou individual e convênios para prestação de assistência médica, hospitalar, odontológica e congêneres",
  "422": "Planos de medicina de grupo ou individual e convênios para prestação de assistência médica, hospitalar, odontológica e congêneres",
  "04.22": "Planos de medicina de grupo ou individual e convênios para prestação de assistência médica, hospitalar, odontológica e congêneres",
  "0701": "Engenharia, agronomia, tecnologia, arquitetura, urbanismo, paisagismo e congêneres",
  "701": "Engenharia, agronomia, tecnologia, arquitetura, urbanismo, paisagismo e congêneres",
  "07.01": "Engenharia, agronomia, tecnologia, arquitetura, urbanismo, paisagismo e congêneres",
  "0702": "Execução, por administração, empreitada ou subempreitada, de obras de construção civil",
  "702": "Execução, por administração, empreitada ou subempreitada, de obras de construção civil",
  "07.02": "Execução, por administração, empreitada ou subempreitada, de obras de construção civil",
  "0801": "Ensino regular pré-escolar, fundamental, médio e superior",
  "801": "Ensino regular pré-escolar, fundamental, médio e superior",
  "08.01": "Ensino regular pré-escolar, fundamental, médio e superior",
  "0802": "Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza",
  "802": "Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza",
  "08.02": "Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza",
  "1001": "Agenciamento, corretagem ou intermediação de câmbio, de seguros, de cartões de crédito, de planos de saúde e de planos de previdência privada",
  "10.01": "Agenciamento, corretagem ou intermediação de câmbio, de seguros, de cartões de crédito, de planos de saúde e de planos de previdência privada",
  "1601": "Serviços de transporte coletivo municipal rodoviário, metroviário, ferroviário e aquaviário de passageiros",
  "16.01": "Serviços de transporte coletivo municipal rodoviário, metroviário, ferroviário e aquaviário de passageiros",
  "1701": "Assessoria ou consultoria de qualquer natureza",
  "17.01": "Assessoria ou consultoria de qualquer natureza",
  "1706": "Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade, elaboração de desenhos, textos e outros materiais publicitários",
  "17.06": "Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade, elaboração de desenhos, textos e outros materiais publicitários",
  "1714": "Advocacia",
  "17.14": "Advocacia",
  "1720": "Contabilidade, inclusive serviços técnicos e auxiliares",
  "17.20": "Contabilidade, inclusive serviços técnicos e auxiliares"
};

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

  // Período de Emissão: dEmi / dhEmi / dataemissao / dh_emi
  let data_emissao = String(
    pickFirst(inf, [
      ["dps", "infdps", "dhemi"],
      ["dhemi"],
      ["dataemissao"],
      ["dh_emi"],
    ]) ?? ""
  ).trim();
  if (data_emissao) data_emissao = data_emissao.split("T")[0];
  if (!data_emissao || isNaN(Date.parse(data_emissao))) {
    data_emissao = dCompet || new Date().toISOString().split("T")[0];
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

  const iss_retido = (() => {
    const rawVal = pickFirst(inf, [
      ["dps", "infdps", "valores", "trib", "tribmun", "tpretissqn"],
      ["valores", "trib", "tribmun", "tpretissqn"],
      ["dps", "infdps", "valores", "tpretissqn"],
      ["valores", "tpretissqn"]
    ]);
    if (rawVal === undefined || rawVal === null) return "Não";
    const tpRetISSQN = String(rawVal).trim().toLowerCase();
    if (tpRetISSQN === "2" || tpRetISSQN.startsWith("2") || tpRetISSQN.includes("tomador") || tpRetISSQN.includes("retenção") || tpRetISSQN.includes("retencao")) return "Sim";
    return "Não";
  })();

  const vlr_iss_ret = num(
    pickFirst(inf, [
      ["dps", "infdps", "valores", "vissret"],
      ["valores", "vissret"],
      ["dps", "infdps", "valores", "trib", "tribmun", "vissret"],
      ["valores", "trib", "tribmun", "vissret"],
      ["valores", "valorissretido"],
    ])
  );

  const vlr_iss_recolher = iss_retido === "Não" ? num(
    pickFirst(inf, [
      ["dps", "infdps", "valores", "vissqn"],
      ["valores", "vissqn"],
      ["dps", "infdps", "valores", "viss"],
      ["valores", "viss"],
      ["dps", "infdps", "valores", "trib", "tribmun", "vissqn"],
      ["valores", "trib", "tribmun", "vissqn"],
      ["dps", "infdps", "valores", "trib", "tribmun", "viss"],
      ["valores", "trib", "tribmun", "viss"],
      ["valores", "valoriss"],
    ])
  ) : 0;

  const vlr_iss = vlr_iss_ret > 0 ? vlr_iss_ret : vlr_iss_recolher;
  const iss_proprio = iss_retido === "Não" ? vlr_iss : 0;

  const vlr_csll = num(
    pickFirst(inf, [
      ["dps", "infdps", "valores", "trib", "tribfed", "vretcsll"],
      ["dps", "infdps", "valores", "trib", "tribfed", "vcsll"],
      ["dps", "infdps", "valores", "vretcsll"],
      ["dps", "infdps", "valores", "vcsll"],
      ["valores", "vretcsll"],
      ["valores", "vcsll"],
      ["valores", "valorcsll"],
    ])
  );

  const vlr_irrf = num(
    pickFirst(inf, [
      ["dps", "infdps", "valores", "trib", "tribfed", "vretirrf"],
      ["dps", "infdps", "valores", "trib", "tribfed", "virrf"],
      ["dps", "infdps", "valores", "vretirrf"],
      ["dps", "infdps", "valores", "virrf"],
      ["valores", "vretirrf"],
      ["valores", "virrf"],
      ["valores", "valorir"],
    ])
  );

  const vlr_pis = num(
    pickFirst(inf, [
      ["dps", "infdps", "valores", "trib", "tribfed", "piscofins", "vpis"],
      ["dps", "infdps", "valores", "trib", "tribfed", "vretpis"],
      ["dps", "infdps", "valores", "trib", "tribfed", "vpis"],
      ["dps", "infdps", "valores", "vretpis"],
      ["dps", "infdps", "valores", "vpis"],
      ["valores", "vretpis"],
      ["valores", "vpis"],
      ["valores", "valorpis"],
    ])
  );

  const vlr_cofins = num(
    pickFirst(inf, [
      ["dps", "infdps", "valores", "trib", "tribfed", "piscofins", "vcofins"],
      ["dps", "infdps", "valores", "trib", "tribfed", "vretcofins"],
      ["dps", "infdps", "valores", "trib", "tribfed", "vcofins"],
      ["dps", "infdps", "valores", "vretcofins"],
      ["dps", "infdps", "valores", "vcofins"],
      ["valores", "vretcofins"],
      ["valores", "vcofins"],
      ["valores", "valorcofins"],
    ])
  );

  const vlr_inss = num(
    pickFirst(inf, [
      ["dps", "infdps", "valores", "trib", "tribfed", "vretcp"],
      ["dps", "infdps", "valores", "trib", "tribfed", "vretinss"],
      ["dps", "infdps", "valores", "vretcp"],
      ["dps", "infdps", "valores", "vretinss"],
      ["valores", "vretcp"],
      ["valores", "vretinss"],
      ["valores", "valorinss"],
      ["valores", "vinss"],
    ])
  );

  const total_impostos_detalhados = vlr_iss_ret + vlr_csll + vlr_irrf + vlr_pis + vlr_cofins + vlr_inss;

  let valor_liquido = num(
    pickFirst(inf, [
      ["valores", "vliq"],
      ["dps", "infdps", "valores", "vliq"],
      ["valores", "valorliquidonfse"],
      ["valores", "valorliquido"],
    ])
  );
  if (valor_liquido <= 0 || (valor_liquido === valor_bruto && total_impostos_detalhados > 0)) {
    valor_liquido = Math.max(0, valor_bruto - (valor_retido || total_impostos_detalhados));
  }

  // ── Serviço ───────────────────────────────────────────────────────
  const item_lista_servico = String(
    pickFirst(inf, [
      ["dps", "infdps", "serv", "cserv", "lc116"],
      ["dps", "infdps", "serv", "itemlistaservico"],
      ["serv", "itemlistaservico"],
      ["servico", "itemlistaservico"],
      ["inftributacao", "itemlistaservico"],
    ]) ?? ""
  ).trim() || undefined;

  const codigo_servico = String(
    pickFirst(inf, [
      ["dps", "infdps", "serv", "cserv", "cmunic"],
      ["dps", "infdps", "serv", "codigoservico"],
      ["serv", "codigoservico"],
      ["servico", "codigoservico"],
      ["servico", "codigotributacaomunicipio"],
    ]) ?? ""
  ).trim() || undefined;

  const rawDesc = String(
    pickFirst(inf, [
      ["dps", "infdps", "serv", "descserv"],
      ["dps", "infdps", "serv", "xdiscriminacao"],
      ["serv", "discriminacao"],
      ["servico", "discriminacao"],
      ["servico", "descricao"],
    ]) ?? ""
  ).trim();
  const descricao_servico = rawDesc ? rawDesc.slice(0, 120) : undefined;

  const municipio = String(
    pickFirst(inf, [
      ["dps", "infdps", "toma", "end", "xmun"],
      ["toma", "endereco", "xmunicipio"],
      ["dps", "infdps", "prest", "end", "xmun"],
      ["prest", "endereco", "xmunicipio"],
      ["servico", "municipioservico"],
      ["dps", "infdps", "prest", "end", "cmun"],
      ["dps", "infdps", "toma", "end", "cmun"],
    ]) ?? ""
  ).trim() || undefined;

  // NBS parsing
  const codigo_nbs = String(
    pickFirst(inf, [
      ["dps", "infdps", "serv", "cnbs"],
      ["servico", "codigonbs"],
      ["serv", "cnbs"],
      ["nbs", "codigo"],
    ]) ?? ""
  ).trim() || undefined;

  const descricao_nbs_raw = String(
    pickFirst(inf, [
      ["dps", "infdps", "serv", "descnbs"],
      ["servico", "descricaonbs"],
      ["serv", "descnbs"],
      ["nbs", "descricao"],
      ["nbs", "xdesc"],
    ]) ?? ""
  ).trim() || undefined;

  // NBS description resolution heuristic
  let resolved_desc_nbs = descricao_nbs_raw;
  if (!resolved_desc_nbs && descricao_servico) {
    const descLower = descricao_servico.toLowerCase();
    const nbsKeywords = [
      "plano privado de assistência à saúde",
      "plano privado de assistencia a saude",
      "operadora de plano de saúde",
      "assistência médica coletiva",
      "seguro saúde",
      "serviços hospitalares",
      "internação hospitalar",
      "consulta médica",
      "atendimento ambulatorial",
      "análise clínica",
      "diagnóstico por imagem",
      "consultoria em gestão",
      "consultoria empresarial",
      "desenvolvimento de software",
      "computação em nuvem",
      "licença de software",
      "publicidade e propaganda",
      "assessoria técnica"
    ];
    for (const kw of nbsKeywords) {
      if (descLower.includes(kw)) {
        resolved_desc_nbs = kw;
        break;
      }
    }
  }

  // Descrição do código tributário
  let resolved_desc_codigo = String(
    pickFirst(inf, [
      ["servico", "descricaocodigotributario"],
      ["servico", "xserv"],
      ["serv", "xserv"],
    ]) ?? ""
  ).trim() || undefined;

  if (!resolved_desc_codigo && item_lista_servico) {
    resolved_desc_codigo = LC116_DESCRIPTIONS[item_lista_servico] || LC116_DESCRIPTIONS[item_lista_servico.replace(".", "")] || undefined;
  }

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
      valor_retido: valor_retido || total_impostos_detalhados,
      valor_liquido,
      item_lista_servico,
      codigo_servico,
      descricao_servico,
      municipio,
      vlr_iss,
      vlr_iss_ret,
      vlr_iss_recolher,
      iss_retido,
      vlr_csll,
      vlr_irrf,
      vlr_pis,
      vlr_cofins,
      vlr_inss,
      raw: xml,
      data_emissao,
      codigo_nbs,
      descricao_nbs: resolved_desc_nbs,
      descricao_codigo_tributario: resolved_desc_codigo,
      iss_proprio,
    },
  };
}

export async function buildHash(nota: CanonicalNota): Promise<string> {
  return sha256(`${nota.id_nota}|${nota.cnpj_prestador}|${nota.valor_bruto}`);
}
