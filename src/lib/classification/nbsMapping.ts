import { MappingEntry } from './types';

/**
 * Mapeamento de Descrições NBS (Nomenclatura Brasileira de Serviços) → Categoria Sintética
 *
 * Prioridade 3 – Confiança: 90.
 * Busca por substring case-insensitive na descrição do campo descricao_nbs
 * ou na discriminação do serviço. A primeira correspondência ganha.
 *
 * As chaves estão em lowercase para normalização direta.
 */
export const nbsMapping: Record<string, MappingEntry> = {
  // ── Plano de Saúde ──────────────────────────────────────────────
  'plano privado de assistência à saúde':   { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Plano Privado' },
  'plano privado de assistencia a saude':   { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Plano Privado' },
  'operadora de plano de saúde':            { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Operadora' },
  'operadora de plano de saude':            { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Operadora' },
  'assistência médica coletiva':            { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Coletivo' },
  'assistencia medica coletiva':            { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Coletivo' },
  'seguro saúde':                           { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Seguro' },
  'seguro saude':                           { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Seguro' },

  // ── Serviços Hospitalares ────────────────────────────────────────
  'serviços hospitalares':                  { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Hospitalização' },
  'servicos hospitalares':                  { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Hospitalização' },
  'prestação de serviços hospitalares':     { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Hospitalização' },
  'prestacao de servicos hospitalares':     { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Hospitalização' },
  'internação hospitalar':                  { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Internação' },
  'internacao hospitalar':                  { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Internação' },
  'cirurgia':                               { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Cirurgia' },

  // ── Atendimento Médico ───────────────────────────────────────────
  'consulta médica':                        { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Consulta' },
  'consulta medica':                        { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Consulta' },
  'atendimento ambulatorial':               { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Ambulatorial' },
  'serviços médicos':                       { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Geral' },
  'servicos medicos':                       { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Geral' },

  // ── Diagnóstico Laboratorial ─────────────────────────────────────
  'análise clínica':                        { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Análise Clínica' },
  'analise clinica':                        { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Análise Clínica' },
  'diagnóstico por imagem':                 { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Imagem' },
  'diagnostico por imagem':                 { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Imagem' },
  'exame laboratorial':                     { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Laboratório' },

  // ── Consultoria ──────────────────────────────────────────────────
  'consultoria em gestão':                  { categoria: 'Consultoria',              grupo: 'Serviços Profissionais', subgrupo: 'Gestão' },
  'consultoria em gestao':                  { categoria: 'Consultoria',              grupo: 'Serviços Profissionais', subgrupo: 'Gestão' },
  'consultoria empresarial':                { categoria: 'Consultoria',              grupo: 'Serviços Profissionais', subgrupo: 'Empresarial' },
  'assessoria técnica':                     { categoria: 'Consultoria',              grupo: 'Serviços Profissionais', subgrupo: 'Técnica' },
  'assessoria tecnica':                     { categoria: 'Consultoria',              grupo: 'Serviços Profissionais', subgrupo: 'Técnica' },
  'auditoria independente':                 { categoria: 'Consultoria',              grupo: 'Serviços Profissionais', subgrupo: 'Auditoria' },

  // ── Tecnologia ───────────────────────────────────────────────────
  'desenvolvimento de software':            { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Desenvolvimento' },
  'serviços de tecnologia da informação':   { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'TI Geral' },
  'servicos de tecnologia da informacao':   { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'TI Geral' },
  'computação em nuvem':                    { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Cloud' },
  'computacao em nuvem':                    { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Cloud' },
  'licença de software':                    { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Licença' },
  'licenca de software':                    { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Licença' },

  // ── Educação ─────────────────────────────────────────────────────
  'treinamento corporativo':                { categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Corporativo' },
  'curso de capacitação':                   { categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Capacitação' },
  'curso de capacitacao':                   { categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Capacitação' },
  'serviços educacionais':                  { categoria: 'Educação',                 grupo: 'Educação',               subgrupo: 'Educação' },
  'servicos educacionais':                  { categoria: 'Educação',                 grupo: 'Educação',               subgrupo: 'Educação' },

  // ── Locação ──────────────────────────────────────────────────────
  'locação de equipamentos':                { categoria: 'Locação',                  grupo: 'Locação de Bens',        subgrupo: 'Equipamentos' },
  'locacao de equipamentos':                { categoria: 'Locação',                  grupo: 'Locação de Bens',        subgrupo: 'Equipamentos' },
  'locação de imóvel':                      { categoria: 'Locação',                  grupo: 'Locação Imóveis',        subgrupo: 'Imóvel' },
  'locacao de imovel':                      { categoria: 'Locação',                  grupo: 'Locação Imóveis',        subgrupo: 'Imóvel' },

  // ── Publicidade ──────────────────────────────────────────────────
  'publicidade e propaganda':               { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Publicidade' },
  'serviços de marketing':                  { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Marketing' },
  'servicos de marketing':                  { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Marketing' },

  // ── Construção Civil ─────────────────────────────────────────────
  'construção civil':                       { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Construção' },
  'construcao civil':                       { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Construção' },
  'reforma e manutenção':                   { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Reforma' },
  'reforma e manutencao':                   { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Reforma' },

  // ── Jurídico ─────────────────────────────────────────────────────
  'serviços advocatícios':                  { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Advocacia' },
  'servicos advocaticios':                  { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Advocacia' },
  'assessoria jurídica':                    { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Assessoria' },
  'assessoria juridica':                    { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Assessoria' },

  // ── Financeiro ───────────────────────────────────────────────────
  'serviços contábeis':                     { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Contabilidade' },
  'servicos contabeis':                     { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Contabilidade' },
  'auditoria contábil':                     { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Auditoria' },
  'auditoria contabil':                     { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Auditoria' },
};
