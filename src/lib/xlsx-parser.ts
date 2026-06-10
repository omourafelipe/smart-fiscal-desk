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
const ISS_SYNONYMS = [
  "iss retido",
  "issretido",
  "iss ret",
  "iss_ret",
  "retencao iss",
  "retenção iss",
  "iss retido fonte",
  "issqn retido",
  "situacao iss",
  "situação iss",
  "iss recolher",
  "iss a recolher",
  "issqn a recolher",
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
 * Tenta adivinhar quais colunas correspondem à Chave, Status e ISS Retido.
 */
export function detectColumns(headers: string[]): { keyColumn?: string; statusColumn?: string; issColumn?: string } {
  let keyColumn: string | undefined;
  let statusColumn: string | undefined;
  let issColumn: string | undefined;

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

    // Procura por sinônimos do iss retido
    if (!issColumn) {
      for (const synonym of ISS_SYNONYMS) {
        if (norm.includes(normalizeString(synonym))) {
          issColumn = header;
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
  if (!issColumn) {
    issColumn = headers.find(
      (h) => normalizeString(h).includes("retido") || normalizeString(h).includes("retenc"),
    );
  }

  return { keyColumn, statusColumn, issColumn };
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

  // Se contiver negações de cancelamento, a nota é válida
  if (
    norm.includes("naocancel") ||
    norm.includes("semcancel") ||
    norm.includes("naosubst") ||
    norm.includes("semsubst")
  ) {
    return "válida";
  }

  if (norm.includes("emitida") || norm.includes("paga")) {
    return "válida";
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

export function parseExcelIssRetido(value: unknown): "Sim" | "Não" {
  if (value === undefined || value === null) return "Não";
  const norm = normalizeString(String(value));
  if (!norm) return "Não";

  // Termos que indicam explicitamente NÃO retido (verificar PRIMEIRO para evitar falsos positivos)
  // Ex: "ISSQN a Recolher", "Não Retido", "Recolher"
  const noTerms = [
    "arecolher",     // "ISSQN a Recolher", "ISS a Recolher"
    "recolher",      // "Recolher" sozinho
    "naoretido",     // "Não Retido"
    "naoret",        // "Não Ret."
    "nret",          // "N.Ret"
    "naorecolhido",
    "no",
    "false",
    "0",
    "nao",
  ];
  for (const term of noTerms) {
    if (norm === term || norm.startsWith(term) || norm.includes(term)) return "Não";
  }

  // Termos que indicam SIM (retido na fonte)
  // Ex: "Retenção do ISSQN", "Retido", "Sim"
  // IMPORTANTE: não usar termos curtos como "ret" (bate em "recolher")
  const yesTerms = [
    "retencaodoissqn", // "Retenção do ISSQN"
    "retencaoissqn",   // "Retenção ISSQN"
    "retencao",        // "Retenção"
    "retido",          // "Retido"
    "sim",
    "yes",
    "true",
    "1",
  ];
  for (const term of yesTerms) {
    if (norm === term || norm.startsWith(term) || norm.includes(normalizeString(term))) return "Sim";
  }

  return "Não";
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
