import nbsMapping from "./nbs_mapping.json";
import { type CategoryRule, type ServiceClassification } from "./db";

// Mapas de Agrupamento Sintético e Analítico
export const lc116SubItemCategoriasMap: Record<string, string> = {};
export const categoriaParaGrupoSinteticoMap = new Map<string, string>();

// Dicionários O(1) para busca rápida de itens do nbs_mapping
export const nbsItemMap = new Map<string, any>();
export const lc116ItemMap = new Map<string, any>();
export const cClassTribItemMap = new Map<string, any>();

// Cache em memória para evitar reclassificar as mesmas entradas no mesmo render loop
export const CLASSIFICACAO_CACHE = new Map<string, ServiceClassification>();

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
  if (cleanNbs && !nbsItemMap.has(cleanNbs)) {
    nbsItemMap.set(cleanNbs, item);
  }

  if (cleanLc116 && !lc116LookupMap.has(cleanLc116)) {
    lc116LookupMap.set(cleanLc116, item.itemLC116);
  }
  if (cleanLc116 && !lc116DescricaoMap.has(cleanLc116)) {
    lc116DescricaoMap.set(cleanLc116, item.descricaoLC116 || "");
  }
  if (cleanLc116 && !lc116ItemMap.has(cleanLc116)) {
    lc116ItemMap.set(cleanLc116, item);
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
    if (!cClassTribItemMap.has(part)) {
      cClassTribItemMap.set(part, item);
    }
  }
});

// Mapeia os 40 nomes de grupos macro originais para si mesmos no mapa sintético
Object.values(lc116CategoriasMap).forEach((groupName) => {
  categoriaParaGrupoSinteticoMap.set(groupName.toLowerCase(), groupName);
});

// Função para obter o grupo sintético correspondente a uma categoria (oficial ou personalizada)
export function obterGrupoSintetico(categoria: string): string {
  if (!categoria) return "Sem categoria";
  const key = categoria.trim().toLowerCase();

  if (categoriaParaGrupoSinteticoMap.has(key)) {
    return categoriaParaGrupoSinteticoMap.get(key)!;
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

export const MAPEAMENTO_PADRAO_LC116: Record<string, { executiva: string; operacional: string }> = {
  "01.01": { executiva: "Tecnologia", operacional: "Desenvolvimento de Software" },
  "01.02": { executiva: "Tecnologia", operacional: "Desenvolvimento de Software" },
  "01.03": { executiva: "Tecnologia", operacional: "Hospedagem e Cloud" },
  "01.04": { executiva: "Tecnologia", operacional: "Desenvolvimento de Software" },
  "01.05": { executiva: "Tecnologia", operacional: "Licenciamento de Software" },
  "01.06": { executiva: "Tecnologia", operacional: "Consultoria em TI" },
  "01.07": { executiva: "Tecnologia", operacional: "Suporte Técnico" },
  "01.08": { executiva: "Tecnologia", operacional: "Licenciamento de Software" },
  "01.09": { executiva: "Tecnologia", operacional: "Hospedagem e Cloud" },
  
  "02.01": { executiva: "Tecnologia", operacional: "Pesquisa e Desenvolvimento" },
  
  "03.02": { executiva: "Outros Serviços", operacional: "Cessão de Direitos" },
  "03.03": { executiva: "Outros Serviços", operacional: "Locação de Bens" },
  "03.04": { executiva: "Outros Serviços", operacional: "Locação de Bens" },
  "03.05": { executiva: "Outros Serviços", operacional: "Locação de Bens" },

  "04.01": { executiva: "Saúde", operacional: "Atendimento Clínico" },
  "04.02": { executiva: "Saúde", operacional: "Exames Laboratoriais" },
  "04.03": { executiva: "Saúde", operacional: "Serviços Hospitalares" },
  "04.04": { executiva: "Saúde", operacional: "Serviços Hospitalares" },
  "04.05": { executiva: "Saúde", operacional: "Atendimento Clínico" },
  "04.06": { executiva: "Saúde", operacional: "Serviços de Enfermagem" },
  "04.08": { executiva: "Saúde", operacional: "Exames Laboratoriais" },
  "04.10": { executiva: "Saúde", operacional: "Atendimento Clínico" },

  "05.01": { executiva: "Outros Serviços", operacional: "Medicina Veterinária" },
  "06.01": { executiva: "Outros Serviços", operacional: "Estética e Cuidados Pessoais" },

  "07.01": { executiva: "Engenharia", operacional: "Projetos Estruturais" },
  "07.02": { executiva: "Construção Civil", operacional: "Execução de Obras" },
  "07.03": { executiva: "Engenharia", operacional: "Consultoria de Engenharia" },
  "07.04": { executiva: "Construção Civil", operacional: "Execução de Obras" },
  "07.05": { executiva: "Engenharia", operacional: "Projetos Estruturais" },
  "07.06": { executiva: "Construção Civil", operacional: "Reformas" },
  "07.09": { executiva: "Administração", operacional: "Limpeza e Conservação" },
  "07.10": { executiva: "Administração", operacional: "Limpeza e Conservação" },
  "07.11": { executiva: "Administração", operacional: "Segurança e Vigilância" },

  "08.01": { executiva: "Educação", operacional: "Treinamentos e Cursos" },
  "08.02": { executiva: "Educação", operacional: "Treinamentos e Cursos" },

  "09.01": { executiva: "Outros Serviços", operacional: "Hospedagem e Viagens" },
  "10.01": { executiva: "Administração", operacional: "Intermediação de Negócios" },
  "10.02": { executiva: "Administração", operacional: "Intermediação de Negócios" },
  "10.05": { executiva: "Administração", operacional: "Intermediação de Negócios" },

  "11.01": { executiva: "Administração", operacional: "Segurança e Vigilância" },
  "11.02": { executiva: "Administração", operacional: "Segurança e Vigilância" },
  "11.04": { executiva: "Administração", operacional: "Limpeza e Conservação" },

  "12.01": { executiva: "Outros Serviços", operacional: "Lazer e Recreação" },
  "13.01": { executiva: "Outros Serviços", operacional: "Produção Audiovisual" },
  "14.01": { executiva: "Outros Serviços", operacional: "Assistência Técnica" },
  "14.02": { executiva: "Outros Serviços", operacional: "Assistência Técnica" },

  "15.01": { executiva: "Serviços Financeiros", operacional: "Operações Financeiras" },
  "15.09": { executiva: "Serviços Financeiros", operacional: "Gestão de Recursos" },

  "16.01": { executiva: "Logística", operacional: "Transporte de Passageiros" },
  "16.02": { executiva: "Logística", operacional: "Transporte de Passageiros" },

  "17.06": { executiva: "Marketing", operacional: "Propaganda e Publicidade" },
  "17.12": { executiva: "Administração", operacional: "Serviços Contábeis" },
  "17.14": { executiva: "Jurídico", operacional: "Assessoria Jurídica" },
  "17.16": { executiva: "Consultoria", operacional: "Consultoria Empresarial" },
  "17.19": { executiva: "Consultoria", operacional: "Consultoria Tributária" },
  "17.25": { executiva: "Marketing", operacional: "Propaganda e Publicidade" },

  "18.01": { executiva: "Serviços Financeiros", operacional: "Seguros e Previdência" },
  "21.01": { executiva: "Jurídico", operacional: "Serviços Notariais e Registros" },
  "26.01": { executiva: "Logística", operacional: "Transporte Rodoviário" },
};

export const MAPEAMENTO_PREFIXO_LC116: Record<string, { executiva: string; operacional: string }> = {
  "01": { executiva: "Tecnologia", operacional: "Serviços de TI" },
  "02": { executiva: "Tecnologia", operacional: "Pesquisa e Desenvolvimento" },
  "03": { executiva: "Outros Serviços", operacional: "Cessão e Locação" },
  "04": { executiva: "Saúde", operacional: "Serviços Médicos" },
  "05": { executiva: "Outros Serviços", operacional: "Medicina Veterinária" },
  "06": { executiva: "Outros Serviços", operacional: "Estética e Beleza" },
  "07": { executiva: "Construção Civil", operacional: "Serviços de Construção" },
  "08": { executiva: "Educação", operacional: "Treinamentos e Cursos" },
  "09": { executiva: "Outros Serviços", operacional: "Turismo e Hospedagem" },
  "10": { executiva: "Administração", operacional: "Intermediação de Negócios" },
  "11": { executiva: "Administração", operacional: "Segurança e Guarda" },
  "12": { executiva: "Outros Serviços", operacional: "Lazer e Recreação" },
  "13": { executiva: "Outros Serviços", operacional: "Produção Audiovisual" },
  "14": { executiva: "Outros Serviços", operacional: "Manutenção e Suporte" },
  "15": { executiva: "Serviços Financeiros", operacional: "Operações Financeiras" },
  "16": { executiva: "Logística", operacional: "Transporte de Passageiros" },
  "17": { executiva: "Administração", operacional: "Serviços de Apoio" },
  "18": { executiva: "Serviços Financeiros", operacional: "Seguros e Previdência" },
  "19": { executiva: "Outros Serviços", operacional: "Loterias e Apostas" },
  "20": { executiva: "Logística", operacional: "Serviços Portuários" },
  "21": { executiva: "Jurídico", operacional: "Serviços Notariais" },
  "22": { executiva: "Logística", operacional: "Concessão de Rodovias" },
  "23": { executiva: "Marketing", operacional: "Design e Programação Visual" },
  "24": { executiva: "Outros Serviços", operacional: "Chaveiros e Placas" },
  "25": { executiva: "Outros Serviços", operacional: "Serviços Funerários" },
  "26": { executiva: "Logística", operacional: "Serviços de Entrega" },
  "27": { executiva: "Saúde", operacional: "Assistência Social" },
  "28": { executiva: "Outros Serviços", operacional: "Avaliação de Bens" },
  "29": { executiva: "Outros Serviços", operacional: "Biblioteconomia" },
  "30": { executiva: "Tecnologia", operacional: "Biotecnologia e Química" },
  "31": { executiva: "Engenharia", operacional: "Serviços Técnicos Industriais" },
  "32": { executiva: "Engenharia", operacional: "Desenhos Técnicos" },
  "33": { executiva: "Logística", operacional: "Desembaraço Aduaneiro" },
  "34": { executiva: "Jurídico", operacional: "Investigações Particulares" },
  "35": { executiva: "Marketing", operacional: "Jornalismo e Imprensa" },
  "36": { executiva: "Outros Serviços", operacional: "Meteorologia" },
  "37": { executiva: "Outros Serviços", operacional: "Artistas e Modelos" },
  "38": { executiva: "Outros Serviços", operacional: "Museologia" },
  "39": { executiva: "Outros Serviços", operacional: "Ourivesaria e Lapidação" },
  "40": { executiva: "Outros Serviços", operacional: "Obras de Arte e Restauro" },
};

export function resolverServicoFiscal(codigo: string) {
  if (!codigo) {
    return { itemLC116: "", descricaoLC116: "Sem código", nbs: "", descricaoNbs: "" };
  }

  const clean = String(codigo).trim().replace(/\D/g, "");
  let itemLC116 = "";
  let descricaoLC116 = "";
  let nbs = "";
  let descricaoNbs = "";

  if (clean) {
    let found = nbsItemMap.get(clean);

    if (!found && clean.length === 6) {
      found = cClassTribItemMap.get(clean);
    }

    if (!found) {
      const cleanLc = clean.replace(/^0+/, "");
      found = lc116ItemMap.get(cleanLc);
    }

    if (found) {
      itemLC116 = found.itemLC116 || "";
      descricaoLC116 = found.descricaoLC116 || "";
      nbs = found.nbs || "";
      descricaoNbs = found.descricaoNbs || "";
    } else {
      if (clean.length === 6) {
        const firstTwo = clean.slice(0, 2);
        const nextTwo = clean.slice(2, 4);
        itemLC116 = `${firstTwo}.${nextTwo}`;
        descricaoLC116 = "Sem descrição oficial (Código Nacional)";
      } else if (clean.length >= 9) {
        nbs = codigo;
        descricaoNbs = "Sem descrição oficial (NBS)";
        const matchedLc = nbsLookupMap.get(clean);
        if (matchedLc) {
          itemLC116 = matchedLc;
          descricaoLC116 = lc116DescricaoMap.get(matchedLc.replace(/\D/g, "").replace(/^0+/, "")) || "";
        }
      } else {
        const parts = String(codigo).split(".");
        if (parts.length === 2) {
          itemLC116 = String(codigo);
        } else {
          const padded = clean.padStart(4, "0");
          itemLC116 = `${padded.slice(0, 2)}.${padded.slice(2, 4)}`;
        }
        const cleanLcNormalized = itemLC116.replace(/\D/g, "").replace(/^0+/, "");
        descricaoLC116 = lc116DescricaoMap.get(cleanLcNormalized) || "Sem descrição oficial";
      }
    }
  }

  return { itemLC116, descricaoLC116, nbs, descricaoNbs };
}

export function calcularJaccard(desc1: string, desc2: string): number {
  const stopWords = new Set(["de", "do", "da", "em", "para", "com", "ou", "e", "um", "uma", "os", "as", "a", "o", "ao", "se", "por", "sobre", "relativos", "servicos"]);
  const tokens1 = new Set(
    normalizeString(desc1 || "")
      .split(/[\s,./()\-]+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !stopWords.has(w))
  );
  const tokens2 = new Set(
    normalizeString(desc2 || "")
      .split(/[\s,./()\-]+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !stopWords.has(w))
  );

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      intersection++;
    }
  }

  const union = tokens1.size + tokens2.size - intersection;
  return intersection / union;
}

export function classificarServicoLocal(
  codigo: string,
  descNota: string,
  regras: CategoryRule[]
): ServiceClassification {
  const safeCode = codigo || "";
  const cleanCode = String(safeCode).trim().replace(/\D/g, "");
  const normDesc = descNota ? normalizeString(descNota) : "";

  // 0. Verifica cache em memória
  const cacheKey = `${safeCode}_${descNota}_${regras.length}`;
  if (CLASSIFICACAO_CACHE.has(cacheKey)) {
    return CLASSIFICACAO_CACHE.get(cacheKey)!;
  }

  const { itemLC116, descricaoLC116, nbs, descricaoNbs } = resolverServicoFiscal(safeCode);
  const ausenteOficial = !itemLC116 && !nbs;

  let categoriaExecutiva = "Outros Serviços";
  let grupoOperacional = "Outros Serviços";
  let origem: ServiceClassification["origem"] = "Não Classificada";
  let confianca = 50;
  let metodo = "Outros Serviços";
  let conflito = false;

  // -- Prioridade 1: Regras Personalizadas do Usuário --
  let regraAplicada = regras.find(r => r.tipo === "codigo" && String(r.chave).trim().replace(/\D/g, "") === cleanCode);
  if (!regraAplicada && itemLC116) {
    regraAplicada = regras.find(r => r.tipo === "codigo" && String(r.chave).trim() === itemLC116);
  }
  if (!regraAplicada && normDesc) {
    regraAplicada = regras.find(r => r.tipo === "descricao" && normDesc.includes(normalizeString(r.chave)));
  }

  if (regraAplicada) {
    const result: ServiceClassification = {
      codigo: safeCode,
      categoriaExecutiva: regraAplicada.categoriaExecutiva,
      grupoOperacional: regraAplicada.grupoOperacional,
      codigoLc116: itemLC116 || (cleanCode.length <= 4 ? safeCode : ""),
      descricaoLc116: descricaoLC116,
      codigoNbs: nbs || (cleanCode.length >= 9 ? safeCode : ""),
      descricaoNbs,
      origem: "Manual",
      confianca: 100,
      metodo: "Regra Manual",
      dataClassificacao: new Date().toISOString(),
      conflito: false,
      ausenteOficial,
    };
    CLASSIFICACAO_CACHE.set(cacheKey, result);
    return result;
  }

  // -- Prioridade 2: Mapeamento Oficial LC 116 + NBS --
  let mapeado = false;
  
  if (itemLC116 && MAPEAMENTO_PADRAO_LC116[itemLC116]) {
    categoriaExecutiva = MAPEAMENTO_PADRAO_LC116[itemLC116].executiva;
    grupoOperacional = MAPEAMENTO_PADRAO_LC116[itemLC116].operacional;
    origem = "Automática LC 116";
    confianca = 98;
    metodo = "LC 116/NBS";
    mapeado = true;
  }
  
  if (!mapeado && itemLC116) {
    const prefix = itemLC116.split(".")[0].padStart(2, "0");
    if (MAPEAMENTO_PREFIXO_LC116[prefix]) {
      categoriaExecutiva = MAPEAMENTO_PREFIXO_LC116[prefix].executiva;
      grupoOperacional = MAPEAMENTO_PREFIXO_LC116[prefix].operacional;
      origem = "Automática LC 116";
      confianca = 98;
      metodo = "LC 116/NBS";
      mapeado = true;
    }
  }
  
  if (!mapeado && nbs) {
    const cleanNbs = nbs.replace(/\D/g, "");
    const mappedLc = nbsLookupMap.get(cleanNbs);
    if (mappedLc && MAPEAMENTO_PADRAO_LC116[mappedLc]) {
      categoriaExecutiva = MAPEAMENTO_PADRAO_LC116[mappedLc].executiva;
      grupoOperacional = MAPEAMENTO_PADRAO_LC116[mappedLc].operacional;
      origem = "Automática NBS";
      confianca = 98;
      metodo = "LC 116/NBS";
      mapeado = true;
    }
  }

  // -- Prioridade 3: Inferência por similaridade textual --
  let inferredExecutiva = "";
  let inferredGrupo = "";
  let inferredConfidence = 0;

  if (normDesc) {
    const keywordsRules = [
      {
        executiva: "Saúde",
        grupos: [
          { nome: "Serviços Hospitalares", keywords: ["hospital", "clinica", "sanatorio", "pronto socorro", "leito", "samel", "sus", "cirurg", "internacao"] },
          { nome: "Exames Laboratoriais", keywords: ["exame", "laboratorio", "analise clinica", "imagem", "radiologia", "sangue", "urina", "patologia", "ressonancia", "tomografia", "ultrasson", "raio x"] },
          { nome: "Atendimento Clínico", keywords: ["consulta", "medico", "enfermagem", "fisioterapia", "odontolog", "psicolog", "nutric"] }
        ]
      },
      {
        executiva: "Tecnologia",
        grupos: [
          { nome: "Desenvolvimento de Software", keywords: ["desenvolvimento", "software", "sistema", "programacao", "programador", "aplicativo", "app", "customizacao", "api", "codigo fonte"] },
          { nome: "Hospedagem e Cloud", keywords: ["cloud", "hospedagem", "aws", "azure", "servidor", "saas", "banco de dados", "backup", "datacenter", "hospedar"] },
          { nome: "Licenciamento de Software", keywords: ["licenca", "licenciamento", "direito de uso", "cessao de uso", "subscricao"] },
          { nome: "Suporte Técnico", keywords: ["suporte tecnico", "suporte de ti", "manutencao de ti", "helpdesk", "chamado"] }
        ]
      },
      {
        executiva: "Consultoria",
        grupos: [
          { nome: "Consultoria Tributária", keywords: ["tributo", "fiscal", "tributaria", "imposto", "revisao fiscal", "planejamento tributario", "icms", "iss"] },
          { nome: "Consultoria Empresarial", keywords: ["consultoria", "assessoria", "gestao", "auditoria", "rh", "processos", "estrategia", "treinamento", "mentoria"] }
        ]
      },
      {
        executiva: "Educação",
        grupos: [
          { nome: "Treinamentos e Cursos", keywords: ["treinamento", "curso", "escola", "palestra", "aula", "workshop", "ensino", "capacitacao", "ead"] }
        ]
      },
      {
        executiva: "Engenharia",
        grupos: [
          { nome: "Projetos Estruturais", keywords: ["projeto estrutural", "projeto", "calculo estrutural", "fundacoes", "concreto", "arquitetura", "planta", "topografia"] }
        ]
      },
      {
        executiva: "Jurídico",
        grupos: [
          { nome: "Assessoria Jurídica", keywords: ["juridico", "advogado", "advocacia", "processo judicial", "contrato", "legal", "parecer", "defesa"] }
        ]
      },
      {
        executiva: "Construção Civil",
        grupos: [
          { nome: "Execução de Obras", keywords: ["obra", "construcao", "reforma", "alvenaria", "pintura", "eletrica", "hidraulica", "instalacao", "pedreiro", "azulejo", "telhado"] }
        ]
      },
      {
        executiva: "Serviços Financeiros",
        grupos: [
          { nome: "Operações Financeiras", keywords: ["financeiro", "banco", "credito", "cobranca", "seguro", "investimento", "leasing", "cambio", "factoring"] }
        ]
      },
      {
        executiva: "Marketing",
        grupos: [
          { nome: "Propaganda e Publicidade", keywords: ["propaganda", "publicidade", "marketing", "anuncio", "mídia", "divulgacao", "google ads", "facebook ads", "panfleto", "banner"] }
        ]
      },
      {
        executiva: "Logística",
        grupos: [
          { nome: "Transporte Rodoviário", keywords: ["rodoviario", "frete", "carga", "transporte de carga", "entrega", "logistica", "transportadora", "caminhao"] }
        ]
      },
      {
        executiva: "Administração",
        grupos: [
          { nome: "Serviços Contábeis", keywords: ["contabilidade", "contador", "contabil", "balanco", "escrituracao"] },
          { nome: "Limpeza e Conservação", keywords: ["limpeza", "conservacao", "faxina", "jardinagem", "zeladoria", "portaria", "vigia"] },
          { nome: "Serviços de Apoio", keywords: ["auxilio", "apoio", "digitacao", "atendimento", "secretaria", "recepcao"] }
        ]
      }
    ];

    let bestScore = 0;
    for (const catRule of keywordsRules) {
      for (const gr of catRule.grupos) {
        let matches = 0;
        for (const kw of gr.keywords) {
          if (normDesc.includes(kw)) {
            matches++;
          }
        }
        if (matches > 0) {
          const score = matches * 10;
          if (score > bestScore) {
            bestScore = score;
            inferredExecutiva = catRule.executiva;
            inferredGrupo = gr.nome;
            inferredConfidence = 85;
          }
        }
      }
    }

    // Só rodamos Jaccard (O(N)) se o código NÃO foi mapeado oficialmente, reduzindo drastically o processamento
    if (!inferredExecutiva && !mapeado) {
      let bestJaccard = 0;
      let matchedItem: any = null;

      for (const item of nbsMapping) {
        const descOficial = item.descricaoNbs || item.descricaoLC116 || "";
        if (descOficial) {
          const jc = calcularJaccard(descNota, descOficial);
          if (jc > bestJaccard) {
            bestJaccard = jc;
            matchedItem = item;
          }
        }
      }

      if (bestJaccard > 0.15 && matchedItem) {
        const matchedLc = matchedItem.itemLC116;
        if (matchedLc && MAPEAMENTO_PADRAO_LC116[matchedLc]) {
          inferredExecutiva = MAPEAMENTO_PADRAO_LC116[matchedLc].executiva;
          inferredGrupo = MAPEAMENTO_PADRAO_LC116[matchedLc].operacional;
        } else {
          const prefix = String(matchedLc || "").split(".")[0].padStart(2, "0");
          if (MAPEAMENTO_PREFIXO_LC116[prefix]) {
            inferredExecutiva = MAPEAMENTO_PREFIXO_LC116[prefix].executiva;
            inferredGrupo = MAPEAMENTO_PREFIXO_LC116[prefix].operacional;
          }
        }
        inferredConfidence = 85;
      }
    }
  }

  if (!mapeado && inferredExecutiva) {
    categoriaExecutiva = inferredExecutiva;
    grupoOperacional = inferredGrupo || inferredExecutiva;
    origem = "Similaridade";
    confianca = inferredConfidence || 85;
    metodo = "Similaridade Textual";
  }

  if (mapeado && inferredExecutiva && inferredExecutiva !== categoriaExecutiva) {
    conflito = true;
  }

  if (itemLC116 && nbs) {
    const cleanNbs = nbs.replace(/\D/g, "");
    const mappedLc = nbsLookupMap.get(cleanNbs);
    if (mappedLc && mappedLc !== itemLC116) {
      const catLc = MAPEAMENTO_PADRAO_LC116[itemLC116]?.executiva;
      const catNbs = MAPEAMENTO_PADRAO_LC116[mappedLc]?.executiva;
      if (catLc && catNbs && catLc !== catNbs) {
        conflito = true;
      }
    }
  }

  const result: ServiceClassification = {
    codigo: safeCode,
    categoriaExecutiva,
    grupoOperacional,
    codigoLc116: itemLC116 || (cleanCode.length <= 4 ? safeCode : ""),
    descricaoLc116: descricaoLC116,
    codigoNbs: nbs || (cleanCode.length >= 9 ? safeCode : ""),
    descricaoNbs,
    origem,
    confianca,
    metodo,
    dataClassificacao: new Date().toISOString(),
    conflito,
    ausenteOficial,
  };

  CLASSIFICACAO_CACHE.set(cacheKey, result);
  return result;
}

export function categorizarServico(desc: string, code?: string, todasCategorias?: string[]): string {
  if (!code) return "";
  const result = classificarServicoLocal(code, desc, []);
  return result.categoriaExecutiva || "Outros Serviços";
}
