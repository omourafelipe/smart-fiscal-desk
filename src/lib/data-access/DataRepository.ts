import { type NotaFiscal, type NotaFiscalTomada, type CustomCategory, type ServiceClassification } from "@/lib/db";

export interface DashboardMetrics {
  totalFaturamento: number;
  totalNotas: number;
}

export interface IDataRepository {
  // Inicialização / Sincronização
  init(): Promise<void>;
  
  // Notas Fiscais Emitidas
  getNotasAtivas(filtros?: any): Promise<NotaFiscal[]>;
  getAllNotas(): Promise<NotaFiscal[]>;
  importNotas(notas: NotaFiscal[]): Promise<void>;
  
  // Notas Fiscais Tomadas
  getAllNotasTomadas(): Promise<NotaFiscalTomada[]>;
  importNotasTomadas(notas: NotaFiscalTomada[]): Promise<void>;

  // Categorias e Configurações
  getCustomCategories(): Promise<CustomCategory[]>;
  saveCustomCategory(cat: CustomCategory): Promise<void>;

  // Dashboard Aggregations (Pode ser otimizado no servidor no futuro)
  getDashboardMetrics(filtros: any): Promise<DashboardMetrics>;
}
