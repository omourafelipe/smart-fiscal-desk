-- Migration: Configure RLS and User Identity Constraints
-- Created: 2026-06-15
-- Target tables: nfse_documents, nfse_documents_tomadas, custom_categories, service_classifications, category_rules, audit_logs

-- 1. nfse_documents
ALTER TABLE public.nfse_documents ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();
ALTER TABLE public.nfse_documents ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.nfse_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own nfse_documents" ON public.nfse_documents;
CREATE POLICY "Users can select their own nfse_documents" ON public.nfse_documents
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own nfse_documents" ON public.nfse_documents;
CREATE POLICY "Users can insert their own nfse_documents" ON public.nfse_documents
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own nfse_documents" ON public.nfse_documents;
CREATE POLICY "Users can update their own nfse_documents" ON public.nfse_documents
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own nfse_documents" ON public.nfse_documents;
CREATE POLICY "Users can delete their own nfse_documents" ON public.nfse_documents
    FOR DELETE TO authenticated USING (user_id = auth.uid());


-- 2. nfse_documents_tomadas
ALTER TABLE public.nfse_documents_tomadas ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();
ALTER TABLE public.nfse_documents_tomadas ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.nfse_documents_tomadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own nfse_documents_tomadas" ON public.nfse_documents_tomadas;
CREATE POLICY "Users can select their own nfse_documents_tomadas" ON public.nfse_documents_tomadas
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own nfse_documents_tomadas" ON public.nfse_documents_tomadas;
CREATE POLICY "Users can insert their own nfse_documents_tomadas" ON public.nfse_documents_tomadas
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own nfse_documents_tomadas" ON public.nfse_documents_tomadas;
CREATE POLICY "Users can update their own nfse_documents_tomadas" ON public.nfse_documents_tomadas
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own nfse_documents_tomadas" ON public.nfse_documents_tomadas;
CREATE POLICY "Users can delete their own nfse_documents_tomadas" ON public.nfse_documents_tomadas
    FOR DELETE TO authenticated USING (user_id = auth.uid());


-- 3. custom_categories
ALTER TABLE public.custom_categories ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();
ALTER TABLE public.custom_categories ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own custom_categories" ON public.custom_categories;
CREATE POLICY "Users can select their own custom_categories" ON public.custom_categories
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own custom_categories" ON public.custom_categories;
CREATE POLICY "Users can insert their own custom_categories" ON public.custom_categories
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own custom_categories" ON public.custom_categories;
CREATE POLICY "Users can update their own custom_categories" ON public.custom_categories
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own custom_categories" ON public.custom_categories;
CREATE POLICY "Users can delete their own custom_categories" ON public.custom_categories
    FOR DELETE TO authenticated USING (user_id = auth.uid());


-- 4. service_classifications
ALTER TABLE public.service_classifications ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();
ALTER TABLE public.service_classifications ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.service_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own service_classifications" ON public.service_classifications;
CREATE POLICY "Users can select their own service_classifications" ON public.service_classifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own service_classifications" ON public.service_classifications;
CREATE POLICY "Users can insert their own service_classifications" ON public.service_classifications
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own service_classifications" ON public.service_classifications;
CREATE POLICY "Users can update their own service_classifications" ON public.service_classifications
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own service_classifications" ON public.service_classifications;
CREATE POLICY "Users can delete their own service_classifications" ON public.service_classifications
    FOR DELETE TO authenticated USING (user_id = auth.uid());


-- 5. category_rules
ALTER TABLE public.category_rules ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();
ALTER TABLE public.category_rules ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own category_rules" ON public.category_rules;
CREATE POLICY "Users can select their own category_rules" ON public.category_rules
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own category_rules" ON public.category_rules;
CREATE POLICY "Users can insert their own category_rules" ON public.category_rules
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own category_rules" ON public.category_rules;
CREATE POLICY "Users can update their own category_rules" ON public.category_rules
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own category_rules" ON public.category_rules;
CREATE POLICY "Users can delete their own category_rules" ON public.category_rules
    FOR DELETE TO authenticated USING (user_id = auth.uid());


-- 6. audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();
ALTER TABLE public.audit_logs ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own audit_logs" ON public.audit_logs;
CREATE POLICY "Users can select their own audit_logs" ON public.audit_logs
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own audit_logs" ON public.audit_logs;
CREATE POLICY "Users can insert their own audit_logs" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own audit_logs" ON public.audit_logs;
CREATE POLICY "Users can update their own audit_logs" ON public.audit_logs
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own audit_logs" ON public.audit_logs;
CREATE POLICY "Users can delete their own audit_logs" ON public.audit_logs
    FOR DELETE TO authenticated USING (user_id = auth.uid());
