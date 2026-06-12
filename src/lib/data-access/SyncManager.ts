import { db } from "@/lib/db";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { toast } from "sonner";

export class SyncManager {
  private static isSyncing = false;

  /**
   * Sincroniza todos os dados locais com a nuvem (Push & Pull)
   */
  public static async syncAll(userId: string): Promise<void> {
    if (this.isSyncing || !isSupabaseConfigured || !supabase) return;

    this.isSyncing = true;
    const toastId = toast.loading("Sincronizando seus dados com a nuvem...");

    try {
      // 1. Push dos dados locais para o Supabase (Upload)
      await this.pushLocalToCloud(userId);

      // 2. Pull dos dados do Supabase para o banco local (Download)
      await this.pullCloudToLocal(userId);

      const notasCount = await db.notas.count();
      const tomadasCount = await db.notasTomadas.count();

      toast.success(
        `Sincronização concluída! ${notasCount} notas emitidas e ${tomadasCount} notas tomadas estão em conformidade com a nuvem.`,
        { id: toastId }
      );
    } catch (err: any) {
      console.error("Erro durante a sincronização:", err);
      toast.error(`Falha na sincronização: ${err.message || "Erro desconhecido"}`, { id: toastId });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Envia todos os registros do Dexie local para a tabela Supabase correspondente
   */
  private static async pushLocalToCloud(userId: string): Promise<void> {
    if (!supabase) return;

    // --- 1. Sincronizar Notas Fiscais Emitidas ---
    const localNotas = await db.notas.toArray();
    if (localNotas.length > 0) {
      const mappedNotas = localNotas.map((n) => ({
        id: n.id,
        user_id: userId,
        n_nfse: n.nNFSe,
        cnpj_prestador: n.cnpjPrestador,
        nome_prestador: n.nomePrestador,
        dh_emi: n.dhEmi,
        valor: n.valor,
        cliente: n.cliente,
        servico: n.servico,
        c_stat: n.cStat,
        status: n.status,
        chave: n.chave,
        cnpj_cpf_cliente: n.cnpjCpfCliente,
        vlr_liquido: n.vlrLiquido,
        vlr_iss: n.vlrIss,
        vlr_iss_ret: n.vlrIssRet || 0,
        vlr_iss_recolher: n.vlrIssRecolher || 0,
        iss_retido: n.issRetido,
        vlr_csll: n.vlrCsll,
        vlr_irrf: n.vlrIrrf,
        vlr_pis: n.vlrPis,
        vlr_cofins: n.vlrCofins,
        vlr_inss: n.vlrInss,
        cod_trib_nacional: n.codTribNacional,
        d_compet: n.dCompet,
        raw: n.raw,
      }));

      // Upsert em lotes de 100 para evitar payload gigante
      for (let i = 0; i < mappedNotas.length; i += 100) {
        const batch = mappedNotas.slice(i, i + 100);
        const { error } = await supabase.from("nfse_documents").upsert(batch);
        if (error) throw error;
      }
    }

    // --- 2. Sincronizar Notas Fiscais Tomadas ---
    const localNotasTomadas = await db.notasTomadas.toArray();
    if (localNotasTomadas.length > 0) {
      const mappedTomadas = localNotasTomadas.map((n) => ({
        id: n.id,
        user_id: userId,
        n_nfse: n.nNFSe,
        cnpj_tomador: n.cnpjTomador,
        nome_tomador: n.nomeTomador,
        cnpj_prestador: n.cnpjPrestador,
        nome_prestador: n.nomePrestador,
        dh_emi: n.dhEmi,
        d_compet: n.dCompet,
        valor: n.valor,
        vlr_liquido: n.vlrLiquido,
        servico: n.servico,
        cod_trib_nacional: n.codTribNacional,
        c_stat: n.cStat,
        status: n.status,
        chave: n.chave,
        iss_retido: n.issRetido,
        vlr_iss_ret: n.vlrIssRet,
        vlr_iss: n.vlrIss || 0,
        vlr_irrf: n.vlrIrrf,
        vlr_csll: n.vlrCsll,
        vlr_pis: n.vlrPis,
        vlr_cofins: n.vlrCofins,
        vlr_inss: n.vlrInss,
        raw: n.raw,
      }));

      for (let i = 0; i < mappedTomadas.length; i += 100) {
        const batch = mappedTomadas.slice(i, i + 100);
        const { error } = await supabase.from("nfse_documents_tomadas").upsert(batch);
        if (error) throw error;
      }
    }

    // --- 3. Sincronizar Categorias Customizadas ---
    const localCats = await db.customCategories.toArray();
    if (localCats.length > 0) {
      const mappedCats = localCats.map((c) => ({
        id: c.id,
        user_id: userId,
        nome: c.nome,
        grupo_sintetico: c.grupoSintetico || null,
      }));
      const { error } = await supabase.from("custom_categories").upsert(mappedCats);
      if (error) throw error;
    }

    // --- 4. Sincronizar Overrides de Categorias ---
    const localOverrides = await db.categoryOverrides.toArray();
    if (localOverrides.length > 0) {
      const mappedOverrides = localOverrides.map((o) => ({
        codigo: o.codigo,
        user_id: userId,
        categoria: o.categoria,
      }));
      const { error } = await supabase.from("category_overrides").upsert(mappedOverrides);
      if (error) throw error;
    }

    // --- 5. Sincronizar Classificações de Serviços ---
    const localClassifications = await db.serviceClassifications.toArray();
    if (localClassifications.length > 0) {
      const mappedClass = localClassifications.map((c) => ({
        codigo: c.codigo,
        user_id: userId,
        categoria_executiva: c.categoriaExecutiva,
        grupo_operacional: c.grupoOperacional,
        codigo_lc116: c.codigoLc116,
        descricao_lc116: c.descricaoLc116,
        codigo_nbs: c.codigoNbs,
        descricao_nbs: c.descricaoNbs,
        origem: c.origem,
        confianca: c.confianca,
        metodo: c.metodo,
        data_classificacao: c.dataClassificacao,
        conflito: c.conflito,
        ausente_oficial: c.ausenteOficial,
      }));
      for (let i = 0; i < mappedClass.length; i += 100) {
        const batch = mappedClass.slice(i, i + 100);
        const { error } = await supabase.from("service_classifications").upsert(batch);
        if (error) throw error;
      }
    }

    // --- 6. Sincronizar Regras de Categorização ---
    const localRules = await db.categoryRules.toArray();
    if (localRules.length > 0) {
      const mappedRules = localRules.map((r) => ({
        id: r.id,
        user_id: userId,
        tipo: r.tipo,
        chave: r.chave,
        categoria_executiva: r.categoriaExecutiva,
        grupo_operacional: r.grupoOperacional,
      }));
      const { error } = await supabase.from("category_rules").upsert(mappedRules);
      if (error) throw error;
    }

    // --- 7. Sincronizar Logs de Auditoria ---
    const localLogs = await db.auditLogs.toArray();
    if (localLogs.length > 0) {
      const mappedLogs = localLogs.map((l) => ({
        id: l.id,
        user_id: userId,
        codigo: l.codigo,
        classificacao_anterior: l.classificacaoAnterior,
        classificacao_nova: l.classificacaoNova,
        usuario: l.usuario,
        data_hora: l.dataHora,
        justificativa: l.justificativa || null,
      }));
      const { error } = await supabase.from("audit_logs").upsert(mappedLogs);
      if (error) throw error;
    }
  }

  /**
   * Baixa dados da nuvem para o Dexie local do navegador
   */
  private static async pullCloudToLocal(userId: string): Promise<void> {
    if (!supabase) return;

    // --- 1. Baixar Notas Emitidas ---
    const { data: cloudNotas, error: errNotas } = await supabase
      .from("nfse_documents")
      .select("*")
      .eq("user_id", userId);
    if (errNotas) throw errNotas;

    if (cloudNotas && cloudNotas.length > 0) {
      const mappedNotas = cloudNotas.map((n) => ({
        id: n.id,
        nNFSe: n.n_nfse,
        cnpjPrestador: n.cnpj_prestador,
        nomePrestador: n.nome_prestador || "",
        dhEmi: n.dh_emi || "",
        valor: Number(n.valor),
        cliente: n.cliente || "",
        servico: n.servico || "",
        cStat: n.c_stat || "",
        status: n.status as "válida" | "cancelada",
        chave: n.chave || "",
        cnpjCpfCliente: n.cnpj_cpf_cliente || "",
        vlrLiquido: Number(n.vlr_liquido || 0),
        vlrIss: Number(n.vlr_iss || 0),
        vlrIssRet: Number(n.vlr_iss_ret || 0),
        vlrIssRecolher: Number(n.vlr_iss_recolher || 0),
        issRetido: n.iss_retido || "Não",
        vlrCsll: Number(n.vlr_csll || 0),
        vlrIrrf: Number(n.vlr_irrf || 0),
        vlrPis: Number(n.vlr_pis || 0),
        vlrCofins: Number(n.vlr_cofins || 0),
        vlrInss: Number(n.vlr_inss || 0),
        codTribNacional: n.cod_trib_nacional || "",
        dCompet: n.d_compet || "",
        raw: n.raw || undefined,
      }));
      await db.notas.bulkPut(mappedNotas);
    }

    // --- 2. Baixar Notas Tomadas ---
    const { data: cloudTomadas, error: errTomadas } = await supabase
      .from("nfse_documents_tomadas")
      .select("*")
      .eq("user_id", userId);
    if (errTomadas) throw errTomadas;

    if (cloudTomadas && cloudTomadas.length > 0) {
      const mappedTomadas = cloudTomadas.map((n) => ({
        id: n.id,
        nNFSe: n.n_nfse,
        cnpjTomador: n.cnpj_tomador,
        nomeTomador: n.nome_tomador || "",
        cnpjPrestador: n.cnpj_prestador,
        nomePrestador: n.nome_prestador || "",
        dhEmi: n.dh_emi || "",
        dCompet: n.d_compet || "",
        valor: Number(n.valor),
        vlrLiquido: Number(n.vlr_liquido || 0),
        servico: n.servico || "",
        codTribNacional: n.cod_trib_nacional || "",
        cStat: n.c_stat || "",
        status: n.status as "válida" | "cancelada",
        chave: n.chave || "",
        issRetido: n.iss_retido || "Não",
        vlrIssRet: Number(n.vlr_iss_ret || 0),
        vlrIss: Number(n.vlr_iss || 0),
        vlrIrrf: Number(n.vlr_irrf || 0),
        vlrCsll: Number(n.vlr_csll || 0),
        vlrPis: Number(n.vlr_pis || 0),
        vlrCofins: Number(n.vlr_cofins || 0),
        vlrInss: Number(n.vlr_inss || 0),
        raw: n.raw || undefined,
      }));
      await db.notasTomadas.bulkPut(mappedTomadas);
    }

    // --- 3. Baixar Categorias Customizadas ---
    const { data: cloudCats, error: errCats } = await supabase
      .from("custom_categories")
      .select("*")
      .eq("user_id", userId);
    if (errCats) throw errCats;

    if (cloudCats && cloudCats.length > 0) {
      const mappedCats = cloudCats.map((c) => ({
        id: c.id,
        nome: c.nome,
        grupoSintetico: c.grupo_sintetico || undefined,
      }));
      await db.customCategories.bulkPut(mappedCats);
    }

    // --- 4. Baixar Overrides ---
    const { data: cloudOverrides, error: errOverrides } = await supabase
      .from("category_overrides")
      .select("*")
      .eq("user_id", userId);
    if (errOverrides) throw errOverrides;

    if (cloudOverrides && cloudOverrides.length > 0) {
      const mappedOverrides = cloudOverrides.map((o) => ({
        codigo: o.codigo,
        categoria: o.categoria,
      }));
      await db.categoryOverrides.bulkPut(mappedOverrides);
    }

    // --- 5. Baixar Classificações ---
    const { data: cloudClass, error: errClass } = await supabase
      .from("service_classifications")
      .select("*")
      .eq("user_id", userId);
    if (errClass) throw errClass;

    if (cloudClass && cloudClass.length > 0) {
      const mappedClass = cloudClass.map((c) => ({
        codigo: c.codigo,
        categoriaExecutiva: c.categoria_executiva || "",
        grupoOperacional: c.grupo_operacional || "",
        codigoLc116: c.codigo_lc116 || "",
        descricaoLc116: c.descricao_lc116 || "",
        codigoNbs: c.codigo_nbs || "",
        descricaoNbs: c.descricao_nbs || "",
        origem: c.origem as any,
        confianca: Number(c.confianca || 0),
        metodo: c.metodo || "",
        dataClassificacao: c.data_classificacao || "",
        conflito: Boolean(c.conflito),
        ausenteOficial: Boolean(c.ausente_oficial),
      }));
      await db.serviceClassifications.bulkPut(mappedClass);
    }

    // --- 6. Baixar Regras ---
    const { data: cloudRules, error: errRules } = await supabase
      .from("category_rules")
      .select("*")
      .eq("user_id", userId);
    if (errRules) throw errRules;

    if (cloudRules && cloudRules.length > 0) {
      const mappedRules = cloudRules.map((r) => ({
        id: Number(r.id),
        tipo: r.tipo as "codigo" | "descricao",
        chave: r.chave,
        categoriaExecutiva: r.categoria_executiva || "",
        grupoOperacional: r.grupo_operacional || "",
      }));
      await db.categoryRules.bulkPut(mappedRules);
    }

    // --- 7. Baixar Logs de Auditoria ---
    const { data: cloudLogs, error: errLogs } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", userId);
    if (errLogs) throw errLogs;

    if (cloudLogs && cloudLogs.length > 0) {
      const mappedLogs = cloudLogs.map((l) => ({
        id: Number(l.id),
        codigo: l.codigo,
        classificacaoAnterior: l.classificacao_anterior || "",
        classificacaoNova: l.classificacao_nova || "",
        usuario: l.usuario || "",
        dataHora: l.data_hora || "",
        justificativa: l.justificativa || undefined,
      }));
      await db.auditLogs.bulkPut(mappedLogs);
    }
  }
}
