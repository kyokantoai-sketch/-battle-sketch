-- Migration for existing schema (rooms/characters/battles)
-- Adds columns used by the app without dropping existing data.

alter table rooms add column if not exists code text;
alter table rooms add column if not exists pass_hash text;
alter table rooms add column if not exists max_char_length integer;
alter table rooms add column if not exists story_min_length integer;
alter table rooms add column if not exists story_max_length integer;
alter table rooms alter column max_char_length set default 50;
alter table rooms alter column story_min_length set default 300;
alter table rooms alter column story_max_length set default 500;
alter table rooms add column if not exists battle_status text;
alter table rooms add column if not exists battle_started_at timestamptz;

create unique index if not exists rooms_code_key on rooms (code);

alter table characters add column if not exists slot integer;
alter table characters add column if not exists style_id text;
alter table characters add column if not exists style_label text;
alter table characters add column if not exists image_path text;
alter table characters add column if not exists attack integer;
alter table characters add column if not exists defense integer;
alter table characters add column if not exists magic integer;
alter table characters add column if not exists mana integer;
alter table characters add column if not exists speed integer;
alter table characters add column if not exists summary text;
alter table characters add column if not exists is_editing boolean;
alter table characters alter column is_editing set default false;

alter table battles add column if not exists winner_slot integer;
alter table battles add column if not exists winner_id uuid;
alter table battles add column if not exists battle_image_path text;
alter table battles add column if not exists battle_image_url text;
alter table battles add column if not exists result_image_path text;
alter table battles add column if not exists result_image_url text;

create table if not exists room_slots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  slot integer not null,
  token text not null,
  created_at timestamptz not null default now(),
  unique (room_id, slot),
  unique (room_id, token)
);

create index if not exists characters_room_id_idx on characters(room_id);
create index if not exists characters_created_at_idx on characters(created_at desc);
create index if not exists battles_room_id_idx on battles(room_id);
create index if not exists room_slots_room_id_idx on room_slots(room_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_room_id_fkey'
  ) THEN
    ALTER TABLE characters
      ADD CONSTRAINT characters_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_slot_check'
  ) THEN
    ALTER TABLE characters
      ADD CONSTRAINT characters_slot_check CHECK (slot IN (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_room_slot_key'
  ) THEN
    ALTER TABLE characters
      ADD CONSTRAINT characters_room_slot_key UNIQUE (room_id, slot);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battles_room_id_fkey'
  ) THEN
    ALTER TABLE battles
      ADD CONSTRAINT battles_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battles_winner_slot_check'
  ) THEN
    ALTER TABLE battles
      ADD CONSTRAINT battles_winner_slot_check CHECK (winner_slot IN (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'room_slots_slot_check'
  ) THEN
    ALTER TABLE room_slots
      ADD CONSTRAINT room_slots_slot_check CHECK (slot IN (1, 2));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battles_room_id_key'
  ) THEN
    ALTER TABLE battles
      ADD CONSTRAINT battles_room_id_key UNIQUE (room_id);
  END IF;
END $$;

