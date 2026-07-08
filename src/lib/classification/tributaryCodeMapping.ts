import { MappingEntry } from './types';

/**
 * Mapeamento de Códigos Tributários Municipais → Categoria Sintética
 *
 * Estes são códigos no formato XXXXXX (6 dígitos) usados pelos municípios
 * para identificar o serviço. Prioridade 1 – Confiança: 100.
 *
 * Lógica de busca: normaliza removendo pontos/traços, compara exato.
 */
export const tributaryCodeMapping: Record<string, MappingEntry> = {
  // ── Plano de Saúde ──────────────────────────────────────────────
  '042201': { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',        subgrupo: 'Plano Privado' },
  '042202': { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',        subgrupo: 'Plano Empresarial' },
  '042203': { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',        subgrupo: 'Plano Familiar' },
  '042299': { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',        subgrupo: 'Outros Planos' },

  // ── Serviços Hospitalares ────────────────────────────────────────
  '040301': { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',               subgrupo: 'Internação' },
  '040302': { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',               subgrupo: 'UTI' },
  '040303': { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',               subgrupo: 'Cirurgia' },
  '040304': { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',               subgrupo: 'Pronto-Socorro' },
  '040399': { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',               subgrupo: 'Outros Hospitalares' },

  // ── Atendimento Médico ───────────────────────────────────────────
  '040101': { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Consulta Médica' },
  '040102': { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Ambulatorial' },
  '040199': { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Outros Médicos' },

  // ── Diagnóstico Laboratorial ─────────────────────────────────────
  '040501': { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',              subgrupo: 'Exames Laboratoriais' },
  '040502': { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',              subgrupo: 'Exames de Imagem' },
  '040503': { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',              subgrupo: 'Biópsia / Patologia' },
  '040599': { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',              subgrupo: 'Outros Diagnósticos' },

  // ── Consultoria ──────────────────────────────────────────────────
  '010701': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Consultoria Estratégica' },
  '010702': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Assessoria Empresarial' },
  '010703': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Auditoria' },
  '010799': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Outras Consultorias' },

  // ── Tecnologia ───────────────────────────────────────────────────
  '010101': { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Desenvolvimento de Software' },
  '010102': { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Processamento de Dados' },
  '010103': { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Infraestrutura Cloud' },
  '010104': { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Licença de Software' },
  '010199': { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Outros TI' },

  // ── Educação ─────────────────────────────────────────────────────
  '080101': { categoria: 'Educação',                 grupo: 'Educação',                 subgrupo: 'Ensino Regular' },
  '080102': { categoria: 'Educação',                 grupo: 'Treinamentos',             subgrupo: 'Cursos e Capacitação' },
  '080103': { categoria: 'Educação',                 grupo: 'Treinamentos',             subgrupo: 'Treinamento Corporativo' },
  '080199': { categoria: 'Educação',                 grupo: 'Educação',                 subgrupo: 'Outros Educacionais' },

  // ── Locação ──────────────────────────────────────────────────────
  '030101': { categoria: 'Locação',                  grupo: 'Locação Imóveis',          subgrupo: 'Locação Comercial' },
  '030102': { categoria: 'Locação',                  grupo: 'Locação de Bens',          subgrupo: 'Locação de Equipamentos' },
  '030103': { categoria: 'Locação',                  grupo: 'Locação de Bens',          subgrupo: 'Locação de Veículos' },

  // ── Transporte ───────────────────────────────────────────────────
  '160101': { categoria: 'Transporte',               grupo: 'Logística',                subgrupo: 'Frete Rodoviário' },
  '160102': { categoria: 'Transporte',               grupo: 'Logística',                subgrupo: 'Frete Aéreo' },
  '160199': { categoria: 'Transporte',               grupo: 'Logística',                subgrupo: 'Outros Transportes' },

  // ── Publicidade ──────────────────────────────────────────────────
  '170601': { categoria: 'Publicidade',              grupo: 'Marketing',                subgrupo: 'Publicidade Digital' },
  '170602': { categoria: 'Publicidade',              grupo: 'Marketing',                subgrupo: 'Publicidade Offline' },
  '170699': { categoria: 'Publicidade',              grupo: 'Marketing',                subgrupo: 'Outras Mídias' },

  // ── Construção Civil ─────────────────────────────────────────────
  '070101': { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Construção' },
  '070102': { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Reforma' },
  '070103': { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Instalações' },

  // ── Engenharia ───────────────────────────────────────────────────
  '070201': { categoria: 'Engenharia',               grupo: 'Engenharia',               subgrupo: 'Projetos Técnicos' },
  '070202': { categoria: 'Engenharia',               grupo: 'Engenharia',               subgrupo: 'Consultoria Técnica' },

  // ── Jurídico ─────────────────────────────────────────────────────
  '171401': { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',    subgrupo: 'Advocacia' },
  '171402': { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',    subgrupo: 'Assessoria Jurídica' },
  '171499': { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',    subgrupo: 'Outros Jurídicos' },

  // ── Financeiro ───────────────────────────────────────────────────
  '172001': { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',     subgrupo: 'Contabilidade' },
  '172002': { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',     subgrupo: 'Consultoria Financeira' },
  '172099': { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',     subgrupo: 'Outros Financeiros' },

  // ── Serviços Administrativos ─────────────────────────────────────
  '110101': { categoria: 'Serviços Administrativos', grupo: 'Facilities',               subgrupo: 'Limpeza e Conservação' },
  '110102': { categoria: 'Serviços Administrativos', grupo: 'Facilities',               subgrupo: 'Segurança e Vigilância' },
  '110103': { categoria: 'Serviços Administrativos', grupo: 'Administrativo',            subgrupo: 'Recursos Humanos' },
  '110199': { categoria: 'Serviços Administrativos', grupo: 'Administrativo',            subgrupo: 'Outros Administrativos' },
};
