-- =============================================================================
-- Server-side pages for document lists ordered by council term and/or session number
--   The mobile app (candon-lmts-app) shows Regular/Special Session, Draft Ordinances/Resolutions,
--   Hearing/Meeting Transcripts, Public Hearing Minutes and Standing Committees newest council
--   term first and/or by session number ("043-2026", "97th", "13SP_49th") compared as numbers.
--   Plain column ordering can't express that, so the app used to download whole tables to sort
--   them. public.list_documents_page sorts (and searches) in the database and returns one page
--   plus the total count (COUNT(*)), so a page costs `p_limit` rows however large the table grows.
-- Security invoker (the default): the caller's row level security still applies.
-- Read-only; no tables change.
-- =============================================================================

-- Session number as a sortable {term, year, number} key. Mirrors parseSessionNo in the mobile
-- app (src/services/documents/listService.ts), which still sorts search results client-side:
--   "043-2026"  → {0, 2026, 43}   number-year
--   "13SP_49th" → {13, 0, 49}     SP-term sessions, ahead of plain numbered ones
--   "97th"      → {0, 0, 97}      otherwise the first number found; none → {0, 0, 0}
-- Sort descending: higher term, then year, then number first.
create or replace function public.session_no_sort_key(p_session_no text)
returns numeric[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when parsed.number_year is not null
      then array[0, parsed.number_year[2]::numeric, parsed.number_year[1]::numeric]
    when parsed.sp_term is not null
      then array[parsed.sp_term[1]::numeric, 0, parsed.sp_term[2]::numeric]
    else array[0, 0, coalesce((regexp_match(parsed.value, '(\d+)'))[1]::numeric, 0)]
  end
  from (
    select
      coalesce(p_session_no, '') as value,
      regexp_match(
        coalesce(p_session_no, ''),
        '^\s*(\d+)\s*-\s*((?:19|20)\d{2})\s*$'
      ) as number_year,
      regexp_match(coalesce(p_session_no, ''), '^(\d+)\s*[-_]?\s*SP\s*[-_]?\s*(\d+)', 'i') as sp_term
  ) as parsed;
$$;

-- Earlier drafts of this migration had a 4-argument version; drop it so PostgREST sees one
-- function (re-running this file is safe).
drop function if exists public.list_documents_page(text, text, integer, integer);

-- One page of a term/session-ordered document table, in the order the mobile app displays it:
--   { "total": <rows matching>, "rows": [<table row as JSON>, ...] }
-- p_table is checked against a fixed list (it picks the table and its order); p_category filters
-- the `category` column (minutes: 'Regular Session' / 'Special Session').
-- Search: when p_search is set, only rows where any of the given columns (p_search_columns),
-- `extra` keys (p_search_extra) or — with p_search_term_name — the council term's name contains
-- it, case-insensitively, are paged and counted. The text is matched literally (% and _ too).
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
  order_by text;
  term_join text := '';
  filters text[] := '{}';
  where_clause text := '';
  matches text[] := '{}';
  search_pattern text;
  field text;
  result jsonb;
begin
  order_by := case p_table
    when 'minutes' then by_term || ', ' || by_session
    when 'draft_ordinances' then by_session
    when 'draft_resolutions' then by_session
    when 'committee_transcripts' then by_term || ', d.date desc nulls last'
    when 'public_hearing_minutes' then by_term || ', d.date desc nulls last'
    when 'committees' then by_term || ', d.title asc nulls last'
  end;
  if order_by is null then
    raise exception 'list_documents_page: unsupported table %', p_table;
  end if;

  if p_table not in ('draft_ordinances', 'draft_resolutions') then
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
    p_table, term_join, where_clause, order_by
  )
  into result
  using p_category, least(greatest(p_limit, 0), 1000), greatest(p_offset, 0), search_pattern;

  return result;
end;
$$;

revoke all on function public.session_no_sort_key(text) from public, anon;
revoke all on function public.list_documents_page(text, text, integer, integer, text, text[], text[], boolean)
  from public, anon;
grant execute on function public.session_no_sort_key(text) to authenticated;
grant execute on function public.list_documents_page(text, text, integer, integer, text, text[], text[], boolean)
  to authenticated;
