insert into leagues (id, source_id, sport_slug, sport_name, name, country, logo_url, season)
values
  (1, 'football:4328', 'football', 'Football', 'Premier League', 'England', 'https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png', '2025-2026'),
  (2, 'football:4335', 'football', 'Football', 'La Liga', 'Spain', 'https://r2.thesportsdb.com/images/media/league/badge/7qu2un1737743139.png', '2025-2026')
on conflict (id) do nothing;

insert into teams (id, source_id, league_id, name, short_name, country, founded, venue, logo_url)
values
  (1, 'football:133602', 1, 'Liverpool', 'LIV', 'England', 1892, 'Anfield', null),
  (2, 'football:133610', 1, 'Chelsea', 'CHE', 'England', 1905, 'Stamford Bridge', null),
  (3, 'football:133604', 1, 'Arsenal', 'ARS', 'England', 1886, 'Emirates Stadium', null),
  (4, 'football:133613', 1, 'Manchester City', 'MCI', 'England', 1880, 'Etihad Stadium', null),
  (5, 'football:133738', 2, 'Real Madrid', 'RMA', 'Spain', 1902, 'Santiago Bernabeu', null),
  (6, 'football:133739', 2, 'Barcelona', 'BAR', 'Spain', 1899, 'Estadi Olimpic Lluis Companys', null),
  (7, 'football:133729', 2, 'Atletico Madrid', 'ATM', 'Spain', 1903, 'Metropolitano Stadium', null)
on conflict (id) do nothing;

insert into players (id, team_id, name, position, age, nationality, photo_url)
values
  (1, 1, 'Mohamed Salah', 'Forward', 33, 'Egypt', null),
  (2, 1, 'Virgil van Dijk', 'Defender', 34, 'Netherlands', null),
  (3, 1, 'Darwin Nunez', 'Forward', 27, 'Uruguay', null),
  (4, 2, 'Cole Palmer', 'Midfielder', 24, 'England', null),
  (5, 2, 'Enzo Fernandez', 'Midfielder', 25, 'Argentina', null),
  (6, 3, 'Bukayo Saka', 'Forward', 25, 'England', null),
  (7, 3, 'Martin Odegaard', 'Midfielder', 27, 'Norway', null),
  (8, 4, 'Erling Haaland', 'Forward', 26, 'Norway', null),
  (9, 4, 'Phil Foden', 'Forward', 26, 'England', null),
  (10, 5, 'Jude Bellingham', 'Midfielder', 23, 'England', null),
  (11, 5, 'Vinicius Junior', 'Forward', 26, 'Brazil', null),
  (12, 6, 'Lamine Yamal', 'Forward', 19, 'Spain', null),
  (13, 6, 'Pedri', 'Midfielder', 24, 'Spain', null),
  (14, 7, 'Antoine Griezmann', 'Forward', 35, 'France', null)
on conflict (id) do nothing;

insert into fixtures (
  id,
  source_id,
  league_id,
  home_team_id,
  away_team_id,
  starts_at,
  status,
  minute,
  home_score,
  away_score,
  venue
)
values
  (1001, 'football:900001', 1, 1, 2, now() - interval '67 minutes', '2H', 67, 2, 1, 'Anfield'),
  (1002, 'football:900002', 1, 3, 4, now() + interval '1 day 2 hours', 'NS', 0, 0, 0, 'Emirates Stadium'),
  (1003, 'football:900003', 2, 5, 6, now() - interval '7 days', 'FT', 90, 3, 2, 'Santiago Bernabeu'),
  (1004, 'football:900004', 2, 6, 7, now() + interval '3 days', 'NS', 0, 0, 0, 'Estadi Olimpic Lluis Companys')
on conflict (id) do nothing;

insert into events (fixture_id, team_id, player_id, event_type, minute, description)
values
  (1001, 1, 1, 'goal', 18, 'Mohamed Salah opened the scoring from inside the box.'),
  (1001, 2, 4, 'goal', 41, 'Cole Palmer equalised with a curled finish.'),
  (1001, 1, 3, 'goal', 67, 'Darwin Nunez restored Liverpool''s lead.'),
  (1003, 5, 10, 'goal', 22, 'Jude Bellingham gave Madrid the lead.'),
  (1003, 5, 11, 'goal', 63, 'Vinicius Junior doubled the advantage on the break.'),
  (1003, 6, 12, 'goal', 70, 'Lamine Yamal pulled one back for Barcelona.'),
  (1003, 6, 13, 'goal', 80, 'Pedri levelled the score late in the match.'),
  (1003, 5, 10, 'goal', 88, 'Jude Bellingham grabbed the winner in stoppage pressure.')
on conflict do nothing;

insert into standings (
  league_id,
  team_id,
  position,
  played,
  wins,
  draws,
  losses,
  goals_for,
  goals_against,
  points,
  form
)
values
  (1, 3, 1, 30, 20, 7, 3, 59, 22, 67, 'WWWDD'),
  (1, 4, 2, 30, 19, 7, 4, 65, 28, 64, 'WDWWW'),
  (1, 1, 3, 30, 18, 7, 5, 62, 31, 61, 'WLWDW'),
  (1, 2, 4, 30, 17, 7, 6, 54, 32, 58, 'DWWLW'),
  (2, 6, 1, 28, 20, 6, 2, 64, 21, 66, 'WWWDW'),
  (2, 5, 2, 28, 19, 6, 3, 61, 24, 63, 'WWWLW'),
  (2, 7, 3, 28, 16, 8, 4, 47, 24, 56, 'WDWDW')
on conflict (league_id, team_id) do nothing;

insert into users (id, name, email, company, password_hash, role, plan, status)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Demo Developer',
    'demo@sportstack.dev',
    'SportStack Labs',
    '51f3a2d6f56ef138b4b3bd7abc3ed024:e0ca7050a86f43486199e33740327b6edd4f6f0b6c10fadde57cdc5b7821b9bcd6dcd926fad54738eeab28a3e442415a3e17bb420d83b22e49ceb4d738519b30',
    'developer',
    'free',
    'active'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Admin Operator',
    'admin@sportstack.dev',
    'SportStack',
    'ade73bd3c4c90b6836445dd330d87693:7e188663ab2df3fb920c42b2103f3fe99fdf53890ed3463caa2fe7d34bcf28237fd997dd1691cf951cb7337987440f0ac3802ccba669501c007766ba1ce9b771',
    'admin',
    'enterprise',
    'active'
  )
on conflict (id) do nothing;

insert into api_keys (
  id,
  user_id,
  name,
  key_hash,
  key_prefix,
  last_used_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'Local demo key',
    '24f685852168ee3a3cae7dd9e18aa1d3a73267d390ec06252de7dcfa66bbb165',
    'sport_live_demo',
    now() - interval '2 hours'
  )
on conflict (id) do nothing;

insert into api_requests (
  api_key_id,
  user_id,
  endpoint,
  method,
  status_code,
  response_time_ms,
  created_at
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '/api/leagues', 'GET', 200, 42, now() - interval '6 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '/api/teams', 'GET', 200, 39, now() - interval '5 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '/api/fixtures', 'GET', 200, 51, now() - interval '4 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '/api/fixtures/live', 'GET', 200, 36, now() - interval '2 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '/api/standings', 'GET', 200, 44, now() - interval '18 hours'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '/api/players', 'GET', 200, 41, now() - interval '3 hours'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '/api/fixtures/live', 'GET', 200, 33, now() - interval '65 minutes')
on conflict do nothing;

select setval('leagues_id_seq', (select coalesce(max(id), 1) from leagues));
select setval('teams_id_seq', (select coalesce(max(id), 1) from teams));
select setval('players_id_seq', (select coalesce(max(id), 1) from players));
select setval('fixtures_id_seq', (select coalesce(max(id), 1) from fixtures));
select setval('events_id_seq', (select coalesce(max(id), 1) from events));
select setval('standings_id_seq', (select coalesce(max(id), 1) from standings));
select setval('api_requests_id_seq', (select coalesce(max(id), 1) from api_requests));
