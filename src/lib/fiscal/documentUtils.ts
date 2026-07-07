/**
 * Normaliza um documento removendo caracteres não numéricos.
 */
export function normalizeDocument(doc: string): string {
  return doc.replace(/\D/g, "");
}

/**
 * Valida o formato e os dígitos verificadores de um CPF.
 */
export function validateCpf(cpf: string): boolean {
  const clean = normalizeDocument(cpf);
  if (clean.length !== 11) return false;

  // Elimina CPFs conhecidos de dígitos repetidos
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // Valida 1º dígito
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  // Valida 2º dígito
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;

  return true;
}

/**
 * Valida o formato e os dígitos verificadores de um CNPJ.
 */
export function validateCnpj(cnpj: string): boolean {
  const clean = normalizeDocument(cnpj);
  if (clean.length !== 14) return false;

  // Elimina CNPJs conhecidos de dígitos repetidos
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // Valida 1º dígito
  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  // Valida 2º dígito
  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Formata um documento (CPF ou CNPJ) com base no número de dígitos.
 */
export function formatDocument(doc: string): string {
  const clean = normalizeDocument(doc);
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}
