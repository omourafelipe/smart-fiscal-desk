import { ClassifyServiceRequest, ClassifyServiceResponse, ClassificationFeedback } from "./types";

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
 * Classifica automaticamente um serviço baseado em sua descrição textual.
 * 
 * // TODO: substituir por chamada real ao endpoint '/api/fiscal/classify'
 * // Integração futura:
 * // const { data, error } = await supabase.functions.invoke('classify-service', { body: req });
 * // if (error) throw error;
 * // return data as ClassifyServiceResponse;
 */
export async function classifyService(req: ClassifyServiceRequest): Promise<ClassifyServiceResponse> {
  await delay(300, 800);

  if (shouldFail(0.1)) {
    throw new Error("Erro de conexão ao motor de classificação. Tente novamente.");
  }

  const desc = req.descricao_servico.toLowerCase();

  // Regras de classificação heurística baseadas em palavras-chave para simulação realista
  if (desc.includes("software") || desc.includes("desenvolvimento") || desc.includes("ti") || desc.includes("programacao") || desc.includes("cloud") || desc.includes("nuvem") || desc.includes("licenca")) {
    return {
      categoria: "Tecnologia",
      grupo: "Serviços Digitais",
      centro_receita: "TI & Infraestrutura",
      subcategoria: "Desenvolvimento de Software",
      nivel_confianca: "Muito Alta",
      score_confianca: 0.96,
    };
  }

  if (desc.includes("saude") || desc.includes("medico") || desc.includes("plano") || desc.includes("clinica") || desc.includes("hospital") || desc.includes("odontologico")) {
    return {
      categoria: "Benefícios",
      grupo: "Saúde Suplementar",
      centro_receita: "Recursos Humanos",
      subcategoria: "Plano de Saúde",
      nivel_confianca: "Alta",
      score_confianca: 0.89,
    };
  }

  if (desc.includes("consultoria") || desc.includes("assessoria") || desc.includes("auditoria") || desc.includes("estudo") || desc.includes("pesquisa")) {
    return {
      categoria: "Serviços Profissionais",
      grupo: "Consultoria & Projetos",
      centro_receita: "Diretoria Financeira",
      subcategoria: "Consultoria Estratégica",
      nivel_confianca: "Média",
      score_confianca: 0.74,
    };
  }

  if (desc.includes("aluguel") || desc.includes("locacao") || desc.includes("predio") || desc.includes("sala") || desc.includes("escritorio") || desc.includes("condominio")) {
    return {
      categoria: "Instalações",
      grupo: "Opex Imobiliário",
      centro_receita: "Administrativo",
      subcategoria: "Locação de Imóveis",
      nivel_confianca: "Muito Alta",
      score_confianca: 0.98,
    };
  }

  if (desc.includes("limpeza") || desc.includes("conservacao") || desc.includes("seguranca") || desc.includes("portaria") || desc.includes("vigilancia")) {
    return {
      categoria: "Serviços Gerais",
      grupo: "Facilities",
      centro_receita: "Operações",
      subcategoria: "Limpeza e Conservação",
      nivel_confianca: "Alta",
      score_confianca: 0.85,
    };
  }

  if (desc.includes("marketing") || desc.includes("publicidade") || desc.includes("propaganda") || desc.includes("anuncio") || desc.includes("midia")) {
    return {
      categoria: "Comercial & Marketing",
      grupo: "Divulgação",
      centro_receita: "Vendas",
      subcategoria: "Campanhas Digitais",
      nivel_confianca: "Alta",
      score_confianca: 0.82,
    };
  }

  // Fallback padrão se não houver match
  return {
    categoria: "Outros Serviços",
    grupo: "Diversos",
    centro_receita: "Geral",
    subcategoria: "Serviços Administrativos",
    nivel_confianca: "Baixa",
    score_confianca: 0.42,
  };
}

/**
 * Envia o feedback (aprovação ou ajuste manual) para treinamento ou auditoria do modelo.
 * 
 * // TODO: substituir por chamada real ao endpoint '/api/fiscal/feedback'
 * // Integração futura:
 * // const { error } = await supabase.from('classification_feedback').insert(feedback);
 * // if (error) throw error;
 */
export async function submitFeedback(feedback: ClassificationFeedback): Promise<void> {
  await delay(300, 800);

  if (shouldFail(0.1)) {
    throw new Error("Erro de conexão ao salvar feedback de classificação.");
  }

  console.log("[ClassificationService] Feedback registrado:", feedback);
}
