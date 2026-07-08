import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useFiscalStore } from "@/store/useFiscalStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, ShieldCheck, Database, FileX, Copy, Tag, Landmark } from "lucide-react";
import { GlobalFilters } from "@/components/GlobalFilters";

export const Route = createFileRoute("/fiscal")({
  component: FiscalDashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "—";
};

function FiscalDashboard() {
  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const audits = useLiveQuery(() => db.audits.toArray(), []);
  const grupoCnpjs = useLiveQuery(() => db.groupCnpjs.toArray(), []);

  const {
    mesFiltro,
    anoFiltro,
    empresaFiltro,
    statusFiltro,
    operacaoFiltro,
    clienteFiltro,
    municipioFiltro,
    codigoTributarioFiltro,
    categoriaFiltro,
    grupoFiltro,
  } = useFiscalStore();

  const cnpjGrupoSet = useMemo(
    () => new Set((grupoCnpjs ?? []).map((g) => g.cnpj)),
    [grupoCnpjs]
  );

  // Apply global filters
  const filtrados = useMemo(() => {
    return (docs ?? []).filter((d) => {
      if (anoFiltro) {
        if (!d.data_competencia || d.data_competencia.slice(0, 4) !== anoFiltro) return false;
      }
      if (mesFiltro) {
        if (!d.data_competencia || d.data_competencia.split("-")[1] !== mesFiltro) return false;
      }
      if (empresaFiltro && d.cnpj_prestador !== empresaFiltro) return false;
      if (statusFiltro !== "todos" && d.status_manual !== statusFiltro) return false;

      const isIntercompany = cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
      if (operacaoFiltro === "Intercompany" && !isIntercompany) return false;
      if (operacaoFiltro === "Externas" && isIntercompany) return false;

      if (clienteFiltro && (d.nome_tomador || d.cnpj_tomador) !== clienteFiltro) return false;
      if (municipioFiltro && d.municipio !== municipioFiltro) return false;
      if (categoriaFiltro && d.categoria !== categoriaFiltro) return false;
      if (grupoFiltro && d.grupo !== grupoFiltro) return false;

      if (codigoTributarioFiltro) {
        const code = d.item_lista_servico || d.codigo_servico;
        if (code !== codigoTributarioFiltro) return false;
      }

      return true;
    });
  }, [docs, anoFiltro, mesFiltro, empresaFiltro, statusFiltro, operacaoFiltro, clienteFiltro, municipioFiltro, categoriaFiltro, grupoFiltro, codigoTributarioFiltro, cnpjGrupoSet]);

  const activeDocs = useMemo(
    () => (statusFiltro === "todos" ? filtrados.filter((d) => d.status_manual === "Ativo") : filtrados),
    [filtrados, statusFiltro]
  );

  // 1. XMLs Inválidos / Erros de Importação
  const xmlErros = useMemo(() => {
    let count = 0;
    const items: { arquivo: string; motivo: string; data: string }[] = [];
    
    (audits ?? []).forEach(a => {
      count += a.erros;
      if (a.detalhes_erros && a.detalhes_erros.length > 0) {
        a.detalhes_erros.forEach(e => {
          items.push({
            arquivo: e.arquivo,
            motivo: e.motivo,
            data: new Date(a.data_hora).toLocaleString("pt-BR")
          });
        });
      }
    });
    
    return { count, items: items.slice(0, 15) };
  }, [audits]);

  // 2. Notas Duplicadas (Same hash or same ID prestador + n_nfse in general docs)
  const duplicadas = useMemo(() => {
    let count = 0;
    (audits ?? []).forEach(a => {
      count += a.duplicadas;
    });

    // Detect if we have duplicate keys inside local IndexedDB
    const seen = new Set<string>();
    const dupList: typeof activeDocs = [];

    activeDocs.forEach(d => {
      // Find duplicates by unique key: cnpj_prestador + raw number (from ID)
      const key = `${d.cnpj_prestador}_${d.id_nota}`;
      if (seen.has(key)) {
        dupList.push(d);
      } else {
        seen.add(key);
      }
    });

    return { count: count || dupList.length, items: dupList };
  }, [audits, activeDocs]);

  // 3. Serviços não Classificados (no category set)
  const naoClassificados = useMemo(() => {
    return activeDocs.filter(d => !d.categoria);
  }, [activeDocs]);

  // 4. Divergências Tributárias
  // Check if declared total retention matches the sum of CSLL, IRRF, PIS, COFINS, INSS, ISS_Ret
  const divergenciasTributarias = useMemo(() => {
    return activeDocs.filter(d => {
      const declaredRet = d.valor_retido || 0;
      const calculatedRet = 
        (d.vlr_csll || 0) + 
        (d.vlr_irrf || 0) + 
        (d.vlr_pis || 0) + 
        (d.vlr_cofins || 0) + 
        (d.vlr_inss || 0) + 
        (d.vlr_iss_ret || 0);
      
      // Flags a divergence if they differ by more than R$ 2.00
      const taxDiff = Math.abs(declaredRet - calculatedRet) > 2;

      // Flags a divergence if Net Value doesn't match Gross - Ret
      const netDiff = Math.abs(d.valor_liquido - (d.valor_bruto - declaredRet)) > 2;

      return taxDiff || netDiff;
    });
  }, [activeDocs]);

  // 5. Municípios inconsistentes (not set or matches digits)
  const municipiosInconsistentes = useMemo(() => {
    return activeDocs.filter(d => {
      const m = d.municipio || "";
      return !m || m.trim().length === 0 || /^\d+$/.test(m);
    });
  }, [activeDocs]);

  const hasIssues = 
    xmlErros.count > 0 ||
    duplicadas.items.length > 0 ||
    naoClassificados.length > 0 ||
    divergenciasTributarias.length > 0 ||
    municipiosInconsistentes.length > 0;

  return (
    <div className="p-6 bg-background space-y-6 max-w-[1440px] mx-auto min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-primary" />
          Dashboard Fiscal & Qualidade
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Auditoria de qualidade dos dados: identifique XMLs inválidos, duplicados, erros tributários e notas sem classificação.
        </p>
      </div>

      {/* Global Filters */}
      <GlobalFilters />

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "XMLs Inválidos", count: xmlErros.count, color: C.rose, icon: FileX },
          { label: "Notas Duplicadas", count: duplicadas.count, color: C.amber, icon: Copy },
          { label: "Sem Classificação", count: naoClassificados.length, color: C.purple, icon: Tag },
          { label: "Divergência Tributária", count: divergenciasTributarias.length, color: C.orange, icon: AlertTriangle },
          { label: "Municípios Inconsistentes", count: municipiosInconsistentes.length, color: C.blue, icon: Landmark }
        ].map((kpi, idx) => (
          <div key={idx} className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between h-24">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">{kpi.label}</span>
              <span className="text-xl font-bold text-foreground font-mono">{kpi.count}</span>
            </div>
            <div className="p-3 rounded-xl" style={{ background: `${kpi.color}15` }}>
              <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
            </div>
          </div>
        ))}
      </div>

      {!hasIssues ? (
        <Card className="border-border text-center py-20">
          <CardContent className="space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Base de Dados Saneada</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Nenhuma inconsistência fiscal, nota duplicada ou erro cadastral identificado nos filtros aplicados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel: Tax discrepancies & Missing classifications */}
          <div className="lg:col-span-6 space-y-6">
            {/* Tax Discrepancies */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  Notas com Divergências Tributárias
                </CardTitle>
                <CardDescription>
                  Notas onde a soma individual dos impostos retidos difere do total declarado no XML, ou onde o valor líquido diverge de (Bruto - Retenções).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 border-t border-border overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nota</TableHead>
                        <TableHead className="text-xs">Tomador</TableHead>
                        <TableHead className="text-xs text-right">Retido Decl.</TableHead>
                        <TableHead className="text-xs text-right">Soma Impostos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {divergenciasTributarias.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                            Nenhuma divergência tributária detectada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        divergenciasTributarias.map((d, idx) => {
                          const sumTaxes = (d.vlr_csll || 0) + (d.vlr_irrf || 0) + (d.vlr_pis || 0) + (d.vlr_cofins || 0) + (d.vlr_inss || 0) + (d.vlr_iss_ret || 0);
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs text-foreground">{d.id_nota.slice(0, 10)}...</TableCell>
                              <TableCell className="text-xs truncate max-w-[120px]" title={d.nome_tomador}>{d.nome_tomador || "—"}</TableCell>
                              <TableCell className="text-xs text-right font-mono font-medium">{fmtBRL(d.valor_retido)}</TableCell>
                              <TableCell className="text-xs text-right font-mono font-medium text-rose-600">{fmtBRL(sumTaxes)}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Services with missing classifications */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-purple-600">
                  <Tag className="h-4 w-4" />
                  Serviços Pendentes de Classificação Gerencial
                </CardTitle>
                <CardDescription>
                  Faturamentos ativos cujas descrições não deram match com nenhuma regra tributária gerencial ativa.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 border-t border-border overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Serviço / Descrição</TableHead>
                        <TableHead className="text-xs text-right">Faturamento</TableHead>
                        <TableHead className="text-xs text-center">Classificar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {naoClassificados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                            Todos os faturamentos estão classificados!
                          </TableCell>
                        </TableRow>
                      ) : (
                        naoClassificados.slice(0, 20).map((d, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">
                              <div className="font-medium text-foreground truncate max-w-[220px]" title={d.descricao_servico}>{d.descricao_servico || "Sem descrição"}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">Código: {d.item_lista_servico || d.codigo_servico || "—"}</div>
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono font-medium">{fmtBRL(d.valor_bruto)}</TableCell>
                            <TableCell className="text-center">
                              <Link to="/classificacao" className="text-[11px] text-primary font-bold hover:underline">
                                Classificar
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right panel: XML errors, duplicates, and municipalities */}
          <div className="lg:col-span-6 space-y-6">
            {/* XML Import Errors */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-rose-600">
                  <FileX className="h-4 w-4" />
                  Log de XMLs Inválidos / Rejeitados
                </CardTitle>
                <CardDescription>
                  Arquivos enviados para a aplicação que falharam no parse sintático ou contêm tags estruturais incompatíveis.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 border-t border-border overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data Lote</TableHead>
                        <TableHead className="text-xs">Arquivo XML</TableHead>
                        <TableHead className="text-xs">Motivo Rejeição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {xmlErros.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                            Nenhum erro de XML registrado nas auditorias.
                          </TableCell>
                        </TableRow>
                      ) : (
                        xmlErros.items.map((e, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-[10px] font-mono text-muted-foreground">{e.data}</TableCell>
                            <TableCell className="text-xs font-mono font-medium max-w-[140px] truncate" title={e.arquivo}>{e.arquivo}</TableCell>
                            <TableCell className="text-xs text-rose-600">{e.motivo}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Inconsistent Municipalities */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-blue-600">
                  <Landmark className="h-4 w-4" />
                  Divergências de Cadastro Geográfico
                </CardTitle>
                <CardDescription>
                  Notas fiscais com campos de município não informados, nulos ou representados de forma incorreta no XML.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 border-t border-border overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nota</TableHead>
                        <TableHead className="text-xs">Tomador</TableHead>
                        <TableHead className="text-xs">Valor Bruto</TableHead>
                        <TableHead className="text-xs">Município XML</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {municipiosInconsistentes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                            Nenhuma inconsistência geográfica encontrada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        municipiosInconsistentes.map((d, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs text-foreground">{d.id_nota.slice(0, 10)}...</TableCell>
                            <TableCell className="text-xs truncate max-w-[120px]" title={d.nome_tomador}>{d.nome_tomador || "—"}</TableCell>
                            <TableCell className="text-xs font-mono">{fmtBRL(d.valor_bruto)}</TableCell>
                            <TableCell className="text-xs text-rose-600 italic">{d.municipio || "Não informado"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
