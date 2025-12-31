create extension if not exists "pgcrypto";

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text,
  art_style text,
  pass_hash text not null,
  max_char_length integer not null default 50,
  story_min_length integer not null default 300,
  story_max_length integer not null default 500,
  battle_status text,
  battle_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  slot integer not null check (slot in (1, 2)),
  player_name text not null,
  description text not null,
  style_id text,
  style_label text,
  image_path text,
  image_url text,
  created_at timestamptz not null default now(),
  unique (room_id, slot)
);

create table if not exists battles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  winner_slot integer not null check (winner_slot in (1, 2)),
  winner_id uuid,
  story text not null,
  battle_image_path text,
  battle_image_url text,
  result_image_path text,
  result_image_url text,
  created_at timestamptz not null default now(),
  unique (room_id)
);

create table if not exists room_slots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  slot integer not null check (slot in (1, 2)),
  token text not null,
  created_at timestamptz not null default now(),
  unique (room_id, slot),
  unique (room_id, token)
);

create index if not exists characters_room_id_idx on characters(room_id);
create index if not exists characters_created_at_idx on characters(created_at desc);
create index if not exists battles_room_id_idx on battles(room_id);
create index if not exists room_slots_room_id_idx on room_slots(room_id);

