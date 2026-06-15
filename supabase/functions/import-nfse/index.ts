// @ts-nocheck
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
  removeNSPrefix: true, // Strips namespace prefixes (e.g. tc:infNFSe -> infNFSe)
});

function pick(obj: any, path: string[]): any {
  let cur = obj;
  for (const p of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
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
function findNFSe(obj: any): any {
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

function getNumberFallback(root: any, relativePaths: string[][]): number {
  for (const rel of relativePaths) {
    let val = pick(root, ["dps", "infdps", "valores", ...rel]);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    val = pick(root, ["valores", ...rel]);
    if (val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    val = pick(root, ["dps", "infdps", ...rel]);
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
  const rawVal = pick(root, ["dps", "infdps", "valores", "trib", "tribmun", "tpretissqn"]) ??
                 pick(root, ["valores", "trib", "tribmun", "tpretissqn"]) ??
                 pick(root, ["dps", "infdps", "valores", "tpretissqn"]) ??
                 pick(root, ["valores", "tpretissqn"]);
  if (rawVal === undefined || rawVal === null) return "Não";

  const tpRetISSQN = String(rawVal).trim().toLowerCase();
  if (tpRetISSQN === "2" || tpRetISSQN.startsWith("2") || tpRetISSQN.includes("tomador") || tpRetISSQN.includes("retenção") || tpRetISSQN.includes("retencao")) return "Sim";
  return "Não";
}

function getMunicipalCode(inf: any): string {
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

function getNbsCode(inf: any): string {
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

serve(async (req: any) => {
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
      return new Response(
        JSON.stringify({
          success: false,
          message: "Unauthorized access",
          data: null,
          errors: ["Unauthorized"]
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { xml, group_id } = body;

    if (!group_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing group_id parameter",
          data: null,
          errors: ["Missing group_id"]
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!xml) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing xml content parameter",
          data: null,
          errors: ["Missing xml content"]
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
      return new Response(
        JSON.stringify({
          success: false,
          message: "Group not found in database",
          data: null,
          errors: [groupError?.message || "Group not found"]
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const userId = groupData.owner_user_id;

    // 2. Fetch list of registered CNPJs for the group
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from("companies")
      .select("cnpj")
      .eq("group_id", group_id);

    const groupCnpjs = new Set(
      (companies || []).map((c: any) => c.cnpj.replace(/\D/g, "")).filter(Boolean)
    );

    const xmlList = Array.isArray(xml) ? xml : [xml];
    let inserted = 0;
    const errors: string[] = [];

    for (const xmlStr of xmlList) {
      try {
        const json = parser.parse(xmlStr);
        const normalizedJson = lowercaseKeys(json);
        const NFSe = findNFSe(normalizedJson);
        if (!NFSe) {
          errors.push("XML format invalid: NFSe node not found");
          continue;
        }
        const inf = NFSe.infnfse || NFSe.infdps;
        if (!inf) {
          errors.push("XML format invalid: infNFSe/infDPS node not found");
          continue;
        }

        const nNFSe = String(inf.nnfse ?? "").trim();
        const cnpjPrestador = String(pick(inf, ["emit", "cnpj"]) ?? "").trim().replace(/\D/g, "");
        const nomePrestador = String(pick(inf, ["emit", "xnome"]) ?? "").trim();

        const cnpjCliente = String(pick(inf, ["dps", "infdps", "toma", "cnpj"]) ?? "").trim().replace(/\D/g, "");
        const cpfCliente = String(pick(inf, ["dps", "infdps", "toma", "cpf"]) ?? "").trim().replace(/\D/g, "");
        const cnpjCpfCliente = cnpjCliente || cpfCliente;
        const clienteNome = String(pick(inf, ["dps", "infdps", "toma", "xnome"]) ?? "").trim();

        if (!nNFSe || !cnpjPrestador) {
          errors.push("XML format invalid: missing nNFSe or cnpjPrestador");
          continue;
        }

        // Determine if Note is EMITIDA (Prestador in Group) or TOMADA (Tomador in Group)
        const isEmitida = groupCnpjs.size === 0 || groupCnpjs.has(cnpjPrestador);
        const isTomada = !isEmitida && groupCnpjs.has(cnpjCpfCliente);

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
        const chave = String(inf["@_id"] ?? "").replace(/\D/g, "").trim();

        const nbs = getNbsCode(inf);
        const cTribNac = String(
          pick(inf, ["dps", "infdps", "serv", "ctribnac"]) ??
          pick(inf, ["dps", "infdps", "serv", "cserv", "ctribnac"]) ??
          pick(inf, ["serv", "ctribnac"]) ??
          ""
        ).trim();
        const municipal = getMunicipalCode(inf);
        const codTribNacional = cTribNac || nbs || municipal;

        const issRetidoFlag = getIssRetido(inf);
        const vlrIssRetRaw = getNumberFallback(inf, [
          ["vissret"],
          ["trib", "tribmun", "vissret"],
          ["valores", "valorissretido"],
          ["valores", "vissret"]
        ]);
        const vlrIssQN = getNumberFallback(inf, [
          ["vissqn"],
          ["viss"],
          ["trib", "tribmun", "vissqn"],
          ["trib", "tribmun", "viss"],
          ["valores", "valoriss"],
          ["valores", "vissqn"],
          ["valores", "viss"]
        ]);

        // Define ISS Retido for Net Value calculation
        const vlrIssRet = isTomada
          ? (issRetidoFlag === "Sim" ? (vlrIssRetRaw > 0 ? vlrIssRetRaw : vlrIssQN) : 0)
          : (vlrIssRetRaw > 0 ? vlrIssRetRaw : (issRetidoFlag === "Sim" ? vlrIssQN : 0));

        let dCompet = String(pick(inf, ["dps", "infdps", "dcompet"]) ?? pick(inf, ["dcompet"]) ?? "").trim();
        if (dCompet.length === 7 && dCompet.includes("-")) {
          dCompet = `${dCompet}-01`;
        } else if (dCompet.length === 6 && !dCompet.includes("-")) {
          dCompet = `${dCompet.slice(0, 4)}-${dCompet.slice(4, 6)}-01`;
        } else if (dCompet && isNaN(Date.parse(dCompet))) {
          dCompet = "";
        }
        if (!dCompet) dCompet = dhEmi ? dhEmi.slice(0, 10) : "";

        // Retenções Federais
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

        if (isTomada) {
          // Process as Tomada
          const vlrIssRetTomada = issRetidoFlag === "Sim" ? (vlrIssRetRaw > 0 ? vlrIssRetRaw : vlrIssQN) : 0;
          const vlrIss = vlrIssRetTomada > 0 ? vlrIssRetTomada : vlrIssQN;

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
            vlr_iss_ret: vlrIssRetTomada,
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
          const vlrIssRetEmitida = vlrIssRetRaw > 0 ? vlrIssRetRaw : issRetidoFlag === "Sim" ? vlrIssQN : 0;
          const vlrIssRecolher = issRetidoFlag === "Não" ? vlrIssQN : 0;
          const vlrIss = vlrIssRetEmitida > 0 ? vlrIssRetEmitida : vlrIssRecolher;

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
            vlr_iss_ret: vlrIssRetEmitida,
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
      JSON.stringify({
        success: true,
        message: `${inserted} document(s) imported successfully`,
        data: { inserted },
        errors
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: err.message || "Internal server error during import",
        data: null,
        errors: [err.message || "Internal server error"]
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
