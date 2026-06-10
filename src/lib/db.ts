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
  // Retenções federais obrigatórias (IN 1.234/2012)
  vlrIrrf: number;
  vlrCsll: number;
  vlrPis: number;
  vlrCofins: number;
  vlrInss: number;
  raw?: string;
}

class NfseDB extends Dexie {
  notas!: Table<NotaFiscal, string>;
  notasTomadas!: Table<NotaFiscalTomada, string>;

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
  }
}

export const db = new NfseDB();

