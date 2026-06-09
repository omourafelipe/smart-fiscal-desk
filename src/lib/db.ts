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
  status: "ativa" | "cancelada";
  chave: string;
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
  }
}

export const db = new NfseDB();
