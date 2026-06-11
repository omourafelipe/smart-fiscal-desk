import Dexie, { type Table } from "dexie";

export interface NotaFiscal {
  id: string; // nNFSe + CNPJ
  nNFSe: string;
  cnpjPrestador: string;
  nomePrestador: string;
  dhEmi: string; // ISO
  valor: number;
  cliente: string;
  servico: string;
  cStat: string;
  status: "válida" | "cancelada";
  chave: string;
  cnpjCpfCliente: string;
  vlrLiquido: number;
  vlrIss: number;
  vlrIssRet?: number;       // ISS retido na fonte (vISSRet)
  vlrIssRecolher?: number; // ISS a recolher pelo prestador (vISSQN quando não retido)
  issRetido: string;
  vlrCsll: number;
  vlrIrrf: number;
  vlrPis: number;
  vlrCofins: number;
  vlrInss: number;
  codTribNacional: string;
  dCompet: string;
  raw?: string;
}

/** Nota fiscal onde a empresa do grupo é a TOMADORA do serviço. */
export interface NotaFiscalTomada {
  id: string;               // nNFSe + CNPJ prestador
  nNFSe: string;
  /** CNPJ da empresa do grupo que contratou o serviço */
  cnpjTomador: string;
  nomeTomador: string;
  /** CNPJ do fornecedor/prestador externo */
  cnpjPrestador: string;
  nomePrestador: string;
  dhEmi: string;
  dCompet: string;
  valor: number;
  vlrLiquido: number;
  servico: string;
  codTribNacional: string;
  cStat: string;
  status: "válida" | "cancelada";
  chave: string;
  // ISS — responsabilidade de retenção do tomador
  issRetido: string;        // "Sim" | "Não"
  vlrIssRet: number;        // ISS retido pelo tomador (obrigação da Samel)
  vlrIss?: number;          // Valor total de ISS da nota
  // Retenções federais obrigatórias (IN 1.234/2012)
  vlrIrrf: number;
  vlrCsll: number;
  vlrPis: number;
  vlrCofins: number;
  vlrInss: number;
  raw?: string;
}

export interface CustomCategory {
  id: string; // Nome da categoria como ID (ex: "Consultoria")
  nome: string;
  grupoSintetico?: string;
}

export interface CategoryOverride {
  codigo: string; // codTribNacional (ex: "42201")
  categoria: string; // Nome da categoria mapeada
}

class NfseDB extends Dexie {
  notas!: Table<NotaFiscal, string>;
  notasTomadas!: Table<NotaFiscalTomada, string>;
  customCategories!: Table<CustomCategory, string>;
  categoryOverrides!: Table<CategoryOverride, string>;

  constructor() {
    super("nfse-dashboard");
    this.version(1).stores({
      notas: "id, cnpjPrestador, nomePrestador, dhEmi, status",
    });
    this.version(2).stores({
      notas: "id, cnpjPrestador, nomePrestador, dhEmi, status, chave",
    });
    this.version(3).stores({
      notas: "id, cnpjPrestador, nomePrestador, dhEmi, status, chave, cnpjCpfCliente, cServ",
    });
    this.version(4).stores({
      notas:
        "id, cnpjPrestador, nomePrestador, dhEmi, status, chave, cnpjCpfCliente, codTribNacional",
    });
    this.version(5).stores({
      notas:
        "id, cnpjPrestador, nomePrestador, dhEmi, status, chave, cnpjCpfCliente, codTribNacional",
      notasTomadas:
        "id, cnpjTomador, cnpjPrestador, nomePrestador, dhEmi, status, chave, codTribNacional",
    }).upgrade(() => {
      // Criação da tabela notasTomadas — nenhuma migração de dados necessária
    });
    this.version(6).stores({
      notas:
        "id, cnpjPrestador, nomePrestador, dhEmi, status, chave, cnpjCpfCliente, codTribNacional",
      notasTomadas:
        "id, cnpjTomador, cnpjPrestador, nomePrestador, dhEmi, status, chave, codTribNacional",
      customCategories: "id, nome",
      categoryOverrides: "codigo, categoria",
    }).upgrade(async (tx) => {
      try {
        if (typeof window !== "undefined") {
          const storedCustom = localStorage.getItem("customCategories");
          if (storedCustom) {
            const arr = JSON.parse(storedCustom) as string[];
            for (const cat of arr) {
              await tx.table("customCategories").put({ id: cat, nome: cat });
            }
          }
          const storedOverrides = localStorage.getItem("categoryOverrides");
          if (storedOverrides) {
            const obj = JSON.parse(storedOverrides) as Record<string, string>;
            for (const [codigo, categoria] of Object.entries(obj)) {
              await tx.table("categoryOverrides").put({ codigo, categoria });
            }
          }
        }
      } catch (e) {
        console.error("Erro ao migrar dados de localStorage para Dexie:", e);
      }
    });
  }
}

export const db = new NfseDB();

