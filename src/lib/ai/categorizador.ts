import { createServerFn } from "@tanstack/react-start";

export interface AICategorizationResult {
  categoriaExecutiva: string;
  grupoOperacional: string;
  codigoLc116: string;
}

export const categorizarPorIa = createServerFn({ method: "POST" })
  .validator((data: { description: string; topCategories: string[]; userApiKey?: string }) => data)
  .handler(async ({ data: { description, topCategories, userApiKey } }) => {
    const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Anthropic API Key não configurada. Defina ANTHROPIC_API_KEY no arquivo .env ou configure nas configurações.");
    }

    const systemPrompt = `Você é um assistente especialista em classificação fiscal e contabilidade de serviços para empresas brasileiras.
Sua tarefa é analisar a descrição de um serviço (extraído de uma nota fiscal NFS-e) e classificar nas seguintes estruturas:
1. Categoria Executiva (Nível 1)
2. Grupo Operacional (Nível 2)
3. Código LC 116 (Nível 3 - no formato de subitem como "1.01", "17.05", "10.02", etc.)

As Categorias Executivas sugeridas devem, de preferência, se alinhar com as mais utilizadas na empresa:
${topCategories.map((cat, idx) => `${idx + 1}. ${cat}`).join("\n")}

Outras Categorias Executivas padrões do sistema que podem ser usadas:
- Saúde
- Tecnologia
- Educação
- Consultoria
- Engenharia
- Jurídico
- Construção Civil
- Serviços Financeiros
- Marketing
- Logística
- Administração
- Outros Serviços

Você DEVE responder APENAS com um objeto JSON válido contendo exatamente as seguintes chaves, sem explicações, comentários ou markdown:
{
  "categoriaExecutiva": "Nome da Categoria Executiva sugerida",
  "grupoOperacional": "Nome do Grupo Operacional sugerido",
  "codigoLc116": "Código LC 116 sugerido (ex: 1.01)"
}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Classifique este serviço: "${description}"`
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro da API da Anthropic:", errorText);
        throw new Error(`Anthropic API retornou status ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      let text = responseData.content?.[0]?.text?.trim() || "";

      // Limpa possível formatação de código do markdown do JSON retornado pelo modelo
      if (text.startsWith("```")) {
        text = text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed: AICategorizationResult = JSON.parse(text);
      return parsed;
    } catch (error: any) {
      console.error("Falha ao categorizar via Anthropic:", error);
      throw new Error(error?.message || "Erro desconhecido na chamada de IA.");
    }
  });

export const perguntarAoAssistente = createServerFn({ method: "POST" })
  .validator((data: { 
    message: string; 
    history: { role: "user" | "assistant"; content: string }[]; 
    contextSummary: string; 
    userApiKey?: string; 
  }) => data)
  .handler(async ({ data: { message, history, contextSummary, userApiKey } }) => {
    const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Anthropic API Key não configurada. Defina ANTHROPIC_API_KEY no arquivo .env.");
    }

    const systemPrompt = `Você é um assistente financeiro e contábil fiscal inteligente do Smart Fiscal Desk.
Seu objetivo é ajudar a diretoria e a equipe financeira a analisar o faturamento, despesas, impostos, retenções e fluxos de serviços prestados e tomados.

Aqui está o resumo dos dados agregados do período filtrado atual para te dar contexto. Responda as perguntas baseando-se EXCLUSIVAMENTE nestes dados reais.
Se a resposta não puder ser deduzida dos dados agregados fornecidos abaixo, informe educadamente que você não tem acesso a essas informações detalhadas na base agregada atual.

DADOS AGREGADOS:
${contextSummary}

Instruções:
- Seja profissional, direto e use o idioma português do Brasil.
- Ao citar valores monetários, formate no padrão contábil brasileiro (R$ 1.234,56).
- Evite expor dados brutos técnicos do JSON; responda de maneira executiva e resumida.
- Nunca invente dados que não estejam presentes no contexto acima.`;

    const messages = history.map(h => ({
      role: h.role === "user" ? ("user" as const) : ("assistant" as const),
      content: h.content
    }));
    
    // Add current user message
    messages.push({
      role: "user" as const,
      content: message
    });

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1500,
          system: systemPrompt,
          messages: messages
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro da API da Anthropic:", errorText);
        throw new Error(`Anthropic API retornou status ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      return responseData.content?.[0]?.text || "Desculpe, não consegui obter uma resposta.";
    } catch (error: any) {
      console.error("Falha no assistente fiscal via Anthropic:", error);
      throw new Error(error?.message || "Erro ao consultar o assistente fiscal.");
    }
  });
