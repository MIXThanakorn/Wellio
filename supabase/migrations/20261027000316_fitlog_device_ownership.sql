-- One browser push endpoint can belong to only one person, including after account changes.
create unique index push_endpoint_identity on public.push_subscriptions(endpoint);
alter table public.push_subscriptions add constraint push_owner_id unique(owner_user_id,id);
alter table public.reminder_deliveries add constraint delivery_owner_subscription
 foreign key(owner_user_id,subscription_id) references public.push_subscriptions(owner_user_id,id) on delete cascade;
