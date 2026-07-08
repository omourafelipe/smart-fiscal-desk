import { MappingEntry } from './types';

/**
 * Mapeamento de Códigos LC 116/2003 → Categoria Sintética
 *
 * Prioridade 2 – Confiança: 95.
 * Normalização: remove pontos, espaços. Compara exato após normalização.
 * Exemplo: "4.01" → "401" → Atendimento Médico
 */
export const lc116Mapping: Record<string, MappingEntry> = {
  // ── Grupo 1: Informática e Serviços Correlatos ────────────────────
  '101':  { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Análise e Desenvolvimento' },
  '102':  { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Programação' },
  '103':  { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Processamento de Dados' },
  '104':  { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Elaboração de Programas' },
  '105':  { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Licença de Programas' },
  '106':  { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Assessoria em TI' },
  '107':  { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Suporte de Informática' },
  '108':  { categoria: 'Tecnologia',               grupo: 'Serviços de TI',           subgrupo: 'Planejamento em TI' },

  // ── Grupo 2: Pesquisas e Desenvolvimento ─────────────────────────
  '201':  { categoria: 'Consultoria',              grupo: 'Pesquisa',                 subgrupo: 'Pesquisa e Desenvolvimento' },

  // ── Grupo 3: Locação de Bens Móveis ──────────────────────────────
  '301':  { categoria: 'Locação',                  grupo: 'Locação de Bens',          subgrupo: 'Locação de Equipamentos' },
  '302':  { categoria: 'Locação',                  grupo: 'Locação de Bens',          subgrupo: 'Locação de Veículos' },
  '303':  { categoria: 'Locação',                  grupo: 'Locação de Bens',          subgrupo: 'Locação de Materiais' },
  '304':  { categoria: 'Locação',                  grupo: 'Locação de Bens',          subgrupo: 'Andaimes e Estruturas' },
  '305':  { categoria: 'Locação',                  grupo: 'Locação de Bens',          subgrupo: 'Aeronaves' },

  // ── Grupo 4: Saúde, Assistência Médica e Congêneres ───────────────
  '401':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Medicina e Biomedicina' },
  '402':  { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',              subgrupo: 'Análises Clínicas' },
  '403':  { categoria: 'Plano de Saúde',           grupo: 'Saúde Suplementar',        subgrupo: 'Plano de Saúde' },
  '404':  { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',               subgrupo: 'Instrumentação Cirúrgica' },
  '405':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Prótese' },
  '406':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Psicanálise / Psicologia' },
  '407':  { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',               subgrupo: 'Hospitais e Clínicas' },
  '408':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Obstetrícia' },
  '409':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Optometria' },
  '410':  { categoria: 'Diagnóstico Laboratorial', grupo: 'Diagnóstico',              subgrupo: 'Pronto-Socorro / Emergência' },
  '411':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Acupuntura' },
  '412':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Podologia' },
  '413':  { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',               subgrupo: 'Farmácia e Medicamentos' },
  '414':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Enfermagem' },
  '415':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Serviço Social' },
  '416':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Medicina Veterinária' },
  '417':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Cuidados Pessoais' },
  '418':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Fisioterapia' },
  '419':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Terapia Ocupacional' },
  '420':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Fonoaudiologia' },
  '421':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Nutrição' },
  '422':  { categoria: 'Atendimento Médico',       grupo: 'Serviços Médicos',         subgrupo: 'Assistência Domiciliar' },
  '423':  { categoria: 'Serviços Hospitalares',    grupo: 'Hospitalar',               subgrupo: 'Assistência Hospitalar' },

  // ── Grupo 5: Medicina e Engenharia (Análise Técnica) ─────────────
  '501':  { categoria: 'Engenharia',               grupo: 'Engenharia',               subgrupo: 'Medicina do Trabalho' },
  '502':  { categoria: 'Engenharia',               grupo: 'Engenharia',               subgrupo: 'Geologia e Prospecção' },
  '503':  { categoria: 'Engenharia',               grupo: 'Engenharia',               subgrupo: 'Geodésia e Cartografia' },
  '504':  { categoria: 'Engenharia',               grupo: 'Engenharia',               subgrupo: 'Análises Técnicas e Testes' },

  // ── Grupo 7: Serviços relativos a Engenharia, Arquitetura ─────────
  '701':  { categoria: 'Engenharia',               grupo: 'Obras',                    subgrupo: 'Engenharia, Arquitetura e Urbanismo' },
  '702':  { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Demolição e Terraplanagem' },
  '703':  { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Instalações' },
  '704':  { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Controle e Tratamento' },
  '705':  { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Estruturas e Fundações' },
  '706':  { categoria: 'Engenharia',               grupo: 'Obras',                    subgrupo: 'Consultoria Técnica de Obras' },
  '707':  { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Escoramento' },
  '708':  { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Pavimentação e Calçamento' },
  '709':  { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Obras em Rios' },
  '710':  { categoria: 'Construção Civil',         grupo: 'Obras',                    subgrupo: 'Limpeza e Dragagem' },

  // ── Grupo 8: Educação ─────────────────────────────────────────────
  '801':  { categoria: 'Educação',                 grupo: 'Educação',                 subgrupo: 'Ensino Regular' },
  '802':  { categoria: 'Educação',                 grupo: 'Treinamentos',             subgrupo: 'Instrução' },
  '803':  { categoria: 'Educação',                 grupo: 'Treinamentos',             subgrupo: 'Treinamento Corporativo' },
  '804':  { categoria: 'Educação',                 grupo: 'Educação',                 subgrupo: 'Avaliação de Conhecimentos' },

  // ── Grupo 10: Serviços de Intermediação e Congêneres ─────────────
  '1001': { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',     subgrupo: 'Agenciamento e Corretagem' },
  '1002': { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',     subgrupo: 'Agenciamento de Contratos' },

  // ── Grupo 14: Serviços de Manutenção e Reparação ─────────────────
  '1401': { categoria: 'Serviços Administrativos', grupo: 'Manutenção',               subgrupo: 'Assistência Técnica' },
  '1402': { categoria: 'Serviços Administrativos', grupo: 'Manutenção',               subgrupo: 'Manutenção de Máquinas' },
  '1403': { categoria: 'Serviços Administrativos', grupo: 'Manutenção',               subgrupo: 'Manutenção de Veículos' },
  '1405': { categoria: 'Serviços Administrativos', grupo: 'Manutenção',               subgrupo: 'Manutenção de Aparelhos' },

  // ── Grupo 16: Serviços de Transporte de Natureza Municipal ────────
  '1601': { categoria: 'Transporte',               grupo: 'Logística',                subgrupo: 'Transporte Municipal' },

  // ── Grupo 17: Serviços de Apoio Técnico Administrativo ────────────
  '1701': { categoria: 'Serviços Administrativos', grupo: 'Administrativo',            subgrupo: 'Assessoria e Apoio' },
  '1702': { categoria: 'Serviços Administrativos', grupo: 'Administrativo',            subgrupo: 'Datilografia e Secretaria' },
  '1703': { categoria: 'Serviços Administrativos', grupo: 'Administrativo',            subgrupo: 'Centralização de Atendimento' },
  '1704': { categoria: 'Serviços Administrativos', grupo: 'Administrativo',            subgrupo: 'Recrutamento e Seleção' },
  '1705': { categoria: 'Serviços Administrativos', grupo: 'Facilities',               subgrupo: 'Vigilância e Segurança' },
  '1706': { categoria: 'Publicidade',              grupo: 'Marketing',                subgrupo: 'Publicidade e Propaganda' },
  '1707': { categoria: 'Serviços Administrativos', grupo: 'Facilities',               subgrupo: 'Limpeza e Zeladoria' },
  '1708': { categoria: 'Serviços Administrativos', grupo: 'Administrativo',            subgrupo: 'Fornecimento de Mão de Obra' },
  '1709': { categoria: 'Serviços Administrativos', grupo: 'Administrativo',            subgrupo: 'Planejamento e Organização' },
  '1714': { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',    subgrupo: 'Advocacia' },
  '1716': { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',     subgrupo: 'Meteorologia / Hidrologia' },
  '1717': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Economia e Finanças' },
  '1718': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Estatística' },
  '1719': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Química' },
  '1720': { categoria: 'Financeiro',               grupo: 'Serviços Financeiros',     subgrupo: 'Contabilidade e Auditoria' },
  '1721': { categoria: 'Jurídico',                 grupo: 'Serviços Advocatícios',    subgrupo: 'Perícia, Laudos e Avaliação' },
  '1722': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Assistência Social' },
  '1723': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Biologia, Biotecnologia e Química' },
  '1724': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Psicologia, Psicanálise' },
  '1725': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Serviços de Meteorologia' },
  '1726': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Serviços de Curadoria' },
  '1727': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Comunicação de Massa' },
  '1728': { categoria: 'Consultoria',              grupo: 'Serviços Profissionais',   subgrupo: 'Adiantamentos' },
};
