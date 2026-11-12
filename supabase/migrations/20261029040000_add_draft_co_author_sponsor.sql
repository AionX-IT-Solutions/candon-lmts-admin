-- Author, Co-Author and Sponsor on Draft Ordinances/Resolutions can each hold more than one
-- official or committee (not just free text), so all three become text[] arrays. `author`
-- already exists as a plain text column with real data, so it converts in place — each existing
-- value becomes a single-element array rather than being discarded.

alter table public.draft_ordinances
  alter column author type text[] using (
    case when coalesce(author, '') = '' then '{}'::text[] else array[author] end
  ),
  alter column author set default '{}',
  alter column author set not null;
alter table public.draft_ordinances add column if not exists co_author text[] not null default '{}';
alter table public.draft_ordinances add column if not exists sponsor text[] not null default '{}';

alter table public.draft_resolutions
  alter column author type text[] using (
    case when coalesce(author, '') = '' then '{}'::text[] else array[author] end
  ),
  alter column author set default '{}',
  alter column author set not null;
alter table public.draft_resolutions add column if not exists co_author text[] not null default '{}';
alter table public.draft_resolutions add column if not exists sponsor text[] not null default '{}';
