import { MappingEntry } from './types';

// Map: Service Type string -> MappingEntry
// Normalizing to lowercase for comparison is recommended in the engine.
export const serviceTypeMapping: Record<string, MappingEntry> = {
  'consultoria em ti': {
    categoria: 'Tecnologia',
    grupo: 'Serviços de TI',
    subgrupo: 'Consultoria',
  },
  'desenvolvimento de software': {
    categoria: 'Tecnologia',
    grupo: 'Serviços de TI',
    subgrupo: 'Desenvolvimento',
  },
  'manutenção de equipamentos': {
    categoria: 'Manutenção',
    grupo: 'Equipamentos',
    subgrupo: 'Geral',
  },
  // Adicione outros mapeamentos conforme necessário
};
