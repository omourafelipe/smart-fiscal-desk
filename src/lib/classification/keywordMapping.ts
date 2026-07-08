import { MappingEntry } from './types';

/**
 * Mapeamento de Palavras-Chave → Categoria Sintética
 *
 * Prioridade 4 – Confiança: 70.
 * Busca por substring case-insensitive na descrição do serviço.
 * A ORDEM das chaves importa: as mais específicas vêm primeiro.
 *
 * Todas as chaves devem estar em LOWERCASE.
 */
export const keywordMapping: [string, MappingEntry][] = [
  // ── Plano de Saúde (maior especificidade primeiro) ───────────────
  ['plano privado',         { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Plano Privado' }],
  ['plano de assistência',  { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Assistência' }],
  ['plano de assistencia',  { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Assistência' }],
  ['plano de saúde',        { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Plano de Saúde' }],
  ['plano de saude',        { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Plano de Saúde' }],
  ['assistência médica',    { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Assistência Médica' }],
  ['assistencia medica',    { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Assistência Médica' }],
  ['operadora de plano',    { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Operadora' }],
  [' ans ',                 { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',      subgrupo: 'Regulado ANS' }],

  // ── Serviços Hospitalares ────────────────────────────────────────
  ['internação hospitalar', { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Internação' }],
  ['internacao hospitalar', { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Internação' }],
  ['pronto-socorro',        { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Pronto-Socorro' }],
  ['pronto socorro',        { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Pronto-Socorro' }],
  ['cirurgia',              { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Cirurgia' }],
  ['internação',            { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Internação' }],
  ['internacao',            { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Internação' }],
  ['hospital',              { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Hospital' }],
  ['clínica',               { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Clínica' }],
  ['clinica',               { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'Clínica' }],
  ['uti ',                  { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',             subgrupo: 'UTI' }],

  // ── Diagnóstico Laboratorial ─────────────────────────────────────
  ['análise clínica',       { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Análise Clínica' }],
  ['analise clinica',       { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Análise Clínica' }],
  ['diagnóstico por imagem',{ categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Imagem' }],
  ['diagnostico por imagem',{ categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Imagem' }],
  ['biópsia',               { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Biópsia' }],
  ['biopsia',               { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Biópsia' }],
  ['laboratório',           { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Laboratório' }],
  ['laboratorio',           { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Laboratório' }],
  ['exame laborat',         { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Laboratório' }],
  ['análise laborat',       { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Laboratório' }],
  ['analise laborat',       { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Laboratório' }],
  ['tomografia',            { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Imagem' }],
  ['ressonância',           { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Imagem' }],
  ['ressonancia',           { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Imagem' }],
  ['ultrassonografia',      { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Imagem' }],
  ['ultrassom',             { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',            subgrupo: 'Imagem' }],

  // ── Atendimento Médico ───────────────────────────────────────────
  ['consulta médica',       { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Consulta' }],
  ['consulta medica',       { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Consulta' }],
  ['atendimento médico',    { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Atendimento' }],
  ['atendimento medico',    { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Atendimento' }],
  ['fisioterapia',          { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Fisioterapia' }],
  ['fonoaudiologia',        { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Fonoaudiologia' }],
  ['psicologia',            { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Psicologia' }],
  ['psiquiatria',           { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Psiquiatria' }],
  ['nutrição',              { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Nutrição' }],
  ['nutricao',              { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Nutrição' }],
  ['odontologia',           { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Odontologia' }],
  ['ambulatorial',          { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Ambulatorial' }],
  ['consulta',              { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Consulta' }],
  ['médico',                { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Geral' }],
  ['medico',                { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',       subgrupo: 'Geral' }],

  // ── Consultoria ──────────────────────────────────────────────────
  ['consultoria estratégica',{ categoria: 'Consultoria',             grupo: 'Serviços Profissionais', subgrupo: 'Estratégica' }],
  ['consultoria estrategica',{ categoria: 'Consultoria',             grupo: 'Serviços Profissionais', subgrupo: 'Estratégica' }],
  ['consultoria em gestão',  { categoria: 'Consultoria',             grupo: 'Serviços Profissionais', subgrupo: 'Gestão' }],
  ['consultoria em gestao',  { categoria: 'Consultoria',             grupo: 'Serviços Profissionais', subgrupo: 'Gestão' }],
  ['assessoria empresarial', { categoria: 'Consultoria',             grupo: 'Serviços Profissionais', subgrupo: 'Empresarial' }],
  ['auditoria',              { categoria: 'Consultoria',             grupo: 'Serviços Profissionais', subgrupo: 'Auditoria' }],
  ['assessoria',             { categoria: 'Consultoria',             grupo: 'Serviços Profissionais', subgrupo: 'Assessoria' }],
  ['consultoria',            { categoria: 'Consultoria',             grupo: 'Serviços Profissionais', subgrupo: 'Consultoria Geral' }],

  // ── Tecnologia ───────────────────────────────────────────────────
  ['desenvolvimento de software', { categoria: 'Tecnologia',         grupo: 'Serviços de TI',         subgrupo: 'Desenvolvimento' }],
  ['licença de software',    { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Licença' }],
  ['licenca de software',    { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Licença' }],
  ['computação em nuvem',    { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Cloud' }],
  ['computacao em nuvem',    { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Cloud' }],
  ['infraestrutura cloud',   { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Cloud' }],
  ['tecnologia da informação',{ categoria: 'Tecnologia',              grupo: 'Serviços de TI',         subgrupo: 'TI Geral' }],
  ['tecnologia da informacao',{ categoria: 'Tecnologia',              grupo: 'Serviços de TI',         subgrupo: 'TI Geral' }],
  ['suporte técnico',        { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Suporte' }],
  ['suporte tecnico',        { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Suporte' }],
  ['software',               { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Software' }],
  ['cloud',                  { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Cloud' }],
  ['saas',                   { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'SaaS' }],
  ['paas',                   { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'PaaS' }],
  ['iaas',                   { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'IaaS' }],
  ['desenvolvimento',        { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Desenvolvimento' }],
  ['programação',            { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Programação' }],
  ['programacao',            { categoria: 'Tecnologia',               grupo: 'Serviços de TI',         subgrupo: 'Programação' }],

  // ── Educação ─────────────────────────────────────────────────────
  ['treinamento corporativo',{ categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Corporativo' }],
  ['curso de capacitação',   { categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Capacitação' }],
  ['curso de capacitacao',   { categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Capacitação' }],
  ['capacitação',            { categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Capacitação' }],
  ['capacitacao',            { categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Capacitação' }],
  ['treinamento',            { categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Treinamento' }],
  ['educação',               { categoria: 'Educação',                 grupo: 'Educação',               subgrupo: 'Educação' }],
  ['educacao',               { categoria: 'Educação',                 grupo: 'Educação',               subgrupo: 'Educação' }],
  ['curso',                  { categoria: 'Educação',                 grupo: 'Treinamentos',           subgrupo: 'Curso' }],

  // ── Locação ──────────────────────────────────────────────────────
  ['locação de imóvel',      { categoria: 'Locação',                  grupo: 'Locação Imóveis',        subgrupo: 'Imóvel' }],
  ['locacao de imovel',      { categoria: 'Locação',                  grupo: 'Locação Imóveis',        subgrupo: 'Imóvel' }],
  ['locação de equipamento', { categoria: 'Locação',                  grupo: 'Locação de Bens',        subgrupo: 'Equipamentos' }],
  ['locacao de equipamento', { categoria: 'Locação',                  grupo: 'Locação de Bens',        subgrupo: 'Equipamentos' }],
  ['aluguel de imóvel',      { categoria: 'Locação',                  grupo: 'Locação Imóveis',        subgrupo: 'Imóvel' }],
  ['aluguel de imovel',      { categoria: 'Locação',                  grupo: 'Locação Imóveis',        subgrupo: 'Imóvel' }],
  ['locação',                { categoria: 'Locação',                  grupo: 'Locação de Bens',        subgrupo: 'Geral' }],
  ['locacao',                { categoria: 'Locação',                  grupo: 'Locação de Bens',        subgrupo: 'Geral' }],
  ['aluguel',                { categoria: 'Locação',                  grupo: 'Locação Imóveis',        subgrupo: 'Aluguel' }],
  ['condomínio',             { categoria: 'Locação',                  grupo: 'Locação Imóveis',        subgrupo: 'Condomínio' }],
  ['condominio',             { categoria: 'Locação',                  grupo: 'Locação Imóveis',        subgrupo: 'Condomínio' }],

  // ── Transporte ───────────────────────────────────────────────────
  ['frete rodoviário',       { categoria: 'Transporte',               grupo: 'Logística',              subgrupo: 'Frete Rodoviário' }],
  ['frete rodoviario',       { categoria: 'Transporte',               grupo: 'Logística',              subgrupo: 'Frete Rodoviário' }],
  ['transporte de carga',    { categoria: 'Transporte',               grupo: 'Logística',              subgrupo: 'Carga' }],
  ['logística',              { categoria: 'Transporte',               grupo: 'Logística',              subgrupo: 'Logística' }],
  ['logistica',              { categoria: 'Transporte',               grupo: 'Logística',              subgrupo: 'Logística' }],
  ['frete',                  { categoria: 'Transporte',               grupo: 'Logística',              subgrupo: 'Frete' }],
  ['transporte',             { categoria: 'Transporte',               grupo: 'Logística',              subgrupo: 'Transporte' }],

  // ── Publicidade ──────────────────────────────────────────────────
  ['publicidade e propaganda',{ categoria: 'Publicidade',             grupo: 'Marketing',              subgrupo: 'Publicidade' }],
  ['mídia social',           { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Mídia Social' }],
  ['midia social',           { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Mídia Social' }],
  ['marketing digital',      { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Digital' }],
  ['publicidade',            { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Publicidade' }],
  ['propaganda',             { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Propaganda' }],
  ['marketing',              { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Marketing' }],
  ['anúncio',                { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Anúncio' }],
  ['anuncio',                { categoria: 'Publicidade',              grupo: 'Marketing',              subgrupo: 'Anúncio' }],

  // ── Construção Civil ─────────────────────────────────────────────
  ['construção civil',       { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Construção' }],
  ['construcao civil',       { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Construção' }],
  ['reforma e manutenção',   { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Reforma' }],
  ['reforma e manutencao',   { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Reforma' }],
  ['pavimentação',           { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Pavimentação' }],
  ['pavimentacao',           { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Pavimentação' }],
  ['obra',                   { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Obra' }],
  ['reforma',                { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Reforma' }],
  ['construção',             { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Construção' }],
  ['construcao',             { categoria: 'Construção Civil',         grupo: 'Obras',                  subgrupo: 'Construção' }],

  // ── Engenharia ───────────────────────────────────────────────────
  ['engenharia elétrica',    { categoria: 'Engenharia',               grupo: 'Engenharia',             subgrupo: 'Elétrica' }],
  ['engenharia eletrica',    { categoria: 'Engenharia',               grupo: 'Engenharia',             subgrupo: 'Elétrica' }],
  ['engenharia mecânica',    { categoria: 'Engenharia',               grupo: 'Engenharia',             subgrupo: 'Mecânica' }],
  ['engenharia mecanica',    { categoria: 'Engenharia',               grupo: 'Engenharia',             subgrupo: 'Mecânica' }],
  ['projeto de engenharia',  { categoria: 'Engenharia',               grupo: 'Engenharia',             subgrupo: 'Projeto' }],
  ['engenharia',             { categoria: 'Engenharia',               grupo: 'Engenharia',             subgrupo: 'Engenharia' }],
  ['arquitetura',            { categoria: 'Engenharia',               grupo: 'Engenharia',             subgrupo: 'Arquitetura' }],

  // ── Jurídico ─────────────────────────────────────────────────────
  ['assessoria jurídica',    { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Assessoria' }],
  ['assessoria juridica',    { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Assessoria' }],
  ['honorários advocatícios',{ categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Honorários' }],
  ['honorarios advocaticios',{ categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Honorários' }],
  ['advocacia',              { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Advocacia' }],
  ['jurídico',               { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Jurídico' }],
  ['juridico',               { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Jurídico' }],
  ['contencioso',            { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Contencioso' }],
  ['judicial',               { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Judicial' }],
  ['notarial',               { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Cartório' }],
  ['cartório',               { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Cartório' }],
  ['cartorio',               { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',  subgrupo: 'Cartório' }],

  // ── Financeiro ───────────────────────────────────────────────────
  ['serviços contábeis',     { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Contabilidade' }],
  ['servicos contabeis',     { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Contabilidade' }],
  ['contabilidade',          { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Contabilidade' }],
  ['controladoria',          { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Controladoria' }],
  ['financeiro',             { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Financeiro' }],
  ['fiscal',                 { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',   subgrupo: 'Fiscal' }],

  // ── Serviços Administrativos ─────────────────────────────────────
  ['limpeza e conservação',  { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Limpeza' }],
  ['limpeza e conservacao',  { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Limpeza' }],
  ['vigilância',             { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Vigilância' }],
  ['vigilancia',             { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Vigilância' }],
  ['portaria',               { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Portaria' }],
  ['segurança',              { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Segurança' }],
  ['seguranca',              { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Segurança' }],
  ['limpeza',                { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Limpeza' }],
  ['conservação',            { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Conservação' }],
  ['conservacao',            { categoria: 'Serviços Administrativos', grupo: 'Facilities',             subgrupo: 'Conservação' }],
  ['recrutamento',           { categoria: 'Serviços Administrativos', grupo: 'Administrativo',         subgrupo: 'RH' }],
  ['recursos humanos',       { categoria: 'Serviços Administrativos', grupo: 'Administrativo',         subgrupo: 'RH' }],
  ['administrativo',         { categoria: 'Serviços Administrativos', grupo: 'Administrativo',         subgrupo: 'Administrativo' }],
];
