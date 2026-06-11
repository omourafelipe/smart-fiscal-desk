import nbsMapping from "./nbs_mapping.json";

// Mapas de Agrupamento Sintético e Analítico
export const lc116SubItemCategoriasMap: Record<string, string> = {};
export const categoriaParaGrupoSinteticoMap = new Map<string, string>();

// Dicionário com mapeamento dos 40 itens oficiais da LC 116 para seus nomes legíveis (sem prefixo numérico)
export const lc116CategoriasMap: Record<string, string> = {
  "01": "Informática e TI",
  "02": "Pesquisa e Desenvolvimento",
  "03": "Locação e Cessão de Direitos",
  "04": "Saúde e Assistência Médica",
  "05": "Medicina Veterinária",
  "06": "Cuidados Pessoais e Estética",
  "07": "Engenharia e Construção Civil",
  "08": "Educação e Treinamentos",
  "09": "Hospedagem e Turismo",
  "10": "Agenciamento e Intermediação",
  "11": "Guarda, Vigilância e Armazenamento",
  "12": "Lazer e Entretenimento",
  "13": "Fotografia e Fonografia",
  "14": "Manutenção e Assistência Técnica",
  "15": "Serviços Financeiros",
  "16": "Transporte de Natureza Municipal",
  "17": "Apoio Técnico, Administrativo e Comercial",
  "18": "Seguros e Regulação de Sinistros",
  "19": "Distribuição de Apostas e Loterias",
  "20": "Portos, Aeroportos e Terminais",
  "21": "Serviços Cartoriais e Registros",
  "22": "Exploração de Rodovias",
  "23": "Programação Visual e Desenho Industrial",
  "24": "Chaveiros, Carimbos e Placas",
  "25": "Serviços Funerários",
  "26": "Coleta e Entrega de Encomendas",
  "27": "Assistência Social",
  "28": "Avaliação de Bens",
  "29": "Biblioteconomia",
  "30": "Biologia, Biotecnologia e Química",
  "31": "Serviços Técnicos Industriais",
  "32": "Desenhos Técnicos",
  "33": "Desembaraço Aduaneiro e Despachantes",
  "34": "Investigações Particulares",
  "35": "Jornalismo, Reportagem e Imprensa",
  "36": "Meteorologia",
  "37": "Artistas, Atletas e Modelos",
  "38": "Museologia",
  "39": "Ourivesaria e Lapidação",
  "40": "Obras de Arte e Restauração",
};

// ── Mapa 1: NBS (9 dígitos numéricos) → itemLC116
export const nbsLookupMap = new Map<string, string>();
export const nbsDescricaoMap = new Map<string, string>();

// ── Mapa 2: itemLC116 sem zeros à esquerda (ex: "101") → itemLC116
export const lc116LookupMap = new Map<string, string>();
export const lc116DescricaoMap = new Map<string, string>();

// ── Mapa 3: cClassTrib (6 dígitos, campo cTribNac do Padrão Nacional) → grupo LC116
export const cClassTribLookupMap = new Map<string, string>();
export const cClassTribDescricaoMap = new Map<string, string>();

/**
 * Formata a descrição longa e formal de um subitem em um nome curto e elegante para categorias.
 */
export function obterNomeCategoriaDeSubitem(desc: string): string {
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
  const limitadores = [";", "(", " - "];
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

  // Remove preposições ou conjunções pendentes no final do texto truncado
  const stopWords = ["de", "do", "da", "em", "para", "com", "ou", "e", "que", "se", "ao", "a"];
  let words = text.split(" ");
  while (words.length > 0 && stopWords.includes(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.join(" ");
}

// Inicializa os mapas dinamicamente com os 200 subitens do nbs_mapping
nbsMapping.forEach((item: any) => {
  if (item.itemLC116 && item.descricaoLC116) {
    const cleanName = obterNomeCategoriaDeSubitem(item.descricaoLC116);
    if (cleanName) {
      if (!lc116CategoriasMap[item.itemLC116]) {
        lc116CategoriasMap[item.itemLC116] = cleanName;
      }
      if (!lc116SubItemCategoriasMap[item.itemLC116]) {
        lc116SubItemCategoriasMap[item.itemLC116] = cleanName;
      }

      const parentGroupCode = item.itemLC116.split(".")[0].padStart(2, "0");
      const parentGroupName = lc116CategoriasMap[parentGroupCode];
      if (parentGroupName) {
        categoriaParaGrupoSinteticoMap.set(cleanName.toLowerCase(), parentGroupName);
      }
    }
  }

  const cleanNbs = String(item.nbs || "").replace(/\D/g, "");
  const cleanLc116 = String(item.itemLC116 || "").replace(/\D/g, "").replace(/^0+/, "");

  if (cleanNbs && !nbsLookupMap.has(cleanNbs)) {
    nbsLookupMap.set(cleanNbs, item.itemLC116);
  }
  if (cleanNbs && !nbsDescricaoMap.has(cleanNbs)) {
    nbsDescricaoMap.set(cleanNbs, item.descricaoNbs || item.descricaoLC116 || "");
  }

  if (cleanLc116 && !lc116LookupMap.has(cleanLc116)) {
    lc116LookupMap.set(cleanLc116, item.itemLC116);
  }
  if (cleanLc116 && !lc116DescricaoMap.has(cleanLc116)) {
    lc116DescricaoMap.set(cleanLc116, item.descricaoLC116 || "");
  }

  const cClassTrib = String(item.cClassTrib || "");
  const parts = cClassTrib.match(/\d{6}/g) ?? [];
  for (const part of parts) {
    if (!cClassTribLookupMap.has(part)) {
      cClassTribLookupMap.set(part, item.itemLC116);
    }
    if (!cClassTribDescricaoMap.has(part)) {
      cClassTribDescricaoMap.set(part, item.descricaoLC116 || "");
    }
  }
});

// Mapeia os 40 nomes de grupos macro originais para si mesmos no mapa sintético
Object.values(lc116CategoriasMap).forEach((groupName) => {
  categoriaParaGrupoSinteticoMap.set(groupName.toLowerCase(), groupName);
});

// Função para obter o grupo sintético correspondente a uma categoria (oficial ou personalizada)
export function obterGrupoSintetico(categoria: string, customCategories?: Array<{ nome: string; grupoSintetico?: string }>): string {
  if (!categoria) return "Sem categoria";
  const key = categoria.trim().toLowerCase();

  if (categoriaParaGrupoSinteticoMap.has(key)) {
    return categoriaParaGrupoSinteticoMap.get(key)!;
  }

  if (customCategories) {
    const matched = customCategories.find((c) => c.nome.toLowerCase() === key);
    if (matched && matched.grupoSintetico) {
      return matched.grupoSintetico;
    }
  }

  return "Serviços Diversos";
}

export function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getServicoDescricao(codTrib: string): string {
  const code = String(codTrib).trim();
  if (!code) return "Sem descrição";

  if (code === "042201" || code === "42201") return "Planos de Saúde";
  if (code === "040301" || code === "40301" || code === "043301" || code === "43301") return "Serviços Hospitalares";

  const clean = code.replace(/\D/g, "");

  // 1. cTribNac do Padrão Nacional (6 dígitos exatos)
  if (clean.length === 6) {
    const desc = cClassTribDescricaoMap.get(clean);
    if (desc) return desc;
  }

  // 2. NBS (9 ou mais dígitos)
  if (clean.length >= 9) {
    const desc = nbsDescricaoMap.get(clean);
    if (desc) return desc;
  }

  // 3. itemLC116 direto (2–4 dígitos)
  if (clean.length >= 2 && clean.length <= 4) {
    const normalized = clean.replace(/^0+/, "");
    const desc = lc116DescricaoMap.get(normalized);
    if (desc) return desc;
  }

  // 4. Fallback heurístico para códigos estendidos/municipais (5–8 dígitos)
  if (clean.length >= 5 && clean.length <= 8) {
    const firstFour = clean.slice(0, 4).replace(/^0+/, "");
    let desc = lc116DescricaoMap.get(firstFour);
    if (desc) return desc;

    const firstThree = clean.slice(0, 3).replace(/^0+/, "");
    desc = lc116DescricaoMap.get(firstThree);
    if (desc) return desc;
  }

  return `Outros (${code})`;
}

export function obterCategoriaPorCodigo(code: string): string | null {
  const clean = String(code).trim().replace(/\D/g, "");
  if (!clean) return null;

  let itemGroup = "";

  if (clean.length === 6) {
    const group = cClassTribLookupMap.get(clean);
    if (group) itemGroup = group;
  }

  if (!itemGroup && clean.length >= 9) {
    const matched = nbsLookupMap.get(clean);
    if (matched) itemGroup = matched;
  }

  if (!itemGroup && clean.length >= 2 && clean.length <= 4) {
    const normalized = clean.replace(/^0+/, "");
    const matched = lc116LookupMap.get(normalized);
    if (matched) itemGroup = matched;
  }

  if (!itemGroup) {
    if (clean.length >= 5 && clean.length <= 8) {
      const firstTwo = clean.slice(0, 2);
      const val = parseInt(firstTwo, 10);
      if (val >= 1 && val <= 100) {
        itemGroup = firstTwo.padStart(2, "0");
      } else {
        itemGroup = "0" + clean.slice(0, 1);
      }
    }
  }

  if (itemGroup && lc116CategoriasMap[itemGroup]) {
    return lc116CategoriasMap[itemGroup];
  }

  return null;
}

export function obterCategoriaPorDescricao(desc: string): string {
  const s = normalizeString(desc || "").toLowerCase();
  if (!s) return "";

  const rules: Array<[string, string[]]> = [
    ["Informática e TI", ["software", "sistema", "informatica", "informático", "licenca", "licença", "hospedagem", "cloud", "saas", "paas", "iaas", "suporte tecnico", "internet", "telecom", "fibra optica", "data center", "servidor", "rede", "ti ", "tecnologia da informacao", "processamento de dados", "banco de dados", "programacao", "programação", "desenvolvimento de aplicativo", "desenvolvimento de sistema"]],
    ["Pesquisa e Desenvolvimento", ["pesquisa", "desenvolvimento cientifico", "p&d", "p & d", "inovacao", "inovação", "laboratorio de pesquisa"]],
    ["Locação e Cessão de Direito", ["locacao", "locação", "aluguel", "leasing", "arrendamento", "cessao de direito", "cessão de direito", "sublocacao", "direito de uso"]],
    ["Saúde e Assistência Médica", ["hospital", "médico", "medico", "clínica", "clinica", "laboratorial", "exame", "enfermagem", "fisioterapia", "fonoaudiologia", "saude", "saúde", "radiologia", "tomografia", "quimioterapia", "radioterapia", "odontolog", "cirurgia", "ortopedia", "psiquiatria", "psicologia", "nutrição", "nutricao", "ambulatorio", "plano de saude", "convenio medico"]],
    ["Medicina Veterinária", ["veterinaria", "veterinário", "veterinária", "animal", "pet shop", "banho e tosa", "zootecnia"]],
    ["Cuidados Pessoais e Estética", ["estetica", "estética", "salão", "salao", "cabeleireiro", "manicure", "pedicure", "spa", "massagem", "barbearia", "beleza"]],
    ["Engenharia e Construção Civil", ["engenharia", "construção", "construcao", "obra", "reforma", "arquitetura", "topografia", "instalacao", "instalação", "limpeza", "conservacao", "higienizacao", "jardinagem", "pintura", "hidraulica", "elétrica", "eletrica", "dedetizacao", "saneamento", "pavimentacao", "terraplanagem", "fundacao"]],
    ["Treinamento e Educação", ["treinamento", "curso", "capacitacao", "capacitação", "ensino", "educacao", "educação", "palestra", "escola", "faculdade", "universidade", "aula", "tutorial", "formacao", "formação", "workshop", "seminario"]],
    ["Hospedagem e Turismo", ["hotel", "hospedagem", "hostel", "pousada", "turismo", "viagem", "pacote turistico", "agencia de viagem", "resort", "excursao"]],
    ["Publicidade e Marketing", ["publicidade", "marketing", "propaganda", "midia", "mídia", "comunicacao", "comunicação", "veiculacao", "veiculação", "anuncio", "anúncio", "campanha", "criacao publicitaria", "impressao grafica", "grafica", "gráfica"]],
    ["Transporte e Logística", ["transporte", "frete", "logistica", "logística", "entrega", "fretamento", "motoboy", "moto boy", "correio", "malote", "mudanca", "mudança", "courier", "despacho aduaneiro", "armazenagem", "estocagem", "carga"]],
    ["Lazer e Recreação", ["lazer", "recreacao", "recreação", "esporte", "academia", "ginasio", "ginásio", "natacao", "natação", "futebol", "quadra esportiva", "parque", "divertimento", "entretenimento"]],
    ["Produção e Fonografia", ["producao audiovisual", "producao musical", "fonografia", "gravacao", "gravação", "estudio", "estúdio", "video", "vídeo", "filme", "cinema", "fotografia", "imagem", "streaming de audio", "streaming de video"]],
    ["Manutenção e Assistência Técnica", ["manutencao", "manutenção", "reparo", "conserto", "assistencia tecnica", "assistência técnica", "calibracao", "calibração"]],
    ["Serviços Financeiros", ["financeiro", "bancario", "bancário", "credito", "crédito", "cobranca", "cobrança", "seguro", "corretagem", "cambio", "câmbio", "fundo de investimento", "factoring", "leasing financeiro", "previdencia", "previdência"]],
    ["Transporte de Natureza Municipal", ["taxi", "táxi", "uber", "99", "transporte municipal", "van escolar", "transporte escolar"]],
    ["Consultoria, Assessoria e RH", ["consultoria", "assessoria", "auditoria", "conselho", "gestao", "gestão", "recursos humanos", "recrutamento", "selecao", "seleção", "headhunter", "coaching", "mentoria", "contabilidade", "contador"]],
    ["Regulação de Sinistros e Afins", ["regulacao de sinistro", "regulação de sinistro", "vistoria", "perito", "pericia", "perícia"]],
    ["Serviços de Distribuição e Venda", ["distribuicao", "distribuição", "venda", "representacao comercial", "representação comercial", "comissao de venda", "comissão de venda"]],
    ["Serviços Portuários e Aeroportuários", ["portuario", "portuário", "aeroporto", "aeroportuario", "hangar", "rampa", "terminal de carga", "estivagem"]],
    ["Serviços Jurídicos e Cartoriais", ["advocacia", "advogado", "juridico", "jurídico", "cartorio", "cartório", "tabeliao", "tabelião", "notarial", "registro civil", "escritura"]],
    ["Serviços de Auxílio a Edificações", ["impermeabilizacao", "impermeabilização", "estrutural", "vistoria de imovel", "laudo tecnico", "avaliacao de imovel"]],
    ["Eventos e Produções", ["evento", "festa", "congresso", "convencao", "convenção", "fair", "show", "espetaculo", "espetáculo", "cerimonial", "organização de evento"]],
    ["Serviços de Chaveiros e Afins", ["chaveiro", "chaveiros", "copia de chave", "cópia de chave", "seguranca patrimonial"]],
    ["Serviços Funerários", ["funeraria", "funerária", "funeral", "sepultamento", "cremacao", "cremação", "obito", "óbito", "plano funerario"]],
    ["Serviços de Coleta e Tratamento de Resíduos", ["residuo", "resíduo", "lixo", "descarte", "coleta de lixo", "incineracao", "esgoto", "tratamento de agua", "biomedico", "biomédico", "reciclagem", "saneamento ambiental"]],
    ["Serviços de Artistas e Modelos", ["artista", "modelo", "ator", "atriz", "musico", "músico", "cantor", "dançarino", "dançarina", "bailarino"]],
    ["Serviços de Desenho Industrial", ["design industrial", "desenho industrial", "produto industrial", "modelagem 3d"]],
    ["Serviços de Vigilância e Segurança", ["vigilancia", "vigilância", "seguranca", "segurança", "monitoramento", "alarme", "cftv", "rastreamento veicular"]],
    ["Serviços de Transporte de Valores", ["transporte de valores", "carro forte", "malote de numerario", "escolta"]],
    ["Serviços de Instrução e Treinamento", ["instrucao", "instrução", "treinamento fisico", "personal trainer", "educacao fisica", "educação física"]],
    ["Serviços de Desenhos e Artes Visuais", ["design grafico", "design gráfico", "ilustracao", "ilustração", "arte visual", "animacao", "animação"]],
    ["Serviços de Despachantes e Afins", ["despachante", "despacho", "documentacao veicular", "documentação veicular", "transferencia de veiculo"]],
    ["Serviços de Reportagem e Assessoria de Imprensa", ["jornalismo", "reportagem", "assessoria de imprensa", "comunicacao institutional", "relacoes publicas", "relações públicas"]],
  ];

  for (const [cat, keys] of rules) {
    if (keys.some((k) => s.includes(k))) return cat;
  }

  return "";
}

export function obterCategoriaMaisProxima(desc: string, categoriasDisponiveis: string[]): string {
  const normalizedDesc = normalizeString(desc || "").toLowerCase();
  const stopWords = ["de", "do", "da", "em", "para", "com", "ou", "e", "um", "uma", "os", "as"];
  const descWords = normalizedDesc.split(/[\s,./()\-]+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  if (descWords.length === 0) return "";

  let bestCat = "";
  let maxScore = 0;

  for (const cat of categoriasDisponiveis) {
    const normalizedCat = normalizeString(cat || "").toLowerCase();
    const catWords = normalizedCat.split(/[\s,./()\-]+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !stopWords.includes(w));
    
    let score = 0;
    for (const w of descWords) {
      if (catWords.includes(w)) {
        score += 3;
      } else {
        for (const cw of catWords) {
          if (cw.includes(w) || w.includes(cw)) {
            score += 1;
          }
        }
      }
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestCat = cat;
    }
  }

  return maxScore > 0 ? bestCat : "";
}

export function categorizarServico(desc: string, code?: string, todasCategorias?: string[], overrides?: Record<string, string>): string {
  // 1. Verifica override manual primeiro
  if (code && overrides && overrides[code]) {
    return overrides[code];
  }

  // 2. Busca descrição oficial na nbs_mapping.json
  let officialDesc = "";
  if (code) {
    officialDesc = getServicoDescricao(code);
  }

  // 3. Roda correspondência de regras de palavras-chave sobre a descrição oficial da nbs_mapping
  if (officialDesc && officialDesc !== "Sem descrição" && !officialDesc.startsWith("Outros (")) {
    const cat = obterCategoriaPorDescricao(officialDesc);
    if (cat && cat !== "") return cat;

    if (todasCategorias) {
      const closest = obterCategoriaMaisProxima(officialDesc, todasCategorias);
      if (closest && closest !== "") return closest;
    }
  }

  // 4. Mapeamento clássico por faixas/códigos de serviço se descrição oficial não resolveu
  if (code) {
    const clean = String(code).trim().replace(/\D/g, "");
    if (clean.length === 6) {
      const matched = cClassTribLookupMap.get(clean);
      if (matched && lc116CategoriasMap[matched]) return lc116CategoriasMap[matched];
    }
    if (clean.length >= 9) {
      const matched = nbsLookupMap.get(clean);
      if (matched && lc116CategoriasMap[matched]) return lc116CategoriasMap[matched];
    }
    if (clean.length >= 2 && clean.length <= 4) {
      const normalized = clean.replace(/^0+/, "");
      const matched = lc116LookupMap.get(normalized);
      if (matched && lc116CategoriasMap[matched]) return lc116CategoriasMap[matched];
    }

    const cat = obterCategoriaPorCodigo(code);
    if (cat) return cat;
  }

  // 5. Fallback final na descrição livre preenchida no XML pelo prestador
  if (desc) {
    const cat = obterCategoriaPorDescricao(desc);
    if (cat && cat !== "") return cat;

    if (todasCategorias) {
      const closest = obterCategoriaMaisProxima(desc, todasCategorias);
      if (closest && closest !== "") return closest;
    }
  }

  return "";
}
