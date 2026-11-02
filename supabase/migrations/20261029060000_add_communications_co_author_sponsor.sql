-- Author, Co-Author and Sponsor on Communications can each hold more than one official or
-- committee too, matching Draft Ordinances/Resolutions. `author` already exists as plain text
-- with real data, so it converts in place rather than being dropped and recreated.

alter table public.communications
  alter column author type text[] using (
    case when coalesce(author, '') = '' then '{}'::text[] else array[author] end
  ),
  alter column author set default '{}',
  alter column author set not null;
alter table public.communications add column if not exists co_author text[] not null default '{}';
alter table public.communications add column if not exists sponsor text[] not null default '{}';
