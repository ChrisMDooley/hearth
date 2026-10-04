-- The Hearth data model as SQL (Postgres flavour). Not used yet: v1 stores the
-- same shapes in IndexedDB. Kept here so a server (e.g. Supabase) is a direct port.

create table app_user (
  id            text primary key,
  name          text not null,
  avatar_color  text not null,
  unit_system   text not null check (unit_system in ('metric','us')),
  show_original boolean not null default true,
  created_at    timestamptz not null default now()
);

create table creator (
  id       text primary key,
  name     text not null,
  kind     text not null check (kind in ('external','family','person')),
  website  text,
  blurb    text,
  user_id  text references app_user(id)
);

create table ingredient (            -- catalogue, densities for conversion
  id                 text primary key,
  name               text not null,
  aliases            text[] not null default '{}',
  grams_per_cup      numeric,
  density_confidence text check (density_confidence in ('good','rough')),
  grams_per_piece    numeric,
  liquid             boolean not null default false
);

create table photo (
  id          text primary key,
  owner_id    text not null references app_user(id),
  kind        text not null check (kind in ('recipe','bake')),
  storage_key text not null,         -- object storage path
  width int, height int,
  created_at  timestamptz not null default now()
);

create table recipe (
  id              text primary key,
  title           text not null,
  description     text,
  kind            text not null check (kind in ('mine','family','creator','adapted')),
  content_mode    text not null check (content_mode in ('full','reference')),
  creator_id      text not null references creator(id),
  source_name     text,
  source_url      text,
  source_original_title   text,
  source_original_creator text,
  visibility      text not null check (visibility in ('shared','private')),
  owner_id        text not null references app_user(id),
  category        text not null,
  tags            text[] not null default '{}',
  prep_minutes    int, bake_minutes int, total_minutes int,
  yield_amount    numeric, yield_unit text,
  oven_value      int, oven_unit char(1), oven_note text,
  equipment       text[] not null default '{}',
  recipe_notes    text,
  hero_photo_id   text references photo(id),
  art             text not null,
  created_by      text not null references app_user(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table recipe_ingredient (
  id            text primary key,
  recipe_id     text not null references recipe(id) on delete cascade,
  position      int not null,
  ingredient_id text references ingredient(id),
  name          text not null,
  amount        numeric, amount_max numeric, unit text,
  note          text,
  group_name    text,
  optional      boolean not null default false
);

create table recipe_step (
  id         text primary key,
  recipe_id  text not null references recipe(id) on delete cascade,
  position   int not null,
  text       text not null,
  group_name text
);

create table collection (
  id          text primary key,
  name        text not null,
  owner_id    text references app_user(id),   -- null = built-in
  description text,
  sort        int not null default 0
);

create table recipe_collection (
  recipe_id     text references recipe(id) on delete cascade,
  collection_id text references collection(id) on delete cascade,
  primary key (recipe_id, collection_id)
);

-- per-user data ------------------------------------------------------------

create table favorite (
  user_id    text references app_user(id) on delete cascade,
  recipe_id  text references recipe(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table user_recipe_note (
  id         text primary key,
  user_id    text not null references app_user(id) on delete cascade,
  recipe_id  text not null references recipe(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bake_entry (
  id            text primary key,
  user_id       text not null references app_user(id) on delete cascade,
  recipe_id     text not null references recipe(id) on delete cascade,
  baked_on      date not null,
  notes         text not null default '',
  modifications text,
  rating        smallint check (rating between 1 and 5),
  result        text check (result in ('great','good','okay','flop')),
  scale         numeric,
  created_at    timestamptz not null default now()
);

create table bake_photo (
  bake_id  text references bake_entry(id) on delete cascade,
  photo_id text references photo(id) on delete cascade,
  position int not null,
  primary key (bake_id, photo_id)
);
