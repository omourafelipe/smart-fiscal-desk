import { MappingEntry } from './types';

// Map: Keyword (lowercase) -> MappingEntry
// A engine buscará essas palavras-chave na descrição.
export const keywordMapping: Record<string, MappingEntry> = {
  'plano': {
    categoria: 'Saúde',
    grupo: 'Planos de Saúde',
    subgrupo: 'Geral',
  },
  'consulta': {
    categoria: 'Saúde',
    grupo: 'Serviços Médicos',
    subgrupo: 'Consultas',
  },
  'internação': {
    categoria: 'Saúde',
    grupo: 'Serviços Médicos',
    subgrupo: 'Internações',
  },
  'cirurgia': {
    categoria: 'Saúde',
    grupo: 'Serviços Médicos',
    subgrupo: 'Cirurgias',
  },
  'exame': {
    categoria: 'Saúde',
    grupo: 'Serviços Médicos',
    subgrupo: 'Exames',
  },
  'laboratório': {
    categoria: 'Saúde',
    grupo: 'Serviços Médicos',
    subgrupo: 'Laboratório',
  },
  'imagem': {
    categoria: 'Saúde',
    grupo: 'Serviços Médicos',
    subgrupo: 'Diagnóstico por Imagem',
  },
  'software': {
    categoria: 'Tecnologia',
    grupo: 'Serviços de TI',
    subgrupo: 'Desenvolvimento',
  },
  'advocacia': {
    categoria: 'Jurídico',
    grupo: 'Serviços Advocatícios',
    subgrupo: 'Consultoria',
  },
  'jurídico': {
    categoria: 'Jurídico',
    grupo: 'Serviços Advocatícios',
    subgrupo: 'Consultoria',
  }
  // Adicione outros mapeamentos conforme necessário
};
