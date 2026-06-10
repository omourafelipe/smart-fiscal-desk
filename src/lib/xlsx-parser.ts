import * as XLSX from "xlsx";

export interface ExcelRowData {
  [key: string]: unknown;
}

export interface ConciliationItem {
  rawKey: string;
  key: string; // normalizado (apenas números)
  rawStatus: string;
  status: "válida" | "cancelada";
  rowNumber: number;
}

// Cabeçalhos comuns para identificar as colunas automaticamente
const CHAVE_SYNONYMS = [
  "chave",
  "chave de acesso",
  "chave da nota",
  "chdfe",
  "id",
  "chave nfse",
  "chave nfs-e",
  "access key",
];
const STATUS_SYNONYMS = [
  "status",
  "situacao",
  "situação",
  "cstat",
  "descrição status",
  "status da nota",
  "situacao da nfs-e",
  "situação da nfs-e",
];

export function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]/g, "") // remove caracteres especiais
    .trim();
}

/**
 * Tenta adivinhar quais colunas correspondem à Chave e ao Status.
 */
export function detectColumns(headers: string[]): { keyColumn?: string; statusColumn?: string } {
  let keyColumn: string | undefined;
  let statusColumn: string | undefined;

  for (const header of headers) {
    const norm = normalizeString(header);

    // Procura por sinônimos da chave
    if (!keyColumn) {
      for (const synonym of CHAVE_SYNONYMS) {
        if (norm.includes(normalizeString(synonym))) {
          keyColumn = header;
          break;
        }
      }
    }

    // Procura por sinônimos do status
    if (!statusColumn) {
      for (const synonym of STATUS_SYNONYMS) {
        if (norm.includes(normalizeString(synonym))) {
          statusColumn = header;
          break;
        }
      }
    }
  }

  // Fallback se não encontrar
  if (!keyColumn) {
    keyColumn = headers.find(
      (h) => normalizeString(h).includes("key") || normalizeString(h).includes("code"),
    );
  }
  if (!statusColumn) {
    statusColumn = headers.find(
      (h) => normalizeString(h).includes("state") || normalizeString(h).includes("descr"),
    );
  }

  return { keyColumn, statusColumn };
}

/**
 * Lê o arquivo Excel e retorna os dados brutos e os cabeçalhos.
 */
export function parseExcelFile(arrayBuffer: ArrayBuffer): {
  headers: string[];
  rows: ExcelRowData[];
} {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<ExcelRowData>(sheet, { defval: "" });

  // Extrai cabeçalhos da primeira linha ou das chaves dos objetos
  const headersSet = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((k) => headersSet.add(k));
  });
  const headers = Array.from(headersSet);

  return { headers, rows };
}

export function parseExcelStatus(rawStatus: string): "válida" | "cancelada" {
  const norm = normalizeString(rawStatus);

  // Se contiver negações de cancelamento, a nota é ativa
  if (
    norm.includes("naocancel") ||
    norm.includes("semcancel") ||
    norm.includes("naosubst") ||
    norm.includes("semsubst")
  ) {
    return "válida";
  }

  if (norm.includes("emitida") || norm.includes("paga")) {
    return "ativa";
  }

  const cancelTerms = [
    "cancelada",
    "cancelado",
    "substituida",
    "substituido",
    "inativa",
    "inativo",
    "rejeitada",
    "101",
    "102",
    "135",
    "155",
  ];
  for (const term of cancelTerms) {
    if (norm.includes(term)) return "cancelada";
  }

  return "válida"; // Padrão válida
}

/**
 * Normaliza os valores da coluna Operação para determinar a retenção do ISSQN (Sim ou Não)
 */
export function parseExcelOperacao(rawOperacao: string): "Sim" | "Não" | undefined {
  const norm = normalizeString(rawOperacao);
  if (norm.includes("issqnarecolher") || norm.includes("arecolher")) {
    return "Não";
  }
  if (norm.includes("retencaodoissqn") || norm.includes("retencao")) {
    return "Sim";
  }
  return undefined;
}

/**
 * Processa as linhas do Excel mapeando para os campos comuns
 */
export function mapExcelRows(
  rows: ExcelRowData[],
  keyCol: string,
  statusCol: string,
): ConciliationItem[] {
  return rows
    .map((row, idx) => {
      const rawKey = String(row[keyCol] ?? "").trim();
      const key = rawKey.replace(/\D/g, ""); // Apenas números
      const rawStatus = String(row[statusCol] ?? "").trim();
      const status = parseExcelStatus(rawStatus);

      return {
        rawKey,
        key,
        rawStatus,
        status,
        rowNumber: idx + 2, // Excel começa em 1 e tem cabeçalho
      };
    })
    .filter((item) => item.key.length > 0); // Remove linhas sem chave
}
