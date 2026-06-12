import { useMemo } from "react";
import { IDataRepository } from "@/lib/data-access/DataRepository";
import { LocalDexieRepository } from "@/lib/data-access/LocalDexieRepository";

// Futuramente, podemos adicionar:
// import { CloudSupabaseRepository } from "@/lib/data-access/CloudSupabaseRepository";
// import { useAuth } from "@/hooks/useAuth";

const localRepo = new LocalDexieRepository();

export function useRepository(): IDataRepository {
  // Exemplo de como a troca Local/Nuvem funcionará na Fase 3:
  // const { isAuthenticated } = useAuth();
  // const cloudRepo = useMemo(() => new CloudSupabaseRepository(), []);
  
  // return isAuthenticated ? cloudRepo : localRepo;
  
  return localRepo;
}
