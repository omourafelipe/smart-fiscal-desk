import { MappingEntry } from './types';

// Map: LC116 Code string -> MappingEntry
export const lc116Mapping: Record<string, MappingEntry> = {
  '1.01': {
    categoria: 'Tecnologia',
    grupo: 'Serviços de TI',
    subgrupo: 'Análise e Desenvolvimento',
  },
  '1.02': {
    categoria: 'Tecnologia',
    grupo: 'Serviços de TI',
    subgrupo: 'Processamento de Dados',
  },
  '14.01': {
    categoria: 'Manutenção',
    grupo: 'Equipamentos',
    subgrupo: 'Assistência Técnica',
  },
  '4.01': {
    categoria: 'Saúde',
    grupo: 'Serviços Médicos',
    subgrupo: 'Consultas',
  },
  '4.02': {
    categoria: 'Saúde',
    grupo: 'Serviços Médicos',
    subgrupo: 'Exames',
  }
  // Adicione outros mapeamentos conforme necessário
};
