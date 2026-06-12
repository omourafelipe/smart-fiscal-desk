export class CategoryLabelService {
  /**
   * Converte um código tributário/LC116 em um nome amigável para exibição em dashboards e KPIs.
   * Remove o prefixo numérico para garantir um visual consolidado e amigável.
   * Ex: "04.03 - Hospitais..." vira "Serviços Hospitalares".
   */
  static getFriendlyName(codTrib: string | undefined | null): string {
    const code = String(codTrib || "").trim();
    if (!code) return "Outros / Não Especificado";

    const clean = code.replace(/\D/g, "");
    
    // Categorias de Plano de Saúde (Geralmente 4.22 ou similar)
    if (clean.startsWith("422") || clean.startsWith("0422")) {
      return "Plano de Saúde";
    }
    
    // Categorias de Serviços Hospitalares / Clínicas (4.23, 4.03, 4.33, etc.)
    if (
      clean.startsWith("423") || clean.startsWith("0423") ||
      clean.startsWith("403") || clean.startsWith("0403") ||
      clean.startsWith("433") || clean.startsWith("0433") ||
      clean.startsWith("0401") || clean.startsWith("401")
    ) {
      return "Serviços Médicos e Hospitalares";
    }

    // Processamento de dados / TI (1.05, 1.07, etc.)
    if (clean.startsWith("105") || clean.startsWith("0105") || clean.startsWith("107") || clean.startsWith("0107")) {
      return "Tecnologia da Informação";
    }

    // Se houver um texto descritivo misturado com o código (ex: "14.01 - Lubrificação..."), tentaremos pegar o texto
    const parts = code.split("-");
    if (parts.length > 1) {
      const desc = parts.slice(1).join("-").trim();
      if (desc.length > 3) {
        // Retorna o texto capitalizado adequadamente
        return desc.charAt(0).toUpperCase() + desc.slice(1).toLowerCase();
      }
    }

    return "Outros Serviços";
  }
}
