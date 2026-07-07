import { normalizeDocument, validateCpf, validateCnpj, formatDocument } from "@/lib/fiscal/documentUtils";
import { TomadorDocumento } from "./types";

/**
 * Simula um atraso de rede (delay) entre min e max milissegundos.
 */
const delay = (min: number, max: number) => {
  const time = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise((resolve) => setTimeout(resolve, time));
};

/**
 * Retorna true com uma probabilidade específica (ex: 0.1 para 10%).
 */
const shouldFail = (probability = 0.1): boolean => {
  return Math.random() < probability;
};

/**
 * Nome sugestões mockadas para simulação visual realista
 */
const MOCK_CPF_NAMES = [
  "Ana Beatriz Cavalcanti",
  "Rodrigo Mendes de Souza",
  "Juliana Ferreira Gomes",
  "Thiago Pereira da Silva",
  "Mariana Rocha Santos"
];

const MOCK_CNPJ_NAMES = [
  "Prime Consultoria e Tecnologia Ltda",
  "Plano de Saúde Familiar S/A",
  "Imobiliária e Administradora Alfa",
  "Limpex Facilities & Serviços Gerais",
  "Nexus Digital Marketing Agência"
];

/**
 * Detecta, valida e formata um documento do tomador.
 * Retorna dados detalhados com sugestão de nome se o documento for válido.
 * 
 * // TODO: substituir por chamada real ao endpoint '/api/fiscal/validate-document' ou consulta Supabase
 * // Integração futura:
 * // const { data, error } = await supabase.from('clientes').select('nome_razao').eq('cnpj_cpf', cleanDoc).single();
 * // if (error) { ... }
 * // return { documento: cleanDoc, tipo, valido, formatado, nome_sugerido: data?.nome_razao };
 */
export async function detectAndValidateDocument(docRaw: string): Promise<TomadorDocumento> {
  await delay(300, 800);

  if (shouldFail(0.1)) {
    throw new Error("Erro na comunicação com o serviço de cadastro nacional (Receita Federal).");
  }

  const clean = normalizeDocument(docRaw);
  
  if (clean.length === 0) {
    return {
      documento: "",
      tipo: "Desconhecido",
      valido: false,
      formatado: "",
    };
  }

  // Tenta classificar como CPF ou CNPJ baseado no tamanho da string normalizada
  let tipo: 'CPF' | 'CNPJ' | 'Desconhecido' = "Desconhecido";
  let valido = false;

  if (clean.length <= 11) {
    tipo = "CPF";
    valido = validateCpf(clean);
  } else {
    tipo = "CNPJ";
    valido = validateCnpj(clean);
  }

  const formatado = formatDocument(clean);
  
  let nome_sugerido: string | undefined = undefined;
  if (valido) {
    // Retorna uma sugestão determinística baseada no último dígito do documento
    const lastDigit = parseInt(clean.slice(-1)) || 0;
    if (tipo === "CPF") {
      nome_sugerido = MOCK_CPF_NAMES[lastDigit % MOCK_CPF_NAMES.length];
    } else {
      nome_sugerido = MOCK_CNPJ_NAMES[lastDigit % MOCK_CNPJ_NAMES.length];
    }
  }

  return {
    documento: clean,
    tipo,
    valido,
    formatado,
    nome_sugerido,
  };
}
