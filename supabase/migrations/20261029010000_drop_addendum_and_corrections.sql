-- Removes the Addendum and Corrections module entirely. `corrections` was going to be folded
-- into `edited_corrections` by 20261029000000_merge_corrections_into_edited_corrections.sql, but
-- that migration was never applied and is now superseded — the feature itself is being removed,
-- not just consolidated, so both tables are dropped outright.
--
-- Files previously uploaded under the "Addendum" storage folder are NOT removed by this
-- migration (storage objects aren't touched by dropping a table) — clean those up manually from
-- the documents bucket in the Supabase dashboard if they're no longer needed.

drop table if exists public.corrections;
drop table if exists public.edited_corrections;
