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
