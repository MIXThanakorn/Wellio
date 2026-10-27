-- Exactly two approved identities; populated by the admin invitation script, never by a client.
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 slug text not null unique check (slug in ('mix','name')),
 display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
 timezone text not null default 'Asia/Bangkok' check (timezone = 'Asia/Bangkok'),
 water_goal_ml integer check (water_goal_ml between 1 and 10000),
 hide_weight boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.meal_entries (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 eaten_at timestamptz not null check (eaten_at <= now() + interval '5 minutes'),
 meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack','other')),
 name text not null check (char_length(btrim(name)) between 1 and 200),
 portion_text text check (char_length(portion_text)<=200), notes text check (char_length(notes)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activity_entries (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 started_at timestamptz not null check (started_at <= now() + interval '5 minutes'),
 activity_type text not null check (activity_type in ('walking','cycling','stretching','strength','other')),
 duration_minutes integer not null check (duration_minutes between 1 and 1440),
 effort text check (effort in ('light','moderate','vigorous')), notes text check (char_length(notes)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.weight_checkins (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 checkin_date date not null check (checkin_date <= (now() at time zone 'Asia/Bangkok')::date),
 weight_kg numeric(6,2) not null check (weight_kg > 0 and weight_kg <= 1000), notes text check (char_length(notes)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_user_id,checkin_date)
);
create table public.water_entries (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 consumed_at timestamptz not null check (consumed_at <= now() + interval '5 minutes'), amount_ml integer not null check (amount_ml between 1 and 5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.routine_plans (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 200),
 category text not null check (category in ('activity','meal','rest','sleep')),
 days_of_week integer[] not null check (cardinality(days_of_week) between 1 and 7 and days_of_week <@ array[0,1,2,3,4,5,6]),
 local_time time, duration_minutes integer check (duration_minutes between 1 and 1440), is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_user_id,id)
);
create table public.plan_completions (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 plan_id uuid not null, completed_date date not null default ((now() at time zone 'Asia/Bangkok')::date),
 completed_at timestamptz not null default now(), notes text check (char_length(notes)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(owner_user_id,plan_id) references public.routine_plans(owner_user_id,id) on delete cascade,
 unique(owner_user_id,plan_id,completed_date),
 check(completed_date <= (now() at time zone 'Asia/Bangkok')::date)
);
create table public.reminder_preferences (
 owner_user_id uuid primary key references public.profiles(user_id) on delete cascade,
 enabled boolean not null default false, meal_gap_minutes integer not null default 300 check (meal_gap_minutes between 60 and 1440),
 quiet_start time not null default '22:00', quiet_end time not null default '07:00',
 timezone text not null default 'Asia/Bangkok' check (timezone='Asia/Bangkok'), snoozed_until timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 endpoint text not null check (char_length(endpoint)<=2048 and endpoint ~ '^https://(fcm\.googleapis\.com|[a-zA-Z0-9.-]+\.push\.services\.mozilla\.com|updates\.push\.services\.mozilla\.com|[a-zA-Z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)/'),
 p256dh text not null check(char_length(p256dh) between 16 and 256), auth_secret text not null check(char_length(auth_secret) between 8 and 256),
 device_label text not null default 'อุปกรณ์ของฉัน' check(char_length(device_label)<=100), enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_user_id,endpoint)
);
create table public.favorite_meals (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 200), meal_type text not null default 'other' check (meal_type in ('breakfast','lunch','dinner','snack','other')),
 portion_text text check (char_length(portion_text)<=200), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_user_id,name)
);
-- Server-only delivery ledger: unique interval + device prevents overlapping jobs spamming a device.
create table public.reminder_deliveries (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.reminder_preferences(owner_user_id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 last_meal_at timestamptz not null, status text not null default 'sending' check(status in ('sending','sent','failed')),
 attempts integer not null default 1, claimed_at timestamptz not null default now(), sent_at timestamptz,
 unique(subscription_id,last_meal_at)
);
create index meal_owner_time on public.meal_entries(owner_user_id,eaten_at desc);
create index activity_owner_time on public.activity_entries(owner_user_id,started_at desc);
create index weight_owner_date on public.weight_checkins(owner_user_id,checkin_date desc);
create index water_owner_time on public.water_entries(owner_user_id,consumed_at desc);
create index completion_plan_fk on public.plan_completions(owner_user_id,plan_id);
create index completion_owner_date on public.plan_completions(owner_user_id,completed_date desc);
create index push_owner on public.push_subscriptions(owner_user_id);
create index deliveries_owner on public.reminder_deliveries(owner_user_id);

create function public.fitlog_touch_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at=now(); return new; end;
$$;
revoke all on function public.fitlog_touch_updated_at() from public, anon, authenticated;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name,water_goal_ml,hide_weight) on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy profile_select on public.profiles for select to authenticated using ((select auth.uid())=user_id);
create policy profile_update on public.profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

do $$ declare t text; begin
 foreach t in array array['meal_entries','activity_entries','weight_checkins','water_entries','routine_plans','plan_completions','reminder_preferences','push_subscriptions','favorite_meals'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid())=owner_user_id)',t);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid())=owner_user_id)',t);
  execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid())=owner_user_id) with check ((select auth.uid())=owner_user_id)',t);
  execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid())=owner_user_id)',t);
 end loop;
 foreach t in array array['profiles','meal_entries','activity_entries','weight_checkins','water_entries','routine_plans','plan_completions','reminder_preferences','push_subscriptions','favorite_meals'] loop
  execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.fitlog_touch_updated_at()',t);
 end loop;
end $$;
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_deliveries from anon,authenticated;
grant all on public.reminder_deliveries to service_role;

-- Atomic, caller-scoped deletion; profile authorization is retained. No SECURITY DEFINER.
create function public.clear_my_journal() returns void language plpgsql security invoker set search_path='' as $$
declare uid uuid := (select auth.uid());
begin
 if uid is null then raise exception 'Authentication required'; end if;
 delete from public.reminder_preferences where owner_user_id=uid;
 delete from public.push_subscriptions where owner_user_id=uid;
 delete from public.plan_completions where owner_user_id=uid;
 delete from public.routine_plans where owner_user_id=uid;
 delete from public.favorite_meals where owner_user_id=uid;
 delete from public.water_entries where owner_user_id=uid;
 delete from public.weight_checkins where owner_user_id=uid;
 delete from public.activity_entries where owner_user_id=uid;
 delete from public.meal_entries where owner_user_id=uid;
end; $$;
revoke all on function public.clear_my_journal() from public,anon;
grant execute on function public.clear_my_journal() to authenticated;

-- Scheduler claims each delivery atomically. Retries only failed sends, with bounded backoff.
create function public.claim_reminder(p_owner uuid,p_subscription uuid,p_last_meal timestamptz) returns uuid
language plpgsql security invoker set search_path='' as $$
declare claimed uuid;
begin
 insert into public.reminder_deliveries(owner_user_id,subscription_id,last_meal_at)
 values(p_owner,p_subscription,p_last_meal)
 on conflict(subscription_id,last_meal_at) do update set status='sending',attempts=public.reminder_deliveries.attempts+1,claimed_at=now()
 where public.reminder_deliveries.status='failed' and public.reminder_deliveries.attempts<3 and public.reminder_deliveries.claimed_at<now()-interval '15 minutes'
 returning id into claimed;
 return claimed;
end; $$;
revoke all on function public.claim_reminder(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_reminder(uuid,uuid,timestamptz) to service_role;
