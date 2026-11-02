-- =============================================================================
-- S.P Officials organization chart
--   • officials.reports_to_id — who each official reports to (the chart's lines)
--   • officials.file_path     — optional photo, stored in the documents bucket under Officials/
-- Mirror new columns in TABLE_COLUMNS (lib/db/schema.ts) of candon-lmts-admin and candon-app.
-- =============================================================================

alter table public.officials
  add column if not exists reports_to_id uuid references public.officials (id) on delete set null,
  add column if not exists file_path text;

create index if not exists officials_reports_to_id_idx on public.officials (reports_to_id);

-- Photos go into the 'Officials' storage folder, writable with the 'S.P Members' privilege
-- (same as the officials table). Same list as the init migration plus that folder.
create or replace function private.folder_privilege(folder text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case folder
    when 'GeneralOrdinances' then 'Ordinances'
    when 'Resolutions' then 'Resolutions'
    when 'DraftOrdinances' then 'Draft Ordinance/s and Draft Resolutions'
    when 'DraftResolutions' then 'Draft Ordinance/s and Draft Resolutions'
    when 'minutes' then 'Calendar of Business'
    when 'TranscriptOfProceedings' then 'Transcript of Proceedings'
    when 'OtherCommunications' then 'Other Communications'
    when 'Incoming' then 'Incoming'
    when 'BrgyActions' then 'Barangay Actions'
    when 'Review' then 'Barangay Review'
    when 'CommitteeReports' then 'Committee Reports'
    when 'Judicial' then 'Quasi-Judicial Function'
    when 'Addendum' then 'Addendum and Corrections'
    when 'otherMatters' then 'Other Matters'
    when 'tricycle' then 'Tricycle Franchise'
    when 'Users' then 'Account Management'
    when 'Officials' then 'S.P Members'
    else null
  end;
$$;
