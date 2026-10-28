-- Keep rows (and their photo references) while the user can undo a deletion.
alter table public.meal_entries add column deleted_at timestamptz;
alter table public.activity_entries add column deleted_at timestamptz;
alter table public.water_entries add column deleted_at timestamptz;
alter table public.weight_checkins add column deleted_at timestamptz;
create index meal_trash_expiry on public.meal_entries(deleted_at) where deleted_at is not null;
create index activity_trash_expiry on public.activity_entries(deleted_at) where deleted_at is not null;
create index water_trash_expiry on public.water_entries(deleted_at) where deleted_at is not null;
create index weight_trash_expiry on public.weight_checkins(deleted_at) where deleted_at is not null;
alter table public.weight_checkins drop constraint weight_checkins_owner_user_id_checkin_date_key;
create unique index weight_checkins_active_day on public.weight_checkins(owner_user_id,checkin_date) where deleted_at is null;
-- Existing owner policies cover SELECT/UPDATE/DELETE including restore; no new public privilege.
create function public.purge_expired_journal_entries() returns void language plpgsql security invoker set search_path='' as $$
begin
 delete from public.meal_entries where deleted_at < now()-interval '24 hours';
 delete from public.activity_entries where deleted_at < now()-interval '24 hours';
 delete from public.water_entries where deleted_at < now()-interval '24 hours';
 delete from public.weight_checkins where deleted_at < now()-interval '24 hours';
end; $$;
revoke all on function public.purge_expired_journal_entries() from public,anon,authenticated;
grant execute on function public.purge_expired_journal_entries() to service_role;
