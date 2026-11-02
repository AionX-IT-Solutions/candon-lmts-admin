-- =============================================================================
-- Remove the Quasi-Judicial module (its desktop page and mobile screens are gone too).
-- Dropping the table also drops its policies, trigger, indexes and realtime entry.
-- =============================================================================

drop table if exists public.judicial_cases;

-- Nobody keeps the retired privilege
update public.users
set privileges = array_remove(privileges, 'Quasi-Judicial Function')
where 'Quasi-Judicial Function' = any (privileges);

-- Storage folder rules, without the old Judicial folder
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
    when 'Addendum' then 'Addendum and Corrections'
    when 'otherMatters' then 'Other Matters'
    when 'tricycle' then 'Tricycle Franchise'
    when 'Users' then 'Account Management'
    when 'Officials' then 'S.P Members'
    else null
  end;
$$;
