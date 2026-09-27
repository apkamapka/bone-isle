-- =============================================================================
-- Xebeka, etap 1.3: characters.
--
-- Paste the whole file into Supabase -> SQL Editor -> New query -> Run.
-- Safe to run again: every statement is idempotent.
--
-- The project was created with "Automatically expose new tables" OFF, so
-- nothing here reaches the Data API unless it is granted below, by name.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- private: lists the API never sees. Edit them in Table Editor (schema
-- "private"); lowercase only.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Whole names nobody may take: creatures, NPCs, the Time Sage.
create table if not exists private.reserved_names (
  name_lower text primary key check (name_lower = lower(name_lower))
);

-- A name is refused if ANY of its words is one of these.
create table if not exists private.blocked_words (
  word text primary key check (word = lower(word))
);

-- A name is refused if it CONTAINS one of these anywhere, spaces ignored.
-- Only roots that never occur inside an innocent name belong here: "ass"
-- would refuse Assassin, so it lives in blocked_words instead.
create table if not exists private.blocked_fragments (
  fragment text primary key check (fragment = lower(fragment))
);

alter table private.reserved_names    enable row level security;
alter table private.blocked_words     enable row level security;
alter table private.blocked_fragments enable row level security;

insert into private.reserved_names (name_lower) values
  -- creatures
  ('beggar'), ('vagrant'), ('thief'), ('poacher'), ('bandit'), ('smuggler'),
  ('cutthroat'), ('deserter'), ('brigand'), ('highwayman'), ('robin redcap'),
  ('karr'), ('karr the old'), ('black annis'), ('asterion'), ('gorak'),
  ('snake'), ('skeleton'), ('goblin'), ('mercenary'), ('corsair'),
  ('wild warrior'), ('viking'), ('ghoul'), ('orc'), ('goblin legionary'),
  ('amazon'), ('orc archer'), ('hunter'), ('orc warrior'), ('minotaur'),
  ('skeleton warrior'), ('gladiator'), ('minotaur archer'), ('barbarian'),
  ('orc shaman'), ('raider'), ('orc berserker'), ('minotaur guard'),
  ('warlord'), ('minotaur mage'), ('chieftain'), ('demon skeleton'),
  ('dragon'), ('black knight'),
  -- NPCs
  ('chester'), ('hildegard'), ('kruk'), ('grizelda'), ('vito'), ('morgan'),
  ('chronos'), ('time sage')
on conflict do nothing;

insert into private.blocked_words (word) values
  -- staff and the game itself
  ('admin'), ('administrator'), ('gm'), ('cm'), ('god'), ('gamemaster'),
  ('mod'), ('moderator'), ('support'), ('staff'), ('tutor'), ('official'),
  ('system'), ('server'), ('owner'), ('dev'), ('developer'), ('xebeka'),
  -- English
  ('ass'), ('arse'), ('dick'), ('cock'), ('tit'), ('tits'), ('slut'),
  ('bastard'), ('prick'), ('piss'), ('nazi'), ('rape'), ('rapist'), ('spic'),
  ('chink'), ('kike'), ('dyke'), ('fag'), ('cum'), ('anal'), ('penis'),
  ('vagina'), ('pussy'), ('boobs'), ('sex'),
  -- Polish
  ('huj'), ('cipa'), ('dupa'), ('dupek'), ('szmata'), ('dziwka'), ('ciota'),
  ('pedal'), ('zjeb'), ('cwel'), ('fiut'), ('debil'),
  -- Spanish
  ('puta'), ('puto'), ('joder'), ('cabron'), ('verga'), ('polla'), ('culo'),
  ('marica'), ('zorra'), ('pinche'), ('carajo'), ('chingar'), ('chingada'),
  -- Portuguese
  ('porra'), ('cu'), ('foda'), ('foder'), ('merda'), ('viado'), ('cacete'),
  ('piroca'), ('pica'), ('rola'), ('xoxota'), ('bosta'), ('otario'),
  ('vadia'), ('corno'), ('arrombado')
on conflict do nothing;

insert into private.blocked_fragments (fragment) values
  ('fuck'), ('cunt'), ('nigg'), ('fagg'), ('whore'), ('bitch'), ('wank'),
  ('shit'), ('twat'), ('porn'), ('retard'), ('hitler'),
  ('kurw'), ('jeban'), ('jebac'), ('jebie'), ('pierdol'), ('chuj'), ('pizd'),
  ('kutas'),
  ('mierd'), ('pendej'), ('maricon'), ('gilipoll'), ('hijoputa'),
  ('caralh'), ('bucet'), ('fodase'), ('filhodaput')
on conflict do nothing;


-- -----------------------------------------------------------------------------
-- characters: one row per character, the save rides along as JSON.
-- -----------------------------------------------------------------------------
create table if not exists public.characters (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  name       text not null,
  sex        text not null check (sex in ('male', 'female')),
  -- One world at launch; the shard key is here from day one.
  world      smallint not null default 1,
  -- Null until the game writes the first save.
  save       jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set by schedule_character_deletion(); the row is gone after this moment.
  delete_at  timestamptz,
  constraint characters_name_format check (
    char_length(name) between 3 and 20
    and name ~ '^[A-Z][a-z]+( [A-Z][a-z]+){0,2}$'
  ),
  -- A save is a few KB; 1 MB stops anyone filling the database by hand.
  constraint characters_save_size check (
    save is null or octet_length(save::text) <= 1048576
  )
);

-- Names are unique regardless of case: Radek and RADEK are one name.
create unique index if not exists characters_name_unique
  on public.characters (lower(name));
create index if not exists characters_user_idx
  on public.characters (user_id);
create index if not exists characters_delete_at_idx
  on public.characters (delete_at) where delete_at is not null;

create or replace function private.characters_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists characters_touch on public.characters;
create trigger characters_touch
  before update on public.characters
  for each row execute function private.characters_touch();


-- -----------------------------------------------------------------------------
-- Who may do what. A player sees only their own characters, and a character
-- whose deletion date has passed is invisible even before the purge runs.
-- The only column a player writes directly is the save; creating, deleting
-- and cancelling go through the functions below.
-- -----------------------------------------------------------------------------
alter table public.characters enable row level security;

drop policy if exists characters_select_own on public.characters;
create policy characters_select_own on public.characters
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (delete_at is null or delete_at > now())
  );

drop policy if exists characters_update_own on public.characters;
create policy characters_update_own on public.characters
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and (delete_at is null or delete_at > now())
  )
  with check (user_id = (select auth.uid()));

revoke all on table public.characters from public, anon, authenticated;
grant select on table public.characters to authenticated;
grant update (save) on table public.characters to authenticated;


-- -----------------------------------------------------------------------------
-- create_character(name, sex)
--
-- Spaces are trimmed and collapsed, then every word gets a capital first
-- letter and lowercase rest ("  rADEK  the brave" -> "Radek The Brave").
-- Errors are raised as keys the website turns into sentences:
--   NOT_AUTHENTICATED, BAD_SEX, NAME_LENGTH, NAME_CHARS, NAME_WORDS,
--   NAME_BLOCKED, NAME_TAKEN, CHAR_LIMIT
-- -----------------------------------------------------------------------------
create or replace function public.create_character(p_name text, p_sex text)
returns public.characters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_row  public.characters;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_sex is null or p_sex not in ('male', 'female') then
    raise exception 'BAD_SEX';
  end if;

  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) not between 3 and 20 then
    raise exception 'NAME_LENGTH';
  end if;
  if v_name !~ '^[A-Za-z ]+$' then
    raise exception 'NAME_CHARS';
  end if;
  v_name := initcap(v_name);
  if v_name !~ '^[A-Z][a-z]+( [A-Z][a-z]+){0,2}$' then
    raise exception 'NAME_WORDS';
  end if;

  if exists (select 1 from private.reserved_names r
              where r.name_lower = lower(v_name))
     or exists (select 1 from private.blocked_words b
                 where b.word = any (string_to_array(lower(v_name), ' ')))
     or exists (select 1 from private.blocked_fragments f
                 where strpos(replace(lower(v_name), ' ', ''), f.fragment) > 0)
  then
    raise exception 'NAME_BLOCKED';
  end if;

  -- One account creates one character at a time, so two quick clicks
  -- cannot slip past the limit together.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  -- Expired deletions free their slot and their name right here, whether
  -- or not the keep-alive has run yet.
  delete from public.characters where delete_at <= now();

  if (select count(*) from public.characters where user_id = v_uid) >= 5 then
    raise exception 'CHAR_LIMIT';
  end if;

  begin
    insert into public.characters (user_id, name, sex)
    values (v_uid, v_name, p_sex)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;

  return v_row;
end
$$;


-- -----------------------------------------------------------------------------
-- Deletion is a schedule, not an act: the character goes 7 days after the
-- click, and can be taken back until then. Returns the deletion moment.
-- -----------------------------------------------------------------------------
create or replace function public.schedule_character_deletion(p_id uuid)
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
  update public.characters
     set delete_at = now() + interval '7 days'
   where id = p_id
     and user_id = auth.uid()
     and delete_at is null
  returning delete_at into v_at;
  if v_at is null then
    raise exception 'NOT_FOUND';
  end if;
  return v_at;
end
$$;

create or replace function public.cancel_character_deletion(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  update public.characters
     set delete_at = null
   where id = p_id
     and user_id = auth.uid()
     and delete_at > now();
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end
$$;


-- -----------------------------------------------------------------------------
-- purge_deleted_characters(): removes characters whose 7 days are up and
-- returns how many went. The GitHub keep-alive calls it 3 times a day, which
-- is also what keeps the Free project from being paused. Anyone may call it:
-- it only ever removes what its owner already chose to remove.
-- -----------------------------------------------------------------------------
create or replace function public.purge_deleted_characters()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.characters where delete_at <= now() returning 1
  )
  select count(*)::integer from gone;
$$;


-- Functions are executable by everyone unless revoked; open them one by one.
revoke all on function private.characters_touch()                from public, anon, authenticated;
revoke all on function public.create_character(text, text)        from public, anon, authenticated;
revoke all on function public.schedule_character_deletion(uuid)   from public, anon, authenticated;
revoke all on function public.cancel_character_deletion(uuid)     from public, anon, authenticated;
revoke all on function public.purge_deleted_characters()          from public, anon, authenticated;

grant execute on function public.create_character(text, text)      to authenticated;
grant execute on function public.schedule_character_deletion(uuid) to authenticated;
grant execute on function public.cancel_character_deletion(uuid)   to authenticated;
grant execute on function public.purge_deleted_characters()        to anon, authenticated;
