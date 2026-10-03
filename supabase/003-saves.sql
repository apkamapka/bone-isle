-- Etap 1.10: every character keeps its own save in the database, and the
-- character list shows the world: Pandora.
--
-- Run once in Supabase: SQL Editor, New query, paste this whole file, Run.
-- Running it again changes nothing.
--
-- 001 already gave every character a world (number 1) and a column for its
-- save. This file adds:
--   1. worlds: world 1 gets its name, Pandora. A second world later is one
--      more row here (Table Editor, schema "public", table "worlds").
--   2. enter_character(): called by the game when a character is picked. It
--      hands back the save and makes this window the one place the character
--      is played from. The newest entry wins.
--   3. save_character(): the only way a save is written. A window that is no
--      longer the character's place (the character was entered elsewhere
--      since) is told so and writes nothing, so an old tab can never overwrite
--      newer progress from another device.


-- -----------------------------------------------------------------------------
-- worlds: names anyone may read (the site will list them for highscores).
-- -----------------------------------------------------------------------------
create table if not exists public.worlds (
  id         smallint primary key,
  name       text not null unique,
  created_at timestamptz not null default now(),
  constraint worlds_name_format check (name ~ '^[A-Z][a-z]+( [A-Z][a-z]+)?$')
);

insert into public.worlds (id, name) values (1, 'Pandora')
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'characters_world_fkey'
                    and conrelid = 'public.characters'::regclass) then
    alter table public.characters
      add constraint characters_world_fkey
      foreign key (world) references public.worlds (id);
  end if;
end
$$;

alter table public.worlds enable row level security;

drop policy if exists worlds_select_all on public.worlds;
create policy worlds_select_all on public.worlds
  for select to anon, authenticated
  using (true);

revoke all on table public.worlds from public, anon, authenticated;
grant select on table public.worlds to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Which window holds each character: the session handed out by its latest
-- entry. Never visible through the API.
-- -----------------------------------------------------------------------------
create table if not exists private.character_sessions (
  character_id uuid primary key references public.characters (id) on delete cascade,
  session      uuid not null,
  entered_at   timestamptz not null default now()
);

alter table private.character_sessions enable row level security;
revoke all on table private.character_sessions from public, anon, authenticated;

-- 001 let a player write the save column directly. From now on a save goes
-- only through save_character(), which checks the session first.
drop policy if exists characters_update_own on public.characters;
revoke update on table public.characters from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- enter_character(id, resume_session, resume_save)
--
-- Returns { status: 'ok', session, save } (save is null for a new character)
-- or { status: 'gone' } for a character that is not this player's, or whose
-- deletion date has passed.
--
-- resume_session and resume_save are progress this browser could not deliver
-- last time (no network, a tab closed too fast). It is kept only if nobody
-- has entered the character since; otherwise the database already holds
-- newer progress from somewhere else, and the leftover is dropped.
-- -----------------------------------------------------------------------------
create or replace function public.enter_character(
  p_id             uuid,
  p_resume_session uuid  default null,
  p_resume_save    jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_session uuid := gen_random_uuid();
  v_save    jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- The row stays locked to the end, so an entry and a save of the same
  -- character can never interleave.
  select c.save into v_save
    from public.characters c
   where c.id = p_id
     and c.user_id = v_uid
     and (c.delete_at is null or c.delete_at > now())
     for update;
  if not found then
    return jsonb_build_object('status', 'gone');
  end if;

  if p_resume_save is not null
     and jsonb_typeof(p_resume_save) = 'object'
     and exists (select 1 from private.character_sessions s
                  where s.character_id = p_id
                    and s.session = p_resume_session) then
    update public.characters set save = p_resume_save where id = p_id;
    v_save := p_resume_save;
  end if;

  insert into private.character_sessions (character_id, session, entered_at)
  values (p_id, v_session, now())
  on conflict (character_id)
  do update set session = excluded.session, entered_at = excluded.entered_at;

  return jsonb_build_object('status', 'ok', 'session', v_session, 'save', v_save);
end
$$;


-- -----------------------------------------------------------------------------
-- save_character(id, session, save)
--
-- Returns 'ok', 'elsewhere' (the character was entered from another window
-- since: nothing is written) or 'gone'. Without a save it writes nothing and
-- only answers whether this window still holds the character.
-- -----------------------------------------------------------------------------
create or replace function public.save_character(
  p_id      uuid,
  p_session uuid,
  p_save    jsonb default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_save is not null and jsonb_typeof(p_save) <> 'object' then
    raise exception 'BAD_SAVE';
  end if;

  perform 1
     from public.characters c
    where c.id = p_id
      and c.user_id = v_uid
      and (c.delete_at is null or c.delete_at > now())
      for update;
  if not found then
    return 'gone';
  end if;

  if not exists (select 1 from private.character_sessions s
                  where s.character_id = p_id
                    and s.session = p_session) then
    return 'elsewhere';
  end if;

  if p_save is not null then
    update public.characters set save = p_save where id = p_id;
  end if;
  return 'ok';
end
$$;


revoke all on function public.enter_character(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_character(uuid, uuid, jsonb)  from public, anon, authenticated;

grant execute on function public.enter_character(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_character(uuid, uuid, jsonb)  to authenticated;

-- The API picks up the new table and functions right away.
notify pgrst, 'reload schema';
