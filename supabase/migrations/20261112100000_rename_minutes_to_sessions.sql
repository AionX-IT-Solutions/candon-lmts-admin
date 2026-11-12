-- =============================================================================
-- Rename public.minutes → public.sessions
--   The table holds the Order of Business sessions (Regular / Special Session); the Session
--   Minutes module has its own table (session_minutes), so "minutes" was misleading.
--   • Row level security policies, triggers, grants, realtime publication and the term_id
--     foreign key move with the table; its indexes and constraints are renamed to match.
--   • public.minutes stays behind as a view over public.sessions, so LMTS Admin and mobile builds
--     released before this change keep reading and writing sessions (same row level security —
--     security_invoker). Realtime events only come from the table, so those older builds stop
--     refreshing live. Once every install is updated:  drop view if exists public.minutes;
--   • list_documents_page takes 'sessions' (and still 'minutes', for those older builds).
--   • Session PDFs keep their storage folder (minutes/…) — only the table is renamed.
-- Mirror the rename in TABLE_COLUMNS (lib/db/schema.ts) of candon-lmts-admin and candon-app, and
-- deploy the notify-users function (it accepts both names).
-- Re-running this file is safe.
-- =============================================================================

do $$
begin
  if to_regclass('public.sessions') is null then
    alter table public.minutes rename to sessions;
  end if;
end
$$;

alter index if exists public.minutes_pkey rename to sessions_pkey;
alter index if exists public.minutes_session_no_idx rename to sessions_session_no_idx;
alter index if exists public.minutes_category_idx rename to sessions_category_idx;
alter index if exists public.minutes_term_id_idx rename to sessions_term_id_idx;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.sessions'::regclass and conname = 'minutes_term_id_fkey'
  ) then
    alter table public.sessions rename constraint minutes_term_id_fkey to sessions_term_id_fkey;
  end if;
end
$$;

-- Old name, for builds released before the rename. A plain single-table view, so PostgreSQL
-- passes inserts, updates and deletes through to public.sessions (with its column defaults).
create or replace view public.minutes
  with (security_invoker = true)
  as select * from public.sessions;

comment on view public.minutes is
  'Deprecated: the old name of public.sessions, kept for LMTS Admin / mobile builds released '
  'before the rename. Drop it once every install is updated.';

revoke all on public.minutes from anon;
grant select, insert, update, delete on public.minutes to authenticated;
grant all on public.minutes to service_role;

-- Same as 20261112090000_list_documents_page.sql, reading public.sessions; 'minutes' still works.
create or replace function public.list_documents_page(
  p_table text,
  p_category text default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_search text default null,
  p_search_columns text[] default '{}',
  p_search_extra text[] default '{}',
  p_search_term_name boolean default false
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  -- Newest council term first (start date, then end date, blank dates after filled ones), then
  -- records without a term — the order of the Terms list.
  by_term constant text :=
    '(t.id is null), nullif(t.start_date, '''') desc nulls last, '
    || 'nullif(t.end_date, '''') desc nulls last, t.name, t.id';
  by_session constant text :=
    'public.session_no_sort_key(d.session_no) desc, d.session_no desc nulls last';
  -- Builds released before the rename ask for 'minutes'.
  table_name constant text := case when p_table = 'minutes' then 'sessions' else p_table end;
  order_by text;
  term_join text := '';
  filters text[] := '{}';
  where_clause text := '';
  matches text[] := '{}';
  search_pattern text;
  field text;
  result jsonb;
begin
  order_by := case table_name
    when 'sessions' then by_term || ', ' || by_session
    when 'draft_ordinances' then by_session
    when 'draft_resolutions' then by_session
    when 'committee_transcripts' then by_term || ', d.date desc nulls last'
    when 'public_hearing_minutes' then by_term || ', d.date desc nulls last'
    when 'committees' then by_term || ', d.title asc nulls last'
  end;
  if order_by is null then
    raise exception 'list_documents_page: unsupported table %', p_table;
  end if;

  if table_name not in ('draft_ordinances', 'draft_resolutions') then
    term_join := 'left join public.terms t on t.id = d.term_id';
  end if;
  if p_category is not null then
    filters := filters || 'd.category = $1'::text;
  end if;

  if nullif(trim(p_search), '') is not null then
    -- Literal "contains": escape LIKE's wildcards and its escape character.
    search_pattern := '%' || replace(replace(replace(trim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
    -- Column names are quoted as identifiers (%I) and keys as literals (%L), so they can't
    -- inject SQL; a misspelt column just errors. ::text also covers dates and arrays.
    foreach field in array coalesce(p_search_columns, '{}') loop
      matches := matches || format('d.%I::text ilike $4', field);
    end loop;
    foreach field in array coalesce(p_search_extra, '{}') loop
      matches := matches || format('(d.extra ->> %L) ilike $4', field);
    end loop;
    if p_search_term_name and term_join <> '' then
      matches := matches || 't.name ilike $4'::text;
    end if;
    -- Nothing to search in: no row matches.
    filters := filters || case
      when cardinality(matches) = 0 then 'false'
      else '(' || array_to_string(matches, ' or ') || ')'
    end;
  end if;

  if cardinality(filters) > 0 then
    where_clause := 'where ' || array_to_string(filters, ' and ');
  end if;

  -- d.id last everywhere: a stable tie-break, so pages never overlap or skip rows.
  execute format(
    $sql$
      select jsonb_build_object(
        'total', (select count(*) from public.%1$I d %2$s %3$s),
        'rows', coalesce(
          (
            select jsonb_agg(page.row order by page.position)
            from (
              select to_jsonb(d) as row,
                     row_number() over (order by %4$s, d.id) as position
              from public.%1$I d
              %2$s
              %3$s
              order by %4$s, d.id
              limit $2 offset $3
            ) as page
          ),
          '[]'::jsonb
        )
      )
    $sql$,
    table_name, term_join, where_clause, order_by
  )
  into result
  using p_category, least(greatest(p_limit, 0), 1000), greatest(p_offset, 0), search_pattern;

  return result;
end;
$$;
