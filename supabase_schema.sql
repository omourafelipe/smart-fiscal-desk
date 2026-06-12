-- ==========================================
-- SMART FISCAL DESK - SUPABASE DATABASE SCHEMA
-- ==========================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Ele cria as tabelas necessárias, configura RLS (Row Level Security)
-- e estabelece as regras de isolamento para múltiplos usuários/empresas.

-- 1. Perfil do Usuário
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT,
    empresa TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilita RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir leitura do próprio perfil" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Permitir atualização do próprio perfil" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Permitir inserção do próprio perfil" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Notas Fiscais Emitidas (Faturamento)
CREATE TABLE IF NOT EXISTS public.nfse_documents (
    id TEXT PRIMARY KEY, -- nNFSe + CNPJ Prestador
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    n_nfse TEXT NOT NULL,
    cnpj_prestador TEXT NOT NULL,
    nome_prestador TEXT,
    dh_emi TEXT,
    valor NUMERIC NOT NULL DEFAULT 0,
    cliente TEXT,
    servico TEXT,
    c_stat TEXT,
    status TEXT CHECK (status IN ('válida', 'cancelada')),
    chave TEXT,
    cnpj_cpf_cliente TEXT,
    vlr_liquido NUMERIC DEFAULT 0,
    vlr_iss NUMERIC DEFAULT 0,
    vlr_iss_ret NUMERIC DEFAULT 0,
    vlr_iss_recolher NUMERIC DEFAULT 0,
    iss_retido TEXT,
    vlr_csll NUMERIC DEFAULT 0,
    vlr_irrf NUMERIC DEFAULT 0,
    vlr_pis NUMERIC DEFAULT 0,
    vlr_cofins NUMERIC DEFAULT 0,
    vlr_inss NUMERIC DEFAULT 0,
    cod_trib_nacional TEXT,
    d_compet TEXT,
    raw TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.nfse_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total às próprias notas emitidas" ON public.nfse_documents
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Notas Fiscais Tomadas
CREATE TABLE IF NOT EXISTS public.nfse_documents_tomadas (
    id TEXT PRIMARY KEY, -- nNFSe + CNPJ Fornecedor
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    n_nfse TEXT NOT NULL,
    cnpj_tomador TEXT NOT NULL,
    nome_tomador TEXT,
    cnpj_prestador TEXT NOT NULL,
    nome_prestador TEXT,
    dh_emi TEXT,
    d_compet TEXT,
    valor NUMERIC NOT NULL DEFAULT 0,
    vlr_liquido NUMERIC DEFAULT 0,
    servico TEXT,
    cod_trib_nacional TEXT,
    c_stat TEXT,
    status TEXT CHECK (status IN ('válida', 'cancelada')),
    chave TEXT,
    iss_retido TEXT,
    vlr_iss_ret NUMERIC DEFAULT 0,
    vlr_iss NUMERIC DEFAULT 0,
    vlr_irrf NUMERIC DEFAULT 0,
    vlr_csll NUMERIC DEFAULT 0,
    vlr_pis NUMERIC DEFAULT 0,
    vlr_cofins NUMERIC DEFAULT 0,
    vlr_inss NUMERIC DEFAULT 0,
    raw TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.nfse_documents_tomadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total às próprias notas tomadas" ON public.nfse_documents_tomadas
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Categorias Customizadas
CREATE TABLE IF NOT EXISTS public.custom_categories (
    id TEXT, -- Nome da categoria
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    grupo_sintetico TEXT,
    PRIMARY KEY (id, user_id)
);

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total às próprias categorias" ON public.custom_categories
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Mapeamentos Manuais de Categorias (Overrides)
CREATE TABLE IF NOT EXISTS public.category_overrides (
    codigo TEXT, -- codTribNacional
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    PRIMARY KEY (codigo, user_id)
);

ALTER TABLE public.category_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total aos próprios overrides" ON public.category_overrides
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Classificações Geradas
CREATE TABLE IF NOT EXISTS public.service_classifications (
    codigo TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    categoria_executiva TEXT,
    grupo_operacional TEXT,
    codigo_lc116 TEXT,
    descricao_lc116 TEXT,
    codigo_nbs TEXT,
    descricao_nbs TEXT,
    origem TEXT,
    confianca NUMERIC DEFAULT 0,
    metodo TEXT,
    data_classificacao TEXT,
    conflito BOOLEAN DEFAULT false,
    ausente_oficial BOOLEAN DEFAULT false,
    PRIMARY KEY (codigo, user_id)
);

ALTER TABLE public.service_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total às próprias classificações" ON public.service_classifications
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Regras de Aprendizado
CREATE TABLE IF NOT EXISTS public.category_rules (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('codigo', 'descricao')),
    chave TEXT NOT NULL,
    categoria_executiva TEXT,
    grupo_operacional TEXT,
    PRIMARY KEY (id, user_id)
);

ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total às próprias regras" ON public.category_rules
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    classificacao_anterior TEXT,
    classificacao_nova TEXT,
    usuario TEXT,
    data_hora TEXT,
    justificativa TEXT,
    PRIMARY KEY (id, user_id)
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total aos próprios logs de auditoria" ON public.audit_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger para criar perfil automaticamente no SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, empresa)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'nome', 'Novo Usuário'),
        COALESCE(new.raw_user_meta_data->>'empresa', 'Empresa Individual')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =======================================================
-- EVOLUÇÃO MULTI-TENANT B2B SAAS (V2)
-- =======================================================

-- 1. Tabela de Grupos (groups)
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- 2. Tabela de Empresas (companies)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 3. Membros do Grupo (group_members)
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('Owner', 'Administrador', 'Analista', 'Visualizador')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    accepted_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'declined')),
    UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 4. Convites do Grupo (group_invitations)
CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Owner', 'Administrador', 'Analista', 'Visualizador')),
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- 5. Atualizar perfis (profiles)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 6. Adicionar group_id às tabelas existentes
ALTER TABLE public.nfse_documents ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.nfse_documents_tomadas ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.custom_categories ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.category_overrides ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.service_classifications ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.category_rules ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- 7. Atualizar audit_logs para auditoria geral de eventos SaaS
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Migrar logs antigos para o novo formato compatível
UPDATE public.audit_logs
SET action = 'reclassify',
    entity = 'classification',
    entity_id = codigo,
    metadata = jsonb_build_object(
        'classificacao_anterior', classificacao_anterior,
        'classificacao_nova', classificacao_nova,
        'usuario', usuario,
        'justificativa', justificativa
    )
WHERE action IS NULL;

-- 8. Função de Auxílio RLS: Obter papel do usuário no grupo
CREATE OR REPLACE FUNCTION public.get_user_role_in_group(group_uuid UUID, user_uuid UUID)
RETURNS TEXT AS $$
    SELECT role FROM public.group_members 
    WHERE group_id = group_uuid AND user_id = user_uuid AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER;

-- 9. Políticas de RLS em Tabelas SaaS

-- Políticas para groups
CREATE POLICY "Leitura de grupos permitida aos membros ativos" ON public.groups
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = id and group_members.user_id = auth.uid() and group_members.status = 'active'));

CREATE POLICY "Criar grupos permitida aos usuários autenticados" ON public.groups
    FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Alteração de grupo permitida apenas ao Proprietário" ON public.groups
    FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Exclusão de grupo permitida apenas ao Proprietário" ON public.groups
    FOR DELETE USING (auth.uid() = owner_user_id);

-- Políticas para group_members
CREATE POLICY "Leitura de membros permitida aos membros ativos do grupo" ON public.group_members
    FOR SELECT USING (exists (select 1 from group_members gm where gm.group_id = group_id and gm.user_id = auth.uid() and gm.status = 'active'));

CREATE POLICY "Inserção de membros permitida a Proprietários/Administradores" ON public.group_members
    FOR INSERT WITH CHECK (exists (select 1 from group_members gm where gm.group_id = group_id and gm.user_id = auth.uid() and gm.role in ('Owner', 'Administrador') and gm.status = 'active'));

CREATE POLICY "Atualização de membros permitida apenas a Proprietários" ON public.group_members
    FOR UPDATE USING (exists (select 1 from group_members gm where gm.group_id = group_id and gm.user_id = auth.uid() and gm.role = 'Owner' and gm.status = 'active'));

CREATE POLICY "Exclusão de membros permitida a Proprietários (Administradores podem excluir a si mesmos)" ON public.group_members
    FOR DELETE USING (
        exists (select 1 from group_members gm where gm.group_id = group_id and gm.user_id = auth.uid() and gm.role = 'Owner' and gm.status = 'active')
        OR auth.uid() = user_id
    );

-- Políticas para companies
CREATE POLICY "Leitura de empresas permitida aos membros ativos do grupo" ON public.companies
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));

CREATE POLICY "Criar empresas permitida a Proprietários/Administradores" ON public.companies
    FOR INSERT WITH CHECK (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador') and group_members.status = 'active'));

CREATE POLICY "Atualização de empresas permitida a Proprietários/Administradores" ON public.companies
    FOR UPDATE USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador') and group_members.status = 'active'));

CREATE POLICY "Exclusão de empresas permitida apenas a Proprietários" ON public.companies
    FOR DELETE USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role = 'Owner' and group_members.status = 'active'));

-- Políticas para group_invitations
CREATE POLICY "Leitura de convites permitida aos membros ativos do grupo" ON public.group_invitations
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));

CREATE POLICY "Criar convites permitida a Proprietários/Administradores" ON public.group_invitations
    FOR INSERT WITH CHECK (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador') and group_members.status = 'active'));

CREATE POLICY "Atualização/exclusão de convites permitida a Proprietários/Administradores" ON public.group_invitations
    FOR ALL USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador') and group_members.status = 'active'));

-- Políticas RLS genéricas para tabelas de dados do grupo (documentos, regras, classificações)
DROP POLICY IF EXISTS "Permitir acesso total às próprias notas emitidas" ON public.nfse_documents;
CREATE POLICY "Leitura de notas emitidas permitida aos membros ativos do grupo" ON public.nfse_documents
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));
CREATE POLICY "Importação de notas emitidas permitida a Proprietários/Administradores" ON public.nfse_documents
    FOR INSERT WITH CHECK (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador') and group_members.status = 'active'));
CREATE POLICY "Atualização de notas emitidas permitida a Proprietários/Administradores/Analistas" ON public.nfse_documents
    FOR UPDATE USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador', 'Analista') and group_members.status = 'active'));
CREATE POLICY "Exclusão de notas emitidas permitida apenas ao Proprietário" ON public.nfse_documents
    FOR DELETE USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role = 'Owner' and group_members.status = 'active'));

DROP POLICY IF EXISTS "Permitir acesso total às próprias notas tomadas" ON public.nfse_documents_tomadas;
CREATE POLICY "Leitura de notas tomadas permitida aos membros ativos do grupo" ON public.nfse_documents_tomadas
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));
CREATE POLICY "Importação de notas tomadas permitida a Proprietários/Administradores" ON public.nfse_documents_tomadas
    FOR INSERT WITH CHECK (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador') and group_members.status = 'active'));
CREATE POLICY "Atualização de notas tomadas permitida a Proprietários/Administradores/Analistas" ON public.nfse_documents_tomadas
    FOR UPDATE USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador', 'Analista') and group_members.status = 'active'));
CREATE POLICY "Exclusão de notas tomadas permitida apenas ao Proprietário" ON public.nfse_documents_tomadas
    FOR DELETE USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role = 'Owner' and group_members.status = 'active'));

DROP POLICY IF EXISTS "Permitir acesso total às próprias categorias" ON public.custom_categories;
CREATE POLICY "Leitura de categorias customizadas permitida aos membros ativos do grupo" ON public.custom_categories
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));
CREATE POLICY "Escrita de categorias customizadas permitida a Proprietários/Administradores/Analistas" ON public.custom_categories
    FOR ALL USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador', 'Analista') and group_members.status = 'active'));

DROP POLICY IF EXISTS "Permitir acesso total aos próprios overrides" ON public.category_overrides;
CREATE POLICY "Leitura de overrides permitida aos membros ativos do grupo" ON public.category_overrides
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));
CREATE POLICY "Escrita de overrides permitida a Proprietários/Administradores/Analistas" ON public.category_overrides
    FOR ALL USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador', 'Analista') and group_members.status = 'active'));

DROP POLICY IF EXISTS "Permitir acesso total às próprias classificações" ON public.service_classifications;
CREATE POLICY "Leitura de classificações permitida aos membros ativos do grupo" ON public.service_classifications
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));
CREATE POLICY "Escrita de classificações permitida a Proprietários/Administradores/Analistas" ON public.service_classifications
    FOR ALL USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador', 'Analista') and group_members.status = 'active'));

DROP POLICY IF EXISTS "Permitir acesso total às próprias regras" ON public.category_rules;
CREATE POLICY "Leitura de regras permitida aos membros ativos do grupo" ON public.category_rules
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));
CREATE POLICY "Escrita de regras permitida a Proprietários/Administradores/Analistas" ON public.category_rules
    FOR ALL USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.role in ('Owner', 'Administrador', 'Analista') and group_members.status = 'active'));

DROP POLICY IF EXISTS "Permitir acesso total aos próprios logs de auditoria" ON public.audit_logs;
CREATE POLICY "Leitura de audit_logs permitida aos membros ativos do grupo" ON public.audit_logs
    FOR SELECT USING (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));
CREATE POLICY "Inserção de audit_logs permitida a membros ativos" ON public.audit_logs
    FOR INSERT WITH CHECK (exists (select 1 from group_members where group_members.group_id = group_id and group_members.user_id = auth.uid() and group_members.status = 'active'));

-- Política para profiles (visualizar dados de perfis de membros do mesmo grupo)
DROP POLICY IF EXISTS "Permitir leitura do próprio perfil" ON public.profiles;
CREATE POLICY "Leitura de perfil permitida ao próprio usuário ou membros do grupo" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
        OR exists (
            select 1 from group_members my_gm
            join group_members other_gm on my_gm.group_id = other_gm.group_id
            where my_gm.user_id = auth.uid() and other_gm.user_id = id and my_gm.status = 'active' and other_gm.status = 'active'
        )
    );

-- 10. Atualizar o Trigger e a Função de Criação de Perfil para criar grupo padrão automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_group_id UUID;
    group_name TEXT;
    user_name TEXT;
BEGIN
    user_name := COALESCE(new.raw_user_meta_data->>'nome', 'Novo Usuário');
    group_name := COALESCE(new.raw_user_meta_data->>'empresa', 'Grupo de ' || user_name);

    -- 1. Insere o perfil do usuário
    INSERT INTO public.profiles (id, nome, email, avatar_url, created_at)
    VALUES (
        new.id,
        user_name,
        new.email,
        new.raw_user_meta_data->>'avatar_url',
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET nome = EXCLUDED.nome, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url;

    -- 2. Cria o grupo padrão para o usuário
    INSERT INTO public.groups (nome, owner_user_id, created_at)
    VALUES (group_name, new.id, now())
    RETURNING id INTO new_group_id;

    -- 3. Adiciona o usuário como Owner ativo do grupo
    INSERT INTO public.group_members (group_id, user_id, role, status, accepted_at)
    VALUES (new_group_id, new.id, 'Owner', 'active', now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. Script de Migração de Dados Existentes
DO $$
DECLARE
    user_record RECORD;
    new_group_id UUID;
BEGIN
    FOR user_record IN SELECT id, nome, empresa FROM public.profiles LOOP
        -- Verifica se o usuário já tem um grupo que ele é dono
        IF NOT EXISTS (SELECT 1 FROM public.groups WHERE owner_user_id = user_record.id) THEN
            -- Cria o grupo padrão baseado na empresa do perfil
            INSERT INTO public.groups (nome, owner_user_id)
            VALUES (COALESCE(user_record.empresa, 'Grupo de ' || user_record.nome), user_record.id)
            RETURNING id INTO new_group_id;

            -- Adiciona o usuário como Owner ativo do grupo
            INSERT INTO public.group_members (group_id, user_id, role, status, accepted_at)
            VALUES (new_group_id, user_record.id, 'Owner', 'active', now());

            -- Associa os registros existentes ao novo grupo
            UPDATE public.nfse_documents SET group_id = new_group_id WHERE user_id = user_record.id AND group_id IS NULL;
            UPDATE public.nfse_documents_tomadas SET group_id = new_group_id WHERE user_id = user_record.id AND group_id IS NULL;
            UPDATE public.custom_categories SET group_id = new_group_id WHERE user_id = user_record.id AND group_id IS NULL;
            UPDATE public.category_overrides SET group_id = new_group_id WHERE user_id = user_record.id AND group_id IS NULL;
            UPDATE public.service_classifications SET group_id = new_group_id WHERE user_id = user_record.id AND group_id IS NULL;
            UPDATE public.category_rules SET group_id = new_group_id WHERE user_id = user_record.id AND group_id IS NULL;
        END IF;
    END LOOP;
END $$;

-- 12. Função RPC de Segurança: Aceitar Convite de Grupo
CREATE OR REPLACE FUNCTION public.accept_group_invitation(invite_token TEXT, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    invitation_record RECORD;
BEGIN
    -- Busca o convite correspondente
    SELECT * INTO invitation_record
    FROM public.group_invitations
    WHERE token = invite_token AND status = 'pending' AND expires_at > now()
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Cria ou atualiza o membro do grupo
    INSERT INTO public.group_members (group_id, user_id, role, status, accepted_at)
    VALUES (invitation_record.group_id, user_uuid, invitation_record.role, 'active', now())
    ON CONFLICT (group_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active', accepted_at = now();

    -- Marca o convite como aceito
    UPDATE public.group_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = invitation_record.id;

    -- Grava log de auditoria
    INSERT INTO public.audit_logs (group_id, user_id, action, entity, entity_id, metadata)
    VALUES (
        invitation_record.group_id,
        user_uuid,
        'accept_invite',
        'invitation',
        invitation_record.id::TEXT,
        jsonb_build_object('email', invitation_record.email, 'role', invitation_record.role)
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
