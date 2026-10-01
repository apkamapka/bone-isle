-- Etap 1.7: deleting an account, 7 days after the player asks, and
-- cancellable until then, the same way characters are deleted (001).
--
-- Run once in Supabase: SQL Editor, New query, paste this whole file, Run.
-- Running it again changes nothing.
--
-- While the 7 days run, the player can still log in, play and cancel. When
-- they are over, purge_deleted_accounts() removes the login itself
-- (auth.users); the characters go with it, through "on delete cascade" in
-- 001. The keep-alive workflow calls it three times a day, and so does every
-- visit to the account page.

create table if not exists private.account_deletions (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  delete_at timestamptz not null
);

alter table private.account_deletions enable row level security;

-- When this player's account is due to go, or null when it is not.
create or replace function public.account_deletion_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select d.delete_at from private.account_deletions d where d.user_id = auth.uid();
$$;

-- Asking twice keeps the first date: the 7 days are not restarted.
create or replace function public.schedule_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  insert into private.account_deletions (user_id, delete_at)
  values (auth.uid(), now() + interval '7 days')
  on conflict (user_id) do nothing;
  select d.delete_at into v_at from private.account_deletions d where d.user_id = auth.uid();
  return v_at;
end
$$;

create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  delete from private.account_deletions d
   where d.user_id = auth.uid()
     and d.delete_at > now();
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end
$$;

-- Removes every account whose 7 days are over. Harmless to call any time,
-- by anyone: it touches only accounts their owners asked to delete.
create or replace function public.purge_deleted_accounts()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from auth.users u
     using private.account_deletions d
     where d.user_id = u.id
       and d.delete_at <= now()
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on table private.account_deletions                from public, anon, authenticated;
revoke all on function public.account_deletion_at()            from public, anon, authenticated;
revoke all on function public.schedule_account_deletion()      from public, anon, authenticated;
revoke all on function public.cancel_account_deletion()        from public, anon, authenticated;
revoke all on function public.purge_deleted_accounts()         from public, anon, authenticated;

grant execute on function public.account_deletion_at()         to authenticated;
grant execute on function public.schedule_account_deletion()   to authenticated;
grant execute on function public.cancel_account_deletion()     to authenticated;
grant execute on function public.purge_deleted_accounts()      to anon, authenticated;
