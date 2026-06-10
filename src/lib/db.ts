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

class NfseDB extends Dexie {
  notas!: Table<NotaFiscal, string>;
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
  }
}

export const db = new NfseDB();
