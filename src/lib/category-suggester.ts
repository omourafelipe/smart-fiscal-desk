import {
  lc116CategoriasMap,
  getServicoDescricao,
} from "./category-utils";

export interface SugestaoCategoria {
  nomeSugerido: string;
  codigos: string[];
  totalNotas: number;
  descricaoExemplo: string;
}

/**
 * Simplifica descrições governamentais longas em nomes elegantes e curtos para categorias
 */
export function extrairNomeCategoriaSugerido(desc: string): string {
  if (!desc || desc === "Sem descrição" || desc.startsWith("Outros (")) {
    return "";
  }

  let text = desc.trim();

  // Remove ponto final
  if (text.endsWith(".")) {
    text = text.slice(0, -1);
  }

  // Lista de substituições de prefixos formais da LC 116 e NBS
  const prefixosParaRemover = [
    /^[Ss]erviços de /i,
    /^[Ss]erviços relativos a /i,
    /^[Ss]erviços relacionados com /i,
    /^[Ss]erviços relacionados a /i,
    /^[Ee]xecução de /i,
    /^[Aa]dministração, agenciamento ou gerência de /i,
    /^[Aa]dministração de /i,
    /^[Pp]lanejamento, organização e administração de /i,
    /^[Ll]ocação, sublocação, arrendamento, direito de uso, cessão de direito ou exploração de /i,
  ];

  for (const regex of prefixosParaRemover) {
    if (regex.test(text)) {
      text = text.replace(regex, "");
      break;
    }
  }

  // Substituições de termos específicos muito longos
  text = text
    .replace(/^[Aa]ssessoria ou consultoria de qualquer natureza/i, "Assessoria ou Consultoria")
    .replace(/^[Ll]ocação de /i, "Locação de ")
    .replace(/^[Cc]essão de direito de /i, "Cessão de ");

  // Trunca em vírgulas, ponto e vírgula, parênteses ou traços para manter o nome curto
  const limitadores = [",", ";", "(", " - "];
  for (const lim of limitadores) {
    const idx = text.indexOf(lim);
    if (idx !== -1) {
      text = text.substring(0, idx);
    }
  }

  text = text.trim();

  // Capitaliza a primeira letra de cada palavra (Title Case)
  if (text.length > 0) {
    text = text
      .split(" ")
      .map((w) => {
        if (w.length <= 2 && ["de", "do", "da", "em", "para", "com", "ou", "e"].includes(w.toLowerCase())) {
          return w.toLowerCase();
        }
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  }

  // Se o nome sugerido ainda for longo demais, mantém apenas as 4 primeiras palavras
  const words = text.split(" ");
  if (words.length > 4) {
    text = words.slice(0, 4).join(" ") + "...";
  }

  return text;
}

/**
 * Analisa os códigos que caíram em "Serviços Diversos" e agrupa sugestões coerentes
 */
export function gerarSugestoesCategorias(
  uniqueCodes: Array<{ codigo: string; descricao: string; catAuto: string; count: number }>,
  categoryOverrides: Record<string, string>,
  todasCategorias: string[]
): SugestaoCategoria[] {
  const sugestoesMap = new Map<string, { codigos: string[]; totalNotas: number; descricaoExemplo: string }>();

  for (const item of uniqueCodes) {
    // Apenas códigos que caíram em "Serviços Diversos" e não possuem override manual
    if (item.catAuto !== "Serviços Diversos" || categoryOverrides[item.codigo]) {
      continue;
    }

    if (item.count <= 0) continue;

    const officialDesc = getServicoDescricao(item.codigo);
    const nomeSugerido = extrairNomeCategoriaSugerido(officialDesc);

    if (!nomeSugerido || nomeSugerido.toLowerCase() === "serviços diversos") {
      continue;
    }

    // Evita sugerir categorias que já existem
    const jaExiste = todasCategorias.some(
      (cat) => cat.toLowerCase() === nomeSugerido.toLowerCase()
    );
    if (jaExiste) {
      continue;
    }

    // Agrupa códigos sob o mesmo nome de sugestão
    const key = nomeSugerido.toLowerCase();
    const existing = sugestoesMap.get(key);

    if (existing) {
      existing.codigos.push(item.codigo);
      existing.totalNotas += item.count;
    } else {
      sugestoesMap.set(key, {
        codigos: [item.codigo],
        totalNotas: item.count,
        descricaoExemplo: officialDesc,
      });
    }
  }

  // Converte o mapa em lista e ordena por relevância (mais notas primeiro)
  return Array.from(sugestoesMap.entries())
    .map(([key, data]) => {
      // Reconstrói o casing correto a partir do nome
      const nomeSugerido = extrairNomeCategoriaSugerido(data.descricaoExemplo);
      return {
        nomeSugerido: nomeSugerido || key,
        codigos: data.codigos,
        totalNotas: data.totalNotas,
        descricaoExemplo: data.descricaoExemplo,
      };
    })
    .sort((a, b) => b.totalNotas - a.totalNotas)
    .slice(0, 5); // Mostra no máximo as top 5 sugestões mais relevantes
}
