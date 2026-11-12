-- Lets the admin app record whether an "Other Communication" came from the LCE (Local Chief
-- Executive, i.e. the City Mayor) or elsewhere, so the mobile Order of Business can split
-- "Communications Received" into its two paper-document headings instead of one combined list.
alter table public.communications add column if not exists source text not null default 'Others';
