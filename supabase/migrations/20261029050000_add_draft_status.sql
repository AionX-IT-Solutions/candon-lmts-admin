-- Splits "Approved"/"Disapproved" out of the `reading` field into its own `status` field.
-- Previously a draft's `reading` doubled as its final disposition, which meant a draft marked
-- Approved no longer matched any of the 1st/2nd/3rd reading stages the mobile Order of Business
-- groups by — so it silently vanished from the agenda the moment it was approved.
--
-- Existing rows where reading already held 'Approved' or 'Disapproved' get that value copied into
-- the new status column so nothing is lost; reading itself is left as-is on those rows rather
-- than guessed at, since there's no way to recover which reading stage they were actually on.

alter table public.draft_ordinances add column if not exists status text not null default 'Pending';
update public.draft_ordinances set status = reading where reading in ('Approved', 'Disapproved');

alter table public.draft_resolutions add column if not exists status text not null default 'Pending';
update public.draft_resolutions set status = reading where reading in ('Approved', 'Disapproved');
