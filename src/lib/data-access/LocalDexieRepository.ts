import { IDataRepository, DashboardMetrics } from "./DataRepository";
import { db, type NotaFiscal, type NotaFiscalTomada, type CustomCategory } from "@/lib/db";

export class LocalDexieRepository implements IDataRepository {
  async init(): Promise<void> {
    // Dexie initializes automatically, but we can put migrations here if needed
    console.log("LocalDexieRepository initialized.");
  }

  async getAllNotas(): Promise<NotaFiscal[]> {
    return await db.notas.toArray();
  }

  async getNotasAtivas(filtros?: any): Promise<NotaFiscal[]> {
    const todas = await this.getAllNotas();
    return todas.filter(n => n.status === "válida" || !n.status);
  }

  async importNotas(notas: NotaFiscal[]): Promise<void> {
    await db.notas.bulkPut(notas);
  }

  async getAllNotasTomadas(): Promise<NotaFiscalTomada[]> {
    return await db.notasTomadas.toArray();
  }

  async importNotasTomadas(notas: NotaFiscalTomada[]): Promise<void> {
    await db.notasTomadas.bulkPut(notas);
  }

  async getCustomCategories(): Promise<CustomCategory[]> {
    return await db.customCategories.toArray();
  }

  async saveCustomCategory(cat: CustomCategory): Promise<void> {
    await db.customCategories.put(cat);
  }

  async getDashboardMetrics(filtros: any): Promise<DashboardMetrics> {
    const notasAtivas = await this.getNotasAtivas();
    // Filtros de memoização ainda acontecem no frontend por agora,
    // mas se precisarmos de performance, podemos fazer a query Dexie aqui.
    const totalFaturamento = notasAtivas.reduce((acc, n) => acc + n.valor, 0);
    return {
      totalFaturamento,
      totalNotas: notasAtivas.length
    };
  }
}
