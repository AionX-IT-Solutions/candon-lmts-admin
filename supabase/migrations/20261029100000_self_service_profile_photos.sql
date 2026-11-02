-- Allow a signed-in user to update only their own profile photo.
revoke update on table public.users from public, anon, authenticated;
grant update (file_path) on table public.users to authenticated;

drop policy if exists "users can update own profile photo" on public.users;
create policy "users can update own profile photo" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (
      file_path is null
      or file_path like ('Users/' || (select auth.uid())::text || '/%')
    )
  );

-- A user may upload, replace, and remove objects only in their own Users/<uid>/ folder.
drop policy if exists "documents: privileged can upload" on storage.objects;
create policy "documents: privileged can upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      (
        (storage.foldername(name))[1] = 'Users'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or private.can(private.folder_privilege((storage.foldername(name))[1]), 'add')
      or private.can(private.folder_privilege((storage.foldername(name))[1]), 'edit')
    )
  );

drop policy if exists "documents: privileged can update" on storage.objects;
create policy "documents: privileged can update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (
      (
        (storage.foldername(name))[1] = 'Users'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or private.can(private.folder_privilege((storage.foldername(name))[1]), 'edit')
    )
  )
  with check (
    bucket_id = 'documents'
    and (
      (
        (storage.foldername(name))[1] = 'Users'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or private.can(private.folder_privilege((storage.foldername(name))[1]), 'edit')
    )
  );

drop policy if exists "documents: privileged can delete" on storage.objects;
create policy "documents: privileged can delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      (
        (storage.foldername(name))[1] = 'Users'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or private.can(private.folder_privilege((storage.foldername(name))[1]), 'edit')
      or private.can(private.folder_privilege((storage.foldername(name))[1]), 'delete')
    )
  );
