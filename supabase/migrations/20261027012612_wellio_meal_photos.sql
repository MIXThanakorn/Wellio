alter table public.meal_entries add column photo_path text;
alter table public.meal_entries add constraint meal_photo_owned_path check (
 photo_path is null or (photo_path like owner_user_id::text||'/%' and photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
);
create index meal_photo_reference on public.meal_entries(photo_path) where photo_path is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('meal-photos','meal-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy meal_photo_read on storage.objects for select to authenticated
using(bucket_id='meal-photos' and (storage.foldername(name))[1]=(select auth.uid()::text)
 and exists(select 1 from public.profiles where user_id=(select auth.uid())));
create policy meal_photo_upload on storage.objects for insert to authenticated
with check(bucket_id='meal-photos' and (storage.foldername(name))[1]=(select auth.uid()::text)
 and array_length(storage.foldername(name),1)=1 and storage.filename(name) ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'
 and exists(select 1 from public.profiles where user_id=(select auth.uid())));
create policy meal_photo_remove on storage.objects for delete to authenticated
using(bucket_id='meal-photos' and (storage.foldername(name))[1]=(select auth.uid()::text)
 and exists(select 1 from public.profiles where user_id=(select auth.uid())));

-- Storage binaries must be removed through the Storage API, never by deleting SQL metadata.
-- Queue paths when a meal is deleted/replaced, including clear_my_journal and account cascades.
create table public.meal_photo_cleanup (
 photo_path text primary key,
 owner_user_id uuid not null,
 queued_at timestamptz not null default now(),
 check(photo_path like owner_user_id::text||'/%' and photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
);
create index meal_photo_cleanup_owner on public.meal_photo_cleanup(owner_user_id);
create index meal_photo_cleanup_time on public.meal_photo_cleanup(queued_at);
alter table public.meal_photo_cleanup enable row level security;
revoke all on public.meal_photo_cleanup from anon,authenticated;
grant select,insert on public.meal_photo_cleanup to authenticated;
grant all on public.meal_photo_cleanup to service_role;
create policy photo_cleanup_read on public.meal_photo_cleanup for select to authenticated using((select auth.uid())=owner_user_id);
create policy photo_cleanup_queue on public.meal_photo_cleanup for insert to authenticated with check((select auth.uid())=owner_user_id);

create function private.queue_replaced_meal_photo() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.photo_path is not null and (TG_OP='DELETE' or new.photo_path is distinct from old.photo_path) then
  insert into public.meal_photo_cleanup(photo_path,owner_user_id) values(old.photo_path,old.owner_user_id) on conflict(photo_path) do nothing;
 end if;
 return null;
end; $$;
revoke all on function private.queue_replaced_meal_photo() from public,anon,authenticated;
create trigger queue_meal_photo_cleanup after delete or update of photo_path on public.meal_entries
for each row execute function private.queue_replaced_meal_photo();

create function public.pending_meal_photo_cleanup() returns table(photo_path text) language sql security invoker set search_path='' as $$
 select q.photo_path from public.meal_photo_cleanup q
 where not exists(select 1 from public.meal_entries m where m.photo_path=q.photo_path)
 order by q.queued_at limit 100;
$$;
create function public.complete_meal_photo_cleanup(p_paths text[]) returns void language sql security invoker set search_path='' as $$
 delete from public.meal_photo_cleanup where photo_path=any(p_paths);
$$;
revoke all on function public.pending_meal_photo_cleanup(),public.complete_meal_photo_cleanup(text[]) from public,anon,authenticated;
grant execute on function public.pending_meal_photo_cleanup(),public.complete_meal_photo_cleanup(text[]) to service_role;
