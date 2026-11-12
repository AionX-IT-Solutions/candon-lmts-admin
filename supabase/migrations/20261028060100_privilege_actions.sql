-- =============================================================================
-- Privileges per action: each module can be given View / Add / Edit / Delete.
--   • users.privileges holds '<Module>:<action>' (e.g. 'Ordinances:edit'). A bare '<Module>'
--     saved by older builds still means every action.
--   • private.can(module, action) replaces private.has_privilege(privilege):
--       Developer and Admin can do everything, Pending nothing, View Only only views.
--   • Writes are checked per action (insert → add, update → edit, delete → delete). Reading
--     stays open to every member because modules share data (committees ↔ officials, terms…),
--     so View decides what the apps show.
-- The apps mirror these rules in lib/permissions.ts (candon-lmts-admin) and the admin-users function.
-- =============================================================================

create or replace function private.can(module text, action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and (
        u.role::text in ('Developer', 'Admin')
        or (
          u.role::text <> 'Pending'
          and (action = 'view' or u.role::text <> 'View Only')
          and ((module || ':' || action) = any (u.privileges) or module = any (u.privileges))
        )
      )
  );
$$;

revoke all on function private.can(text, text) from public;
grant execute on function private.can(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Module tables: insert → add, update → edit, delete → delete
-- (edited_corrections keeps "members can update"; activity_logs stays append-only)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('ordinances', 'Ordinances', 'standard'),
      ('resolutions', 'Resolutions', 'standard'),
      ('draft_ordinances', 'Draft Ordinance/s and Draft Resolutions', 'standard'),
      ('draft_resolutions', 'Draft Ordinance/s and Draft Resolutions', 'standard'),
      ('minutes', 'Calendar of Business', 'standard'),
      ('transcripts', 'Transcript of Proceedings', 'standard'),
      ('communications', 'Other Communications', 'standard'),
      ('incoming_communications', 'Incoming', 'standard'),
      ('brgy_actions', 'Barangay Actions', 'standard'),
      ('brgy_reviews', 'Barangay Review', 'standard'),
      ('committees', 'Standing Committees', 'standard'),
      ('committee_reports', 'Committee Reports', 'standard'),
      ('corrections', 'Addendum and Corrections', 'standard'),
      ('edited_corrections', 'Addendum and Corrections', 'member-update'),
      ('other_matters', 'Other Matters', 'standard'),
      ('tricycle_franchises', 'Tricycle Franchise', 'standard'),
      ('officials', 'S.P Members', 'standard'),
      ('terms', 'S.P Members', 'standard')
    ) as v(tbl, module, mode)
  loop
    execute format('drop policy if exists "privileged can insert" on public.%I', t.tbl);
    execute format('drop policy if exists "privileged can update" on public.%I', t.tbl);
    execute format('drop policy if exists "privileged can delete" on public.%I', t.tbl);

    execute format(
      'create policy "privileged can insert" on public.%I for insert to authenticated with check (private.can(%L, ''add''))',
      t.tbl, t.module
    );
    if t.mode <> 'member-update' then
      execute format(
        'create policy "privileged can update" on public.%I for update to authenticated using (private.can(%L, ''edit'')) with check (private.can(%L, ''edit''))',
        t.tbl, t.module, t.module
      );
    end if;
    execute format(
      'create policy "privileged can delete" on public.%I for delete to authenticated using (private.can(%L, ''delete''))',
      t.tbl, t.module
    );
  end loop;
end
$$;

-- Accounts: your own row, or everyone's with Account Management → View
drop policy if exists "read own row or manage accounts" on public.users;
create policy "read own row or manage accounts" on public.users
  for select to authenticated
  using (id = (select auth.uid()) or private.can('Account Management', 'view'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage (documents bucket): uploading happens when adding or editing a record, and editing
-- replaces the old file, so it may remove files too.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "documents: privileged can upload" on storage.objects;
create policy "documents: privileged can upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      private.can(private.folder_privilege((storage.foldername(name))[1]), 'add')
      or private.can(private.folder_privilege((storage.foldername(name))[1]), 'edit')
    )
  );

drop policy if exists "documents: privileged can update" on storage.objects;
create policy "documents: privileged can update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and private.can(private.folder_privilege((storage.foldername(name))[1]), 'edit')
  )
  with check (
    bucket_id = 'documents'
    and private.can(private.folder_privilege((storage.foldername(name))[1]), 'edit')
  );

drop policy if exists "documents: privileged can delete" on storage.objects;
create policy "documents: privileged can delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      private.can(private.folder_privilege((storage.foldername(name))[1]), 'edit')
      or private.can(private.folder_privilege((storage.foldername(name))[1]), 'delete')
    )
  );

-- Every policy now uses private.can(); this fails loudly if one was missed.
drop function if exists private.has_privilege(text);

-- ─────────────────────────────────────────────────────────────────────────────
-- Data
-- ─────────────────────────────────────────────────────────────────────────────
-- Bare module names from older builds → every action of that module
update public.users u
set privileges = (
  select coalesce(array_agg(distinct n.priv order by n.priv), '{}')
  from unnest(u.privileges) as old(name)
  cross join lateral unnest(
    case
      when old.name like '%:%' then array[old.name]
      when old.name = 'Send File to Email' then array[old.name || ':view']
      else array[
        old.name || ':view', old.name || ':add', old.name || ':edit', old.name || ':delete'
      ]
    end
  ) as n(priv)
)
where exists (select 1 from unnest(u.privileges) as p(name) where p.name not like '%:%');

-- The AionX super admin becomes the first Developer (only a Developer can make more)
update public.users u
set role = 'Developer'
from auth.users a
where a.id = u.id
  and lower(a.email) = 'adolfotristanjames@gmail.com'
  and u.role = 'Admin';
