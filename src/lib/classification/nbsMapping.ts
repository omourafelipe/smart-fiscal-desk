import { MappingEntry } from './types';

// Map: NBS Code string -> MappingEntry
export const nbsMapping: Record<string, MappingEntry> = {
  '1.0123': {
    categoria: 'Tecnologia',
    grupo: 'Serviços de TI',
    subgrupo: 'Desenvolvimento',
  },
  '4.0123': {
    categoria: 'Saúde',
    grupo: 'Serviços Médicos',
    subgrupo: 'Geral',
  }
  // Adicione outros mapeamentos conforme necessário
};
