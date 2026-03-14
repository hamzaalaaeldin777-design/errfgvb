create table if not exists leagues (
  id serial primary key,
  source_id text unique,
  sport_slug text not null default 'football',
  sport_name text not null default 'Football',
  name text not null,
  country text,
  logo_url text,
  season text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teams (
  id serial primary key,
  source_id text unique,
  league_id integer references leagues(id) on delete set null,
  name text not null,
  short_name text,
  country text,
  founded integer,
  venue text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists players (
  id serial primary key,
  source_id text unique,
  team_id integer references teams(id) on delete cascade,
  name text not null,
  position text,
  age integer,
  nationality text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, name)
);

create table if not exists fixtures (
  id bigserial primary key,
  source_id text unique,
  league_id integer not null references leagues(id) on delete cascade,
  home_team_id integer not null references teams(id) on delete cascade,
  away_team_id integer not null references teams(id) on delete cascade,
  starts_at timestamptz not null,
  status text not null default 'NS',
  minute integer not null default 0,
  home_score integer not null default 0,
  away_score integer not null default 0,
  venue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id bigserial primary key,
  fixture_id bigint not null references fixtures(id) on delete cascade,
  team_id integer references teams(id) on delete set null,
  player_id integer references players(id) on delete set null,
  event_type text not null,
  minute integer,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists standings (
  id bigserial primary key,
  league_id integer not null references leagues(id) on delete cascade,
  team_id integer not null references teams(id) on delete cascade,
  position integer not null,
  played integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  points integer not null default 0,
  form text,
  updated_at timestamptz not null default now(),
  unique (league_id, team_id)
);

create table if not exists users (
  id uuid primary key,
  name text not null,
  email text not null unique,
  company text,
  password_hash text not null,
  role text not null default 'developer',
  plan text not null default 'free',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_requests (
  id bigserial primary key,
  api_key_id uuid references api_keys(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  endpoint text not null,
  method text not null,
  status_code integer not null,
  response_time_ms integer not null default 0,
  created_at timestamptz not null default now()
);
