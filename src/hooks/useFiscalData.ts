import { useMemo, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type NotaFiscal, type NotaFiscalTomada } from "@/lib/db";
import { parseExcelStatus } from "@/lib/xlsx-parser";

export interface FiscalFilters {
  empresaFiltro: string;
  mesFiltro: string;
  anoFiltro: string;
  cServFiltro: string;
  searchCliente: string;
}

export function useFiscalData({
  filters,
  periodType,
  xlsxRows,
  keyCol,
  statusCol,
}: {
  filters: FiscalFilters;
  periodType: "competencia" | "emissao";
  xlsxRows: any[];
  keyCol: string;
  statusCol: string;
}) {
  const { empresaFiltro, mesFiltro, anoFiltro, cServFiltro, searchCliente } = filters;

  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], [] as NotaFiscal[]);
  const todasNotasTomadas = useLiveQuery(() => db.notasTomadas.toArray(), [], [] as NotaFiscalTomada[]);

  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    todasNotas?.forEach((n) => {
      if (!map.has(n.cnpjPrestador)) map.set(n.cnpjPrestador, n.nomePrestador || n.cnpjPrestador);
    });
    return Array.from(map.entries()).map(([cnpj, nome]) => ({ cnpj, nome }));
  }, [todasNotas]);

  const cnpjsGrupoMap = useMemo(() => {
    const map = new Map<string, string>();
    empresas.forEach((e) => {
      map.set(e.cnpj.replace(/\D/g, ""), e.nome);
    });
    return map;
  }, [empresas]);

  const checkIntergrupo = useCallback((cnpjCpfCliente: string) => {
    const cleanDoc = String(cnpjCpfCliente ?? "").replace(/\D/g, "");
    if (cnpjsGrupoMap.has(cleanDoc)) {
      return cnpjsGrupoMap.get(cleanDoc) || "";
    }
    return null;
  }, [cnpjsGrupoMap]);

  const getDateField = useCallback((n: NotaFiscal) => {
    if (periodType === "competencia" && n.dCompet) {
      return n.dCompet.split("T")[0];
    }
    return (n.dhEmi || "").split("T")[0];
  }, [periodType]);

  const xlsxStatusMap = useMemo(() => {
    const map = new Map<string, "válida" | "cancelada" | "nao_encontrado">();
    if (xlsxRows.length > 0 && keyCol && statusCol) {
      xlsxRows.forEach((row) => {
        const rawKey = String(row[keyCol] ?? "").trim();
        const key = rawKey.replace(/\D/g, "");
        if (key) {
          const rawStatus = String(row[statusCol] ?? "").trim();
          map.set(key, parseExcelStatus(rawStatus));
        }
      });
    }
    return map;
  }, [xlsxRows, keyCol, statusCol]);

  const getNoteStatus = useCallback((n: NotaFiscal) => {
    if (xlsxRows.length > 0 && n.chave && xlsxStatusMap.has(n.chave)) {
      return xlsxStatusMap.get(n.chave) || "válida";
    }
    return n.status || "válida";
  }, [xlsxStatusMap, xlsxRows]);

  const notasAtivasGrupo = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      if (getNoteStatus(n) !== "válida") return false;
      const dateStr = getDateField(n);
      if (mesFiltro !== "__all__" && dateStr.slice(5, 7) !== mesFiltro) return false;
      if (anoFiltro !== "__all__" && dateStr.slice(0, 4) !== anoFiltro) return false;
      if (cServFiltro !== "__all__") {
        const c1 = String(n.codTribNacional || "").replace(/^0+/, "");
        const c2 = String(cServFiltro).replace(/^0+/, "");
        const isHospitalarMatch = 
          (c2 === "43301" || c2 === "40301") && 
          (c1 === "43301" || c1 === "40301");
        if (c1 !== c2 && !isHospitalarMatch) return false;
      }
      return true;
    });
  }, [todasNotas, mesFiltro, anoFiltro, cServFiltro, getDateField, getNoteStatus]);

  const groupStats = useMemo(() => {
    const companyMap = new Map<string, { cnpj: string; nome: string; total: number; count: number; intergrupo: number; externo: number }>();
    
    empresas.forEach((e) => {
      companyMap.set(e.cnpj.replace(/\D/g, ""), {
        cnpj: e.cnpj,
        nome: e.nome,
        total: 0,
        count: 0,
        intergrupo: 0,
        externo: 0,
      });
    });

    let totalGroupBilling = 0;
    let totalIntergrupoBilling = 0;
    const intergroupNotes: Array<NotaFiscal & { tomadorNome: string }> = [];

    notasAtivasGrupo.forEach((n) => {
      const prestadorCnpjClean = n.cnpjPrestador.replace(/\D/g, "");
      
      let entry = companyMap.get(prestadorCnpjClean);
      if (!entry) {
        entry = {
          cnpj: n.cnpjPrestador,
          nome: n.nomePrestador || n.cnpjPrestador,
          total: 0,
          count: 0,
          intergrupo: 0,
          externo: 0,
        };
        companyMap.set(prestadorCnpjClean, entry);
      }
      
      entry.total += n.valor;
      entry.count++;
      totalGroupBilling += n.valor;

      const tomadorNome = checkIntergrupo(n.cnpjCpfCliente);
      if (tomadorNome) {
        entry.intergrupo += n.valor;
        totalIntergrupoBilling += n.valor;
        intergroupNotes.push({
          ...n,
          tomadorNome
        });
      } else {
        entry.externo += n.valor;
      }
    });

    const companyList = Array.from(companyMap.values()).map((c) => {
      return {
        ...c,
        externo: c.total - c.intergrupo,
        share: totalGroupBilling > 0 ? (c.total / totalGroupBilling) * 100 : 0
      };
    }).sort((a, b) => b.total - a.total);

    const totalExternalBilling = totalGroupBilling - totalIntergrupoBilling;

    return {
      companyList,
      totalGroupBilling,
      totalIntergrupoBilling,
      totalExternalBilling,
      intergroupNotes: intergroupNotes.sort((a, b) => (getDateField(b) || "").localeCompare(getDateField(a) || "")),
    };
  }, [notasAtivasGrupo, empresas, checkIntergrupo, getDateField]);

  const groupLineChartData = useMemo(() => {
    if (!todasNotas) return [];
    
    const currentGroupNotas = todasNotas.filter((n) => {
      if (getNoteStatus(n) !== "válida") return false;
      const dateStr = getDateField(n);
      if (anoFiltro !== "__all__" && dateStr.slice(0, 4) !== anoFiltro) return false;
      if (cServFiltro !== "__all__") {
        const c1 = String(n.codTribNacional || "").replace(/^0+/, "");
        const c2 = String(cServFiltro).replace(/^0+/, "");
        const isHospitalarMatch = 
          (c2 === "43301" || c2 === "40301") && 
          (c1 === "43301" || c1 === "40301");
        if (c1 !== c2 && !isHospitalarMatch) return false;
      }
      return true;
    });

    const brutoMap = new Map<string, number>();
    const intergrupoMap = new Map<string, number>();

    currentGroupNotas.forEach((n) => {
      const dateStr = getDateField(n);
      if (!dateStr) return;
      const key = dateStr.slice(5, 7); // MM
      
      brutoMap.set(key, (brutoMap.get(key) ?? 0) + n.valor);
      
      if (checkIntergrupo(n.cnpjCpfCliente)) {
        intergrupoMap.set(key, (intergrupoMap.get(key) ?? 0) + n.valor);
      }
    });

    const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const data = [];
    
    for (let i = 1; i <= 12; i++) {
      const mesStr = String(i).padStart(2, "0");
      const bruto = brutoMap.get(mesStr) ?? 0;
      const intergrupo = intergrupoMap.get(mesStr) ?? 0;
      const liquido = bruto - intergrupo;
      
      data.push({
        label: mesesAbrev[i - 1],
        "Faturamento Bruto": bruto,
        "Faturamento Intergrupo": intergrupo,
        "Faturamento Líquido": liquido,
      });
    }
    return data;
  }, [todasNotas, anoFiltro, cServFiltro, checkIntergrupo, getDateField, getNoteStatus]);

  const anos = useMemo(() => {
    const set = new Set<string>();
    todasNotas?.forEach((n) => {
      const dateStr = getDateField(n);
      if (dateStr) {
        const y = dateStr.slice(0, 4);
        if (y.length === 4) set.add(y);
      }
    });
    return Array.from(set).sort().reverse();
  }, [todasNotas, getDateField]);

  const notasFiltradas = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      const dateStr = getDateField(n);
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      if (mesFiltro !== "__all__" && dateStr.slice(5, 7) !== mesFiltro) return false;
      if (anoFiltro !== "__all__" && dateStr.slice(0, 4) !== anoFiltro) return false;
      if (cServFiltro !== "__all__") {
        const c1 = String(n.codTribNacional || "").replace(/^0+/, "");
        const c2 = String(cServFiltro).replace(/^0+/, "");
        const isHospitalarMatch = 
          (c2 === "43301" || c2 === "40301") && 
          (c1 === "43301" || c1 === "40301");
        if (c1 !== c2 && !isHospitalarMatch) return false;
      }
      if (searchCliente) {
        const query = searchCliente.toLowerCase();
        const clientMatch = n.cliente.toLowerCase().includes(query);
        const numberMatch = String(n.nNFSe || "").toLowerCase().includes(query);
        if (!clientMatch && !numberMatch) return false;
      }
      return true;
    });
  }, [todasNotas, empresaFiltro, mesFiltro, anoFiltro, cServFiltro, searchCliente, getDateField]);

  const notasAtivas = useMemo(() => notasFiltradas.filter((n) => getNoteStatus(n) === "válida"), [notasFiltradas, getNoteStatus]);
  const notasCanceladas = useMemo(() => notasFiltradas.filter((n) => getNoteStatus(n) === "cancelada"), [notasFiltradas, getNoteStatus]);
  
  const faturamento = useMemo(() => notasAtivas.reduce((sum, n) => sum + n.valor, 0), [notasAtivas]);
  const ticketMedio = useMemo(() => notasAtivas.length ? faturamento / notasAtivas.length : 0, [notasAtivas, faturamento]);

  const prevNotasFiltradas = useMemo(() => {
    if (!todasNotas) return [];
    
    let prevAno = anoFiltro;
    let prevMes = mesFiltro;
    
    if (anoFiltro !== "__all__") {
      if (mesFiltro !== "__all__") {
        let m = parseInt(mesFiltro, 10);
        let y = parseInt(anoFiltro, 10);
        m--;
        if (m === 0) {
          m = 12;
          y--;
        }
        prevMes = String(m).padStart(2, "0");
        prevAno = String(y);
      } else {
        let y = parseInt(anoFiltro, 10);
        prevAno = String(y - 1);
      }
    } else {
      if (mesFiltro !== "__all__" && mesFiltro !== undefined) {
        let m = parseInt(mesFiltro, 10);
        m--;
        if (m === 0) m = 12;
        prevMes = String(m).padStart(2, "0");
      } else {
        if (anos.length >= 1) {
          prevAno = String(parseInt(anos[0], 10) - 1);
        }
      }
    }

    return todasNotas.filter((n) => {
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      const dateStr = getDateField(n);
      if (prevAno !== "__all__" && dateStr.slice(0, 4) !== prevAno) return false;
      if (prevMes !== "__all__" && dateStr.slice(5, 7) !== prevMes) return false;
      if (cServFiltro !== "__all__") {
        const c1 = String(n.codTribNacional || "").replace(/^0+/, "");
        const c2 = String(cServFiltro).replace(/^0+/, "");
        const isHospitalarMatch = 
          (c2 === "43301" || c2 === "40301") && 
          (c1 === "43301" || c1 === "40301");
        if (c1 !== c2 && !isHospitalarMatch) return false;
      }
      if (searchCliente) {
        const query = searchCliente.toLowerCase();
        const clientMatch = n.cliente.toLowerCase().includes(query);
        const numberMatch = String(n.nNFSe || "").toLowerCase().includes(query);
        if (!clientMatch && !numberMatch) return false;
      }
      return true;
    });
  }, [todasNotas, empresaFiltro, mesFiltro, anoFiltro, cServFiltro, searchCliente, anos, getDateField]);

  const prevNotasAtivas = useMemo(() => {
    return prevNotasFiltradas.filter((n) => getNoteStatus(n) === "válida");
  }, [prevNotasFiltradas, getNoteStatus]);

  const prevNotasCanceladas = useMemo(() => {
    return prevNotasFiltradas.filter((n) => getNoteStatus(n) === "cancelada");
  }, [prevNotasFiltradas, getNoteStatus]);

  const prevFaturamento = useMemo(() => {
    return prevNotasAtivas.reduce((sum, n) => sum + n.valor, 0);
  }, [prevNotasAtivas]);

  const prevNotasCount = useMemo(() => prevNotasAtivas.length, [prevNotasAtivas]);

  const getTrend = useCallback((current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: true, text: "0%" };
    const diff = ((current - previous) / previous) * 100;
    const isPositive = diff >= 0;
    return {
      percent: Math.abs(diff),
      isPositive,
      text: `${isPositive ? "+" : ""}${diff.toFixed(1)}%`
    };
  }, []);

  const faturamentoTrend = useMemo(() => getTrend(faturamento, prevFaturamento), [faturamento, prevFaturamento, getTrend]);
  const notasAtivasTrend = useMemo(() => getTrend(notasAtivas.length, prevNotasCount), [notasAtivas.length, prevNotasCount, getTrend]);

  const valorCancelado = useMemo(() => {
    return notasCanceladas.reduce((sum, n) => sum + n.valor, 0);
  }, [notasCanceladas]);

  const cancelRate = useMemo(() => {
    const totalCount = notasFiltradas.length;
    return totalCount ? (notasCanceladas.length / totalCount) * 100 : 0;
  }, [notasCanceladas, notasFiltradas]);

  const prevValorCancelado = useMemo(() => {
    return prevNotasCanceladas.reduce((sum, n) => sum + n.valor, 0);
  }, [prevNotasCanceladas]);

  const prevCancelRate = useMemo(() => {
    const totalCount = prevNotasFiltradas.length;
    return totalCount ? (prevNotasCanceladas.length / totalCount) * 100 : 0;
  }, [prevNotasCanceladas, prevNotasFiltradas]);

  const cancelRateTrend = useMemo(() => getTrend(cancelRate, prevCancelRate), [cancelRate, prevCancelRate, getTrend]);

  const plansFaturamento = useMemo(() => {
    return notasAtivas
      .filter((n) => String(n.codTribNacional || "").replace(/^0+/, "") === "42201")
      .reduce((sum, n) => sum + n.valor, 0);
  }, [notasAtivas]);

  const prevPlansFaturamento = useMemo(() => {
    return prevNotasAtivas
      .filter((n) => String(n.codTribNacional || "").replace(/^0+/, "") === "42201")
      .reduce((sum, n) => sum + n.valor, 0);
  }, [prevNotasAtivas]);

  const plansTrend = useMemo(() => getTrend(plansFaturamento, prevPlansFaturamento), [plansFaturamento, prevPlansFaturamento, getTrend]);

  const hospFaturamento = useMemo(() => {
    return notasAtivas
      .filter((n) => {
        const c = String(n.codTribNacional || "").replace(/^0+/, "");
        return c === "40301" || c === "43301";
      })
      .reduce((sum, n) => sum + n.valor, 0);
  }, [notasAtivas]);

  const prevHospFaturamento = useMemo(() => {
    return prevNotasAtivas
      .filter((n) => {
        const c = String(n.codTribNacional || "").replace(/^0+/, "");
        return c === "40301" || c === "43301";
      })
      .reduce((sum, n) => sum + n.valor, 0);
  }, [prevNotasAtivas]);

  const hospTrend = useMemo(() => getTrend(hospFaturamento, prevHospFaturamento), [hospFaturamento, prevHospFaturamento, getTrend]);

  const notasParaGrafico = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      if (getNoteStatus(n) !== "válida") return false;
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      const dateStr = getDateField(n);
      if (anoFiltro !== "__all__" && dateStr.slice(0, 4) !== anoFiltro) return false;
      if (cServFiltro !== "__all__") {
        const c1 = String(n.codTribNacional || "").replace(/^0+/, "");
        const c2 = String(cServFiltro).replace(/^0+/, "");
        const isHospitalarMatch = 
          (c2 === "43301" || c2 === "40301") && 
          (c1 === "43301" || c1 === "40301");
        if (c1 !== c2 && !isHospitalarMatch) return false;
      }
      if (searchCliente) {
        const query = searchCliente.toLowerCase();
        const clientMatch = n.cliente.toLowerCase().includes(query);
        const numberMatch = String(n.nNFSe || "").toLowerCase().includes(query);
        if (!clientMatch && !numberMatch) return false;
      }
      return true;
    });
  }, [todasNotas, empresaFiltro, anoFiltro, cServFiltro, searchCliente, getDateField, getNoteStatus]);

  const prevNotasParaGrafico = useMemo(() => {
    if (!todasNotas) return [];
    let prevAno = anoFiltro;
    if (anoFiltro !== "__all__") {
      let y = parseInt(anoFiltro, 10);
      prevAno = String(y - 1);
    } else {
      if (anos.length >= 1) {
        prevAno = String(parseInt(anos[0], 10) - 1);
      }
    }

    return todasNotas.filter((n) => {
      if (getNoteStatus(n) !== "válida") return false;
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      const dateStr = getDateField(n);
      if (prevAno !== "__all__" && dateStr.slice(0, 4) !== prevAno) return false;
      if (cServFiltro !== "__all__") {
        const c1 = String(n.codTribNacional || "").replace(/^0+/, "");
        const c2 = String(cServFiltro).replace(/^0+/, "");
        const isHospitalarMatch = 
          (c2 === "43301" || c2 === "40301") && 
          (c1 === "43301" || c1 === "40301");
        if (c1 !== c2 && !isHospitalarMatch) return false;
      }
      if (searchCliente) {
        const query = searchCliente.toLowerCase();
        const clientMatch = n.cliente.toLowerCase().includes(query);
        const numberMatch = String(n.nNFSe || "").toLowerCase().includes(query);
        if (!clientMatch && !numberMatch) return false;
      }
      return true;
    });
  }, [todasNotas, empresaFiltro, anoFiltro, cServFiltro, searchCliente, anos, getDateField, getNoteStatus]);

  const lineChartData = useMemo(() => {
    const currentMap = new Map<string, number>();
    const prevMap = new Map<string, number>();
    
    notasParaGrafico.forEach((n) => {
      const dateStr = getDateField(n);
      if (!dateStr) return;
      const key = dateStr.slice(5, 7);
      currentMap.set(key, (currentMap.get(key) ?? 0) + n.valor);
    });
    
    prevNotasParaGrafico.forEach((n) => {
      const dateStr = getDateField(n);
      if (!dateStr) return;
      const key = dateStr.slice(5, 7);
      prevMap.set(key, (prevMap.get(key) ?? 0) + n.valor);
    });
    
    const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const data = [];
    for (let i = 1; i <= 12; i++) {
      const mesStr = String(i).padStart(2, "0");
      data.push({
        label: mesesAbrev[i - 1],
        "Período Atual": currentMap.get(mesStr) ?? 0,
        "Período Anterior": prevMap.get(mesStr) ?? 0,
      });
    }
    return data;
  }, [notasParaGrafico, prevNotasParaGrafico, getDateField]);

  const topServicesList = useMemo(() => {
    const map = new Map<string, { cod: string; desc: string; total: number }>();
    notasAtivas.forEach((n) => {
      const cod = n.codTribNacional || "";
      const key = cod || "Outros";
      const desc = getServicoDescricao(cod);
      const curr = map.get(key) || { cod, desc, total: 0 };
      curr.total += n.valor;
      map.set(key, curr);
    });
    
    const sorted = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
      
    return sorted.map((s) => ({
      name: s.desc,
      value: s.total,
      percentage: faturamento > 0 ? (s.total / faturamento) * 100 : 0
    }));
  }, [notasAtivas, faturamento]);

  const notasPrincipaisClientes = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      if (getNoteStatus(n) !== "válida") return false;
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      return true;
    });
  }, [todasNotas, empresaFiltro, getNoteStatus]);

  const topClientesList = useMemo(() => {
    const map = new Map<string, { cnpjCpf: string; nome: string; total: number; count: number }>();
    notasPrincipaisClientes.forEach((n) => {
      const key = n.cnpjCpfCliente || "Desconhecido";
      const curr = map.get(key) || { cnpjCpf: key, nome: n.cliente || "Desconhecido", total: 0, count: 0 };
      curr.total += n.valor;
      curr.count += 1;
      map.set(key, curr);
    });
    
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [notasPrincipaisClientes]);

  const issRetidoTotal = useMemo(() => {
    return notasAtivas.reduce((sum, n) => (n.issRetido === "Sim" ? sum + (n.vlrIss ?? 0) : sum), 0);
  }, [notasAtivas]);

  const issARecolherTotal = useMemo(() => {
    return notasAtivas.reduce((sum, n) => (n.issRetido === "Não" ? sum + (n.vlrIss ?? 0) : sum), 0);
  }, [notasAtivas]);

  const pisTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrPis ?? 0), 0), [notasAtivas]);
  const cofinsTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrCofins ?? 0), 0), [notasAtivas]);
  const csllTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrCsll ?? 0), 0), [notasAtivas]);
  const irrfTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrIrrf ?? 0), 0), [notasAtivas]);
  const inssTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrInss ?? 0), 0), [notasAtivas]);

  const tributosFederaisTotal = useMemo(() => {
    return pisTotal + cofinsTotal + csllTotal + irrfTotal + inssTotal;
  }, [pisTotal, cofinsTotal, csllTotal, irrfTotal, inssTotal]);

  const barData = useMemo(() => {
    const byKey = new Map<string, number>();
    const useDay = anoFiltro !== "__all__" && mesFiltro !== "__all__";
    notasAtivas.forEach((n) => {
      const dateStr = getDateField(n);
      if (!dateStr) return;
      const key = useDay ? dateStr.slice(0, 10) : dateStr.slice(0, 7);
      byKey.set(key, (byKey.get(key) ?? 0) + n.valor);
    });
    return Array.from(byKey.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        label: useDay ? formatarDiaMes(k) : formatarMesAnoCurto(k),
        valor: v,
      }));
  }, [notasAtivas, mesFiltro, anoFiltro, getDateField]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    const isGlobal = empresaFiltro === "__all__";
    notasAtivas.forEach((n) => {
      const key = isGlobal
        ? n.nomePrestador || n.cnpjPrestador
        : getServicoDescricao(n.codTribNacional);
      map.set(key, (map.get(key) ?? 0) + n.valor);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [notasAtivas, empresaFiltro]);

  const pieTitle = empresaFiltro === "__all__" ? "Faturamento por Empresa" : "Top Serviços por Faturamento";

  return {
    todasNotas,
    todasNotasTomadas,
    empresas,
    cnpjsGrupoMap,
    checkIntergrupo,
    getDateField,
    xlsxStatusMap,
    getNoteStatus,
    notasAtivasGrupo,
    groupStats,
    groupLineChartData,
    anos,
    notasFiltradas,
    notasAtivas,
    notasCanceladas,
    faturamento,
    ticketMedio,
    prevNotasFiltradas,
    prevNotasAtivas,
    prevNotasCanceladas,
    prevFaturamento,
    prevNotasCount,
    faturamentoTrend,
    notasAtivasTrend,
    valorCancelado,
    cancelRate,
    prevValorCancelado,
    prevCancelRate,
    cancelRateTrend,
    plansFaturamento,
    plansTrend,
    hospFaturamento,
    hospTrend,
    lineChartData,
    topServicesList,
    topClientesList,
    issRetidoTotal,
    issARecolherTotal,
    pisTotal,
    cofinsTotal,
    csllTotal,
    irrfTotal,
    inssTotal,
    tributosFederaisTotal,
    barData,
    pieData,
    pieTitle,
  };
}

// Helpers duplicated from index.tsx for self-containment
const formatarDiaMes = (dataStr: string) => {
  if (!dataStr) return "";
  const p = dataStr.split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}`;
  return dataStr;
};

const formatarMesAnoCurto = (mesAnoStr: string) => {
  if (!mesAnoStr || mesAnoStr.length !== 7) return mesAnoStr;
  const [ano, mes] = mesAnoStr.split("-");
  const mesesCurto = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const m = parseInt(mes, 10);
  if (m >= 1 && m <= 12) {
    return `${mesesCurto[m - 1]}/${ano.slice(2)}`;
  }
  return mesAnoStr;
};

const getServicoDescricao = (codTrib: string) => {
  const code = String(codTrib).trim();
  if (!code) return "Sem descrição";

  if (code === "042201" || code === "42201") return "Planos de Saúde";
  if (code === "040301" || code === "40301" || code === "043301" || code === "43301") return "Serviços Hospitalares";
  return `Serviço ${code}`;
};
