-- Removes the Incoming module (candon-lmts-admin's "Incoming" page and the mobile app's "Incoming
-- Communications" drawer screen, both removed from the apps alongside this migration).
--
-- Files previously uploaded under the "Incoming" storage folder are NOT removed by this
-- migration — clean those up manually from the documents bucket if they're no longer needed.

drop table if exists public.incoming_communications;
