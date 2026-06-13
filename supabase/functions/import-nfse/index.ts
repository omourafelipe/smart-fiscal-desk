import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.2.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

function pick(obj: any, path: string[]): any {
  let cur = obj;
  for (const p of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

// Find NFSe node regardless of envelope wrapper
function findNFSe(obj: any): any {
  if (!obj || typeof obj !== "object") return null;
  if (obj.NFSe && typeof obj.NFSe === "object") {
    if (obj.NFSe.infNFSe) return obj.NFSe;
  }
  for (const k of Object.keys(obj)) {
    const found = findNFSe(obj[k]);
    if (found) return found;
  }
  return null;
}

function getNumberFallback(root: any, relativePaths: string[][]): number {
  for (const rel of relativePaths) {
    let val = pick(root, ["DPS", "infDPS", "valores", ...rel]);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    val = pick(root, ["valores", ...rel]);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    val = pick(root, ["DPS", "infDPS", ...rel]);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    val = pick(root, rel);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
}

function getIssRetido(root: any): "Sim" | "Não" {
  const rawVal = pick(root, ["DPS", "infDPS", "valores", "trib", "tribMun", "tpRetISSQN"]) ??
                 pick(root, ["valores", "trib", "tribMun", "tpRetISSQN"]) ??
                 pick(root, ["DPS", "infDPS", "valores", "tpRetISSQN"]) ??
                 pick(root, ["valores", "tpRetISSQN"]);
  if (rawVal === undefined || rawVal === null) return "Não";

  const tpRetISSQN = String(rawVal).trim().toLowerCase();
  if (tpRetISSQN === "2" || tpRetISSQN.startsWith("2") || tpRetISSQN.includes("tomador") || tpRetISSQN.includes("retenção") || tpRetISSQN.includes("retencao")) return "Sim";
  return "Não";
}

function getMunicipalCode(inf: any): string {
  return String(
    pick(inf, ["DPS", "infDPS", "serv", "cServ", "cTribMun"]) ??
    pick(inf, ["serv", "cServ", "cTribMun"]) ??
    pick(inf, ["DPS", "infDPS", "serv", "CodigoTributacaoMunicipio"]) ??
    pick(inf, ["servico", "CodigoTributacaoMunicipio"]) ??
    pick(inf, ["Servico", "CodigoTributacaoMunicipio"]) ??
    pick(inf, ["CodigoTributacaoMunicipio"]) ??
    pick(inf, ["DPS", "infDPS", "serv", "CodigoServicoMunicipio"]) ??
    pick(inf, ["servico", "CodigoServicoMunicipio"]) ??
    pick(inf, ["Servico", "CodigoServicoMunicipio"]) ??
    pick(inf, ["CodigoServicoMunicipio"]) ??
    pick(inf, ["DPS", "infDPS", "serv", "cServ"]) ??
    pick(inf, ["serv", "cServ"]) ??
    ""
  ).trim();
}

function getNbsCode(inf: any): string {
  return String(
    pick(inf, ["DPS", "infDPS", "serv", "cNBS"]) ??
    pick(inf, ["DPS", "infDPS", "serv", "cServ", "cNBS"]) ??
    pick(inf, ["serv", "cNBS"]) ??
    pick(inf, ["serv", "cServ", "cNBS"]) ??
    pick(inf, ["DPS", "infDPS", "serv", "CodigoNbs"]) ??
    pick(inf, ["servico", "CodigoNbs"]) ??
    pick(inf, ["Servico", "CodigoNbs"]) ??
    pick(inf, ["CodigoNbs"]) ??
    ""
  ).trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const webhookToken = req.headers.get("x-webhook-token") ?? "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Auth validation
    let isValidAuth = false;
    if (webhookToken && webhookToken === Deno.env.get("IMPORT_WEBHOOK_SECRET")) {
      isValidAuth = true;
    } else if (authHeader.startsWith("Bearer ")) {
      // Validate via user JWT
      const tempClient = createClient(supabaseUrl, authHeader.replace("Bearer ", ""));
      const { data: { user }, error } = await tempClient.auth.getUser();
      if (user && !error) {
        isValidAuth = true;
      }
    }

    if (!isValidAuth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const { xml, group_id } = body;

    if (!group_id) {
      return new Response(JSON.stringify({ error: "Missing group_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!xml) {
      return new Response(JSON.stringify({ error: "Missing xml content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Instantiate Supabase Admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch group owner_user_id to satisfy user_id NOT NULL constraint
    const { data: groupData, error: groupError } = await supabaseAdmin
      .from("groups")
      .select("owner_user_id")
      .eq("id", group_id)
      .single();

    if (groupError || !groupData) {
      return new Response(JSON.stringify({ error: "Group not found in database" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = groupData.owner_user_id;

    // 2. Fetch list of registered CNPJs for the group
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from("companies")
      .select("cnpj")
      .eq("group_id", group_id);

    const groupCnpjs = new Set(
      (companies || []).map((c) => c.cnpj.replace(/\D/g, "")).filter(Boolean)
    );

    const xmlList = Array.isArray(xml) ? xml : [xml];
    let inserted = 0;
    const errors: string[] = [];

    for (const xmlStr of xmlList) {
      try {
        const json = parser.parse(xmlStr);
        const NFSe = findNFSe(json);
        if (!NFSe) {
          errors.push("XML format invalid: NFSe node not found");
          continue;
        }
        const inf = NFSe.infNFSe;
        if (!inf) {
          errors.push("XML format invalid: infNFSe node not found");
          continue;
        }

        const nNFSe = String(inf.nNFSe ?? "").trim();
        const cnpjPrestador = String(pick(inf, ["emit", "CNPJ"]) ?? "").trim().replace(/\D/g, "");
        const nomePrestador = String(pick(inf, ["emit", "xNome"]) ?? "").trim();

        const cnpjCliente = String(pick(inf, ["DPS", "infDPS", "toma", "CNPJ"]) ?? "").trim().replace(/\D/g, "");
        const cpfCliente = String(pick(inf, ["DPS", "infDPS", "toma", "CPF"]) ?? "").trim().replace(/\D/g, "");
        const cnpjCpfCliente = cnpjCliente || cpfCliente;
        const clienteNome = String(pick(inf, ["DPS", "infDPS", "toma", "xNome"]) ?? "").trim();

        if (!nNFSe || !cnpjPrestador) {
          errors.push("XML format invalid: missing nNFSe or cnpjPrestador");
          continue;
        }

        // Determine if Note is EMITIDA (Prestador in Group) or TOMADA (Tomador in Group)
        const isEmitida = groupCnpjs.size === 0 || groupCnpjs.has(cnpjPrestador);
        const isTomada = !isEmitida && groupCnpjs.has(cnpjCpfCliente);

        let dhEmi = String(pick(inf, ["DPS", "infDPS", "dhEmi"]) ?? "").trim();
        if (dhEmi && isNaN(Date.parse(dhEmi))) dhEmi = "";

        const valor = getNumberFallback(inf, [["vServPrest", "vServ"], ["vServ"]]);
        const vlrLiquido = getNumberFallback(inf, [["vLiq"], ["vLiquido"]]) || valor;
        const servico = String(
          pick(inf, ["DPS", "infDPS", "serv", "xDescServ"]) ??
          pick(inf, ["DPS", "infDPS", "serv", "cServ", "xDescServ"]) ??
          pick(inf, ["DPS", "infDPS", "serv", "cServ"]) ??
          ""
        ).trim();

        const cStat = String(inf.cStat ?? "").trim();
        const chave = String(inf["@_Id"] ?? "").replace(/\D/g, "").trim();

        const nbs = getNbsCode(inf);
        const cTribNac = String(
          pick(inf, ["DPS", "infDPS", "serv", "cTribNac"]) ??
          pick(inf, ["DPS", "infDPS", "serv", "cServ", "cTribNac"]) ??
          pick(inf, ["serv", "cTribNac"]) ??
          ""
        ).trim();
        const municipal = getMunicipalCode(inf);
        const codTribNacional = cTribNac || nbs || municipal;

        const issRetidoFlag = getIssRetido(inf);
        const vlrIssRetRaw = getNumberFallback(inf, [["vISSRet"], ["trib", "tribMun", "vISSRet"]]);
        const vlrIssQN = getNumberFallback(inf, [["vISSQN"], ["vISS"], ["trib", "tribMun", "vISSQN"], ["trib", "tribMun", "vISS"]]);

        let dCompet = String(pick(inf, ["DPS", "infDPS", "dCompet"]) ?? pick(inf, ["dCompet"]) ?? "").trim();
        if (dCompet.length === 7 && dCompet.includes("-")) {
          dCompet = `${dCompet}-01`;
        } else if (dCompet.length === 6 && !dCompet.includes("-")) {
          dCompet = `${dCompet.slice(0, 4)}-${dCompet.slice(4, 6)}-01`;
        } else if (dCompet && isNaN(Date.parse(dCompet))) {
          dCompet = "";
        }
        if (!dCompet) dCompet = dhEmi ? dhEmi.slice(0, 10) : "";

        // Retenções Federais
        const vlrCsll = getNumberFallback(inf, [["trib", "tribFed", "vRetCSLL"], ["trib", "tribFed", "vCSLL"], ["vCSLL"]]);
        const vlrIrrf = getNumberFallback(inf, [["trib", "tribFed", "vRetIRRF"], ["trib", "tribFed", "vIRRF"], ["vIRRF"]]);
        const vlrPis = getNumberFallback(inf, [["trib", "tribFed", "piscofins", "vPis"], ["trib", "tribFed", "vRetPIS"], ["vPis"]]);
        const vlrCofins = getNumberFallback(inf, [["trib", "tribFed", "piscofins", "vCofins"], ["trib", "tribFed", "vRetCOFINS"], ["vCofins"]]);
        const vlrInss = getNumberFallback(inf, [["trib", "tribFed", "vRetCP"], ["trib", "tribFed", "vRetINSS"], ["vRetINSS"]]);

        if (isTomada) {
          // Process as Tomada
          const vlrIssRet = issRetidoFlag === "Sim" ? (vlrIssRetRaw > 0 ? vlrIssRetRaw : vlrIssQN) : 0;
          const vlrIss = vlrIssRet > 0 ? vlrIssRet : vlrIssQN;

          const record = {
            id: `tomada_${nNFSe}_${cnpjPrestador}`,
            user_id: userId,
            group_id: group_id,
            n_nfse: nNFSe,
            cnpj_tomador: cnpjCpfCliente,
            nome_tomador: clienteNome || "Empresa do Grupo",
            cnpj_prestador: cnpjPrestador,
            nome_prestador: nomePrestador || "Fornecedor Externo",
            dh_emi: dhEmi,
            d_compet: dCompet,
            valor: valor,
            vlr_liquido: vlrLiquido,
            servico: servico,
            cod_trib_nacional: codTribNacional,
            c_stat: cStat,
            status: "válida",
            chave: chave,
            iss_retido: issRetidoFlag,
            vlr_iss_ret: vlrIssRet,
            vlr_iss: vlrIss,
            vlr_irrf: vlrIrrf,
            vlr_csll: vlrCsll,
            vlr_pis: vlrPis,
            vlr_cofins: vlrCofins,
            vlr_inss: vlrInss,
            raw: xmlStr,
          };

          const { error: insertErr } = await supabaseAdmin
            .from("nfse_documents_tomadas")
            .upsert(record);

          if (insertErr) {
            errors.push(`Database error inserting tomadas record ${nNFSe}: ${insertErr.message}`);
          } else {
            inserted++;
          }
        } else {
          // Process as Emitida
          const vlrIssRet = vlrIssRetRaw > 0 ? vlrIssRetRaw : issRetidoFlag === "Sim" ? vlrIssQN : 0;
          const vlrIssRecolher = issRetidoFlag === "Não" ? vlrIssQN : 0;
          const vlrIss = vlrIssRet > 0 ? vlrIssRet : vlrIssRecolher;

          const record = {
            id: `${nNFSe}_${cnpjPrestador}`,
            user_id: userId,
            group_id: group_id,
            n_nfse: nNFSe,
            cnpj_prestador: cnpjPrestador,
            nome_prestador: nomePrestador,
            dh_emi: dhEmi,
            valor: valor,
            cliente: clienteNome || "Cliente Final",
            servico: servico,
            c_stat: cStat,
            status: "válida",
            chave: chave,
            cnpj_cpf_cliente: cnpjCpfCliente,
            vlr_liquido: vlrLiquido,
            vlr_iss: vlrIss,
            vlr_iss_ret: vlrIssRet,
            vlr_iss_recolher: vlrIssRecolher,
            iss_retido: issRetidoFlag,
            vlr_csll: vlrCsll,
            vlr_irrf: vlrIrrf,
            vlr_pis: vlrPis,
            vlr_cofins: vlrCofins,
            vlr_inss: vlrInss,
            cod_trib_nacional: codTribNacional,
            d_compet: dCompet,
            raw: xmlStr,
          };

          const { error: insertErr } = await supabaseAdmin
            .from("nfse_documents")
            .upsert(record);

          if (insertErr) {
            errors.push(`Database error inserting record ${nNFSe}: ${insertErr.message}`);
          } else {
            inserted++;
          }
        }
      } catch (err: any) {
        errors.push(`Parse error: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ inserted, errors }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
