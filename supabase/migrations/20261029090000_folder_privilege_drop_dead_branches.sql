-- =============================================================================
-- Drop the dead 'Incoming'/'Addendum' branches from private.folder_privilege()
--   Judicial was cleanly retired in 20261028030000_remove_quasi_judicial.sql (table
--   dropped, folder_privilege() redefined without it, and the privilege string scrubbed
--   from every user). The later Addendum/Incoming removals (20261029010000,
--   20261029030000) only dropped their tables — this finishes the same cleanup for them:
--   redefine the function without their branches, and scrub the now-meaningless privilege
--   strings off every user who still has them. Nothing in either app ever calls
--   folder_privilege() directly or uploads to these folders anymore (confirmed by sweeping
--   both repos' source), so this is a pure no-op for anyone actually using the app today.
-- =============================================================================

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
    when 'BrgyActions' then 'Barangay Actions'
    when 'Review' then 'Barangay Review'
    when 'CommitteeReports' then 'Committee Reports'
    when 'otherMatters' then 'Other Matters'
    when 'tricycle' then 'Tricycle Franchise'
    when 'Users' then 'Account Management'
    when 'Officials' then 'S.P Members'
    when 'SessionMinutes' then 'Session Minutes'
    when 'CommitteeReferrals' then 'Committee Referrals'
    when 'CommitteeTranscripts' then 'Committee Transcripts'
    when 'PublicHearingMinutes' then 'Public Hearing Minutes'
    else null
  end;
$$;

update public.users
set privileges = array_remove(array_remove(privileges, 'Incoming'), 'Addendum and Corrections')
where 'Incoming' = any (privileges) or 'Addendum and Corrections' = any (privileges);
