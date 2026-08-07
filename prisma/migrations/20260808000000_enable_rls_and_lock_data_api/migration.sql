-- Sécurité — verrouillage de l'API Data (PostgREST) sur le schéma `public`.
--
-- CONTEXTE
-- Prisma crée ses tables dans `public` sans RLS. À la création d'un projet,
-- Supabase pose un ALTER DEFAULT PRIVILEGES qui accorde automatiquement tous
-- les droits sur chaque nouvelle table aux rôles `anon` et `authenticated`.
-- Conséquence : toutes les tables Carboniq étaient lisibles ET modifiables via
-- https://<ref>.supabase.co/rest/v1/<Table> par quiconque détient la clé anon
-- (dont "Session".accessToken et "Shop".accessToken — les tokens Shopify).
--
-- POURQUOI C'EST SANS IMPACT SUR L'APP
-- Carboniq n'utilise pas l'API Data de Supabase (aucun @supabase/supabase-js
-- dans le projet). Tous les accès passent par Prisma sur le pooler Postgres
-- avec le rôle `postgres`, qui est propriétaire des tables. Un propriétaire de
-- table contourne la RLS par défaut — et on ne pose surtout PAS de
-- FORCE ROW LEVEL SECURITY ici, ce qui casserait Prisma.
--
-- Script idempotent : rejouable sans risque (SQL Editor Supabase ou migrate deploy).

-- 1) RLS activée sur toutes les tables de `public`, sans aucune policy.
--    Aucune policy = deny-by-default pour anon / authenticated.
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND NOT c.relrowsecurity
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    END LOOP;
END $$;

-- 2) Retrait des privilèges déjà accordés aux rôles de l'API Data.
--    La RLS seule suffit à bloquer les lignes ; ce revoke ferme aussi la
--    découverte de schéma et les séquences.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
        EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';
        EXECUTE 'REVOKE USAGE ON SCHEMA public FROM anon, authenticated';
    END IF;
END $$;

-- 3) Cause racine : couper le ALTER DEFAULT PRIVILEGES de Supabase, sinon la
--    prochaine table créée par une migration Prisma est ré-exposée aussitôt.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
        EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
        EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
    END IF;
END $$;
