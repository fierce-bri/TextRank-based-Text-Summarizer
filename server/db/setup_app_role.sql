-- Local database account setup.
-- Run as the database administrator after creating the table.
-- Password configuration is handled separately, not stored here.

BEGIN;

CREATE ROLE textrank_app
    NOLOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS;

GRANT CONNECT ON DATABASE textrank TO textrank_app;

GRANT USAGE ON SCHEMA public TO textrank_app;

GRANT SELECT, INSERT, DELETE
    ON TABLE public.saved_summaries
    TO textrank_app;

COMMIT;