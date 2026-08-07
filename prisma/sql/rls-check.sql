-- Vérifications RLS — à exécuter dans le SQL Editor de Supabase.
-- Accompagne la migration 20260808000000_enable_rls_and_lock_data_api.
-- Voir tasks/lessons.md : les modifications de la DB prod passent par le SQL Editor.


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 — AVANT d'appliquer la migration (pré-vol)
-- ────────────────────────────────────────────────────────────────────────────
-- Confirme que `postgres` possède bien toutes les tables. C'est la condition
-- qui rend la migration sans danger : le propriétaire contourne la RLS.
-- Attendu : owner = 'postgres' partout, ET rls_forced = false partout.
-- Si une table a un autre propriétaire ou rls_forced = true, NE PAS appliquer
-- la migration sans investiguer : Prisma se ferait bloquer par ses propres policies.

SELECT c.relname                    AS table_name,
       pg_get_userbyid(c.relowner)  AS owner,
       c.relrowsecurity             AS rls_enabled,
       c.relforcerowsecurity        AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY 1;


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 — APRÈS avoir appliqué la migration (contrôle)
-- ────────────────────────────────────────────────────────────────────────────

-- 2a. Toutes les tables doivent avoir rls_enabled = true. Attendu : 0 ligne.
SELECT c.relname AS table_sans_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND NOT c.relrowsecurity;

-- 2b. Plus aucun privilège pour les rôles de l'API Data. Attendu : 0 ligne.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY 1, 2;

-- 2c. Aucune policy ne doit exister (deny-by-default assumé). Attendu : 0 ligne.
--     Si une policy apparaît un jour, c'est qu'on a ouvert l'API Data —
--     ce doit être une décision explicite documentée dans tasks/decisions.md.
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY 2, 3;


-- ────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 — Contrôle externe (hors SQL, depuis un terminal)
-- ────────────────────────────────────────────────────────────────────────────
-- Rejoue l'attaque décrite par Supabase avec la clé anon du projet.
-- Attendu AVANT le fix : 200 + les lignes de la table.
-- Attendu APRÈS le fix  : 401 / 404 / tableau vide — plus jamais de données.
--
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     "https://ekbwnncenxbstpfcyxwq.supabase.co/rest/v1/Session?select=accessToken&limit=1" \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"


-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK — uniquement si l'app casse après application
-- ────────────────────────────────────────────────────────────────────────────
-- Ne devrait jamais servir : Prisma se connecte en `postgres`, propriétaire des
-- tables, donc non soumis à la RLS. Gardé ici pour pouvoir revenir en 10 secondes.
--
-- DO $$
-- DECLARE t record;
-- BEGIN
--     FOR t IN SELECT c.relname FROM pg_class c
--              JOIN pg_namespace n ON n.oid = c.relnamespace
--              WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relrowsecurity
--     LOOP
--         EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.relname);
--     END LOOP;
-- END $$;
-- GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
