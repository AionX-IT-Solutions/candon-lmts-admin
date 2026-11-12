-- =============================================================================
-- Developer role: full access like Admin, and only Developers can create, change or delete
-- Developer accounts (enforced by the admin-users Edge Function).
-- On its own because a new enum value can't be used in the transaction that adds it — the
-- next migration uses it.
-- =============================================================================
alter type public.user_role add value if not exists 'Developer' before 'Admin';
