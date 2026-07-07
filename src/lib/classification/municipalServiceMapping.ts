import { MappingEntry } from './types';

// Map: Municipal Code string -> MappingEntry
export const municipalServiceMapping: Record<string, MappingEntry> = {
  '0101': {
    categoria: 'Tecnologia',
    grupo: 'Serviços de TI',
    subgrupo: 'Análise e Desenvolvimento',
  },
  '0102': {
    categoria: 'Tecnologia',
    grupo: 'Serviços de TI',
    subgrupo: 'Processamento de Dados',
  },
  '1401': {
    categoria: 'Manutenção',
    grupo: 'Equipamentos',
    subgrupo: 'Assistência Técnica',
  },
  // Adicione outros mapeamentos conforme necessário
};
