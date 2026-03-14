import type {
  LiveSnapshotComment,
  LiveSnapshotFixture,
  LiveSnapshotOdds,
  LiveSnapshotProbability,
} from "./liveSnapshot";

export type FixtureFeedRow = {
  match_id: number;
  sport_slug: string;
  sport_name: string;
  league: string;
  country: string | null;
  season: string | null;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  score: string;
  minute: number | null;
  status: string;
  starts_at: string | null;
  venue: string | null;
  league_id?: number | null;
  home_team_id?: number | null;
  away_team_id?: number | null;
};

export type StandingFeedRow = {
  sport_slug: string;
  sport_name: string;
  position: number;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  points: number;
  form: string;
  league: string;
  league_id?: number | null;
};

export type CountryFeedRow = {
  name: string;
  sport_count: number;
  league_count: number;
  team_count: number;
};

export type LeagueFeedRow = {
  id: number;
  sport_slug: string;
  sport_name: string;
  name: string;
  country: string | null;
  season: string;
  logo_url: string | null;
};

export type H2HFeedRow = {
  match_id: number;
  sport_slug: string;
  sport_name: string;
  league: string;
  home_team: string;
  away_team: string;
  score: string;
  status: string;
  starts_at: string | null;
  winner: string | null;
};

export type TopScorerFeedRow = {
  sport_slug: string;
  sport_name: string;
  league: string;
  league_id: number | null;
  name: string;
  entity_type: "team" | "competitor";
  scored: number;
  played: number;
  average_scored: number;
};

export type CommentFeedRow = {
  fixture_id: number;
  sport_slug: string;
  sport_name: string;
  league: string;
  home_team: string;
  away_team: string;
  is_live: boolean;
  sequence: number;
  minute: number | null;
  type: string;
  text: string;
  is_home: boolean | null;
  player: string | null;
};

export type ProbabilityFeedRow = {
  fixture_id: number;
  sport_slug: string;
  sport_name: string;
  league: string;
  home_team: string;
  away_team: string;
  market: string;
  source: "upstream_odds" | "model";
  home_probability: number | null;
  draw_probability: number | null;
  away_probability: number | null;
  updated_at: string;
};

export type OddsChoiceRow = {
  name: string;
  fractional_value: string | null;
  decimal_value: number | null;
  probability: number | null;
  winning: boolean | null;
};

export type OddsMarketFeedRow = {
  fixture_id: number;
  sport_slug: string;
  sport_name: string;
  league: string;
  home_team: string;
  away_team: string;
  market_name: string;
  market_group: string | null;
  market_period: string | null;
  is_live: boolean;
  suspended: boolean;
  source: "upstream_odds" | "model";
  choices: OddsChoiceRow[];
};

const INDIVIDUAL_SPORTS = new Set([
  "tennis",
  "table-tennis",
  "darts",
  "mma",
  "badminton",
  "snooker",
  "motorsport",
  "cycling",
]);

function isIndividualSport(sportSlug: string) {
  return INDIVIDUAL_SPORTS.has(sportSlug);
}

export function isLiveStatus(status: string) {
  const normalized = status.toLowerCase();
  return ![
    "not started",
    "ns",
    "finished",
    "ft",
    "cancelled",
    "postponed",
  ].includes(normalized);
}

function normalizeProbabilities(
  home: number,
  draw: number,
  away: number,
) {
  const total = home + draw + away;
  if (total <= 0) {
    return {
      home_probability: 0.5,
      draw_probability: 0,
      away_probability: 0.5,
    };
  }

  return {
    home_probability: Number((home / total).toFixed(4)),
    draw_probability: draw > 0 ? Number((draw / total).toFixed(4)) : null,
    away_probability: Number((away / total).toFixed(4)),
  };
}

function decimalToFractional(decimal: number) {
  const fractional = Math.max(decimal - 1, 0.01);
  const denominator = 100;
  const numerator = Math.round(fractional * denominator);
  return `${numerator}/${denominator}`;
}

function probabilityToDecimal(probability: number | null) {
  if (!probability || probability <= 0) {
    return null;
  }

  return Number((1 / probability).toFixed(2));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildStandingLookup(rows: StandingFeedRow[]) {
  const lookup = new Map<string, StandingFeedRow>();

  for (const row of rows) {
    lookup.set(`${row.sport_slug}:${row.league}:${row.team}`, row);
  }

  return lookup;
}

function buildModelProbability(
  fixture: FixtureFeedRow,
  standings: StandingFeedRow[],
): ProbabilityFeedRow {
  const standingLookup = buildStandingLookup(standings);
  const homeStanding = standingLookup.get(
    `${fixture.sport_slug}:${fixture.league}:${fixture.home_team}`,
  );
  const awayStanding = standingLookup.get(
    `${fixture.sport_slug}:${fixture.league}:${fixture.away_team}`,
  );

  const individual = isIndividualSport(fixture.sport_slug);

  let home = individual ? 0.5 : 0.46;
  let draw = individual ? 0 : 0.24;
  let away = individual ? 0.5 : 0.3;

  if (homeStanding && awayStanding) {
    const positionDelta = awayStanding.position - homeStanding.position;
    home += clamp(positionDelta * 0.015, -0.12, 0.12);
    away -= clamp(positionDelta * 0.015, -0.12, 0.12);
  }

  const scoreDelta = fixture.home_score - fixture.away_score;
  if (scoreDelta !== 0) {
    const progress = fixture.minute !== null
      ? clamp(fixture.minute / 90, 0, 1)
      : isLiveStatus(fixture.status)
        ? 0.55
        : 0.25;
    const swing = clamp(0.14 + progress * 0.5 + Math.abs(scoreDelta) * 0.1, 0.08, 0.88);

    if (scoreDelta > 0) {
      home += swing;
      away = Math.max(away - swing * 0.8, 0.03);
      draw = individual ? 0 : Math.max(draw - swing * 0.2, 0.02);
    } else {
      away += swing;
      home = Math.max(home - swing * 0.8, 0.03);
      draw = individual ? 0 : Math.max(draw - swing * 0.2, 0.02);
    }
  }

  const normalized = normalizeProbabilities(home, draw, away);

  return {
    fixture_id: fixture.match_id,
    sport_slug: fixture.sport_slug,
    sport_name: fixture.sport_name,
    league: fixture.league,
    home_team: fixture.home_team,
    away_team: fixture.away_team,
    market: individual ? "Winner" : "Match winner",
    source: "model",
    ...normalized,
    updated_at: new Date().toISOString(),
  };
}

function buildModelOddsMarkets(
  fixture: FixtureFeedRow,
  standings: StandingFeedRow[],
): OddsMarketFeedRow[] {
  const probability = buildModelProbability(fixture, standings);
  const individual = isIndividualSport(fixture.sport_slug);

  const winnerChoices: OddsChoiceRow[] = individual
    ? [
        {
          name: fixture.home_team,
          probability: probability.home_probability,
          decimal_value: probabilityToDecimal(probability.home_probability),
          fractional_value: probability.home_probability
            ? decimalToFractional(probabilityToDecimal(probability.home_probability) ?? 2)
            : null,
          winning: null,
        },
        {
          name: fixture.away_team,
          probability: probability.away_probability,
          decimal_value: probabilityToDecimal(probability.away_probability),
          fractional_value: probability.away_probability
            ? decimalToFractional(probabilityToDecimal(probability.away_probability) ?? 2)
            : null,
          winning: null,
        },
      ]
    : [
        {
          name: "1",
          probability: probability.home_probability,
          decimal_value: probabilityToDecimal(probability.home_probability),
          fractional_value: probability.home_probability
            ? decimalToFractional(probabilityToDecimal(probability.home_probability) ?? 2)
            : null,
          winning: null,
        },
        {
          name: "X",
          probability: probability.draw_probability,
          decimal_value: probabilityToDecimal(probability.draw_probability),
          fractional_value: probability.draw_probability
            ? decimalToFractional(probabilityToDecimal(probability.draw_probability) ?? 2)
            : null,
          winning: null,
        },
        {
          name: "2",
          probability: probability.away_probability,
          decimal_value: probabilityToDecimal(probability.away_probability),
          fractional_value: probability.away_probability
            ? decimalToFractional(probabilityToDecimal(probability.away_probability) ?? 2)
            : null,
          winning: null,
        },
      ];

  const totalLine = individual ? 1.5 : 2.5;
  const currentTotal = fixture.home_score + fixture.away_score;
  const overProbability = clamp(0.48 + (currentTotal - totalLine) * 0.08, 0.1, 0.9);
  const underProbability = clamp(1 - overProbability, 0.1, 0.9);

  const markets: OddsMarketFeedRow[] = [
    {
      fixture_id: fixture.match_id,
      sport_slug: fixture.sport_slug,
      sport_name: fixture.sport_name,
      league: fixture.league,
      home_team: fixture.home_team,
      away_team: fixture.away_team,
      market_name: individual ? "Winner" : "Full time",
      market_group: individual ? "Winner" : "1X2",
      market_period: "Full-time",
      is_live: isLiveStatus(fixture.status),
      suspended: false,
      source: "model",
      choices: winnerChoices.filter((choice) => choice.probability !== null),
    },
    {
      fixture_id: fixture.match_id,
      sport_slug: fixture.sport_slug,
      sport_name: fixture.sport_name,
      league: fixture.league,
      home_team: fixture.home_team,
      away_team: fixture.away_team,
      market_name: `Total ${totalLine}`,
      market_group: "Totals",
      market_period: "Full-time",
      is_live: isLiveStatus(fixture.status),
      suspended: false,
      source: "model",
      choices: [
        {
          name: "Over",
          probability: Number(overProbability.toFixed(4)),
          decimal_value: probabilityToDecimal(overProbability),
          fractional_value: decimalToFractional(probabilityToDecimal(overProbability) ?? 2),
          winning: null,
        },
        {
          name: "Under",
          probability: Number(underProbability.toFixed(4)),
          decimal_value: probabilityToDecimal(underProbability),
          fractional_value: decimalToFractional(probabilityToDecimal(underProbability) ?? 2),
          winning: null,
        },
      ],
    },
  ];

  if (!individual) {
    const bttsProbability = clamp(
      0.42 + Math.min(fixture.home_score, fixture.away_score) * 0.12,
      0.08,
      0.92,
    );
    markets.push({
      fixture_id: fixture.match_id,
      sport_slug: fixture.sport_slug,
      sport_name: fixture.sport_name,
      league: fixture.league,
      home_team: fixture.home_team,
      away_team: fixture.away_team,
      market_name: "Both teams to score",
      market_group: "Goals",
      market_period: "Full-time",
      is_live: isLiveStatus(fixture.status),
      suspended: false,
      source: "model",
      choices: [
        {
          name: "Yes",
          probability: Number(bttsProbability.toFixed(4)),
          decimal_value: probabilityToDecimal(bttsProbability),
          fractional_value: decimalToFractional(probabilityToDecimal(bttsProbability) ?? 2),
          winning: null,
        },
        {
          name: "No",
          probability: Number((1 - bttsProbability).toFixed(4)),
          decimal_value: probabilityToDecimal(1 - bttsProbability),
          fractional_value: decimalToFractional(
            probabilityToDecimal(1 - bttsProbability) ?? 2,
          ),
          winning: null,
        },
      ],
    });
  }

  return markets;
}

export function deriveCountries(
  leagues: LeagueFeedRow[],
  fixtures: FixtureFeedRow[],
) {
  const countries = new Map<
    string,
    {
      sports: Set<string>;
      leagues: Set<string>;
      teams: Set<string>;
    }
  >();

  for (const league of leagues) {
    const country = league.country?.trim();
    if (!country) {
      continue;
    }

    const current = countries.get(country) ?? {
      sports: new Set<string>(),
      leagues: new Set<string>(),
      teams: new Set<string>(),
    };

    current.sports.add(league.sport_slug);
    current.leagues.add(`${league.sport_slug}:${league.name}:${league.season}`);
    countries.set(country, current);
  }

  for (const fixture of fixtures) {
    const country = fixture.country?.trim();
    if (!country) {
      continue;
    }

    const current = countries.get(country) ?? {
      sports: new Set<string>(),
      leagues: new Set<string>(),
      teams: new Set<string>(),
    };

    current.sports.add(fixture.sport_slug);
    current.leagues.add(`${fixture.sport_slug}:${fixture.league}:${fixture.season ?? ""}`);
    current.teams.add(`${fixture.sport_slug}:${fixture.home_team}`);
    current.teams.add(`${fixture.sport_slug}:${fixture.away_team}`);
    countries.set(country, current);
  }

  return Array.from(countries.entries())
    .map(([name, value]): CountryFeedRow => ({
      name,
      sport_count: value.sports.size,
      league_count: value.leagues.size,
      team_count: value.teams.size,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function deriveStandingsFromFixtures(fixtures: FixtureFeedRow[]) {
  const table = new Map<string, StandingFeedRow>();

  for (const fixture of fixtures) {
    if (fixture.status === "Not started") {
      continue;
    }

    const participants = [
      {
        team: fixture.home_team,
        scored: fixture.home_score,
        conceded: fixture.away_score,
      },
      {
        team: fixture.away_team,
        scored: fixture.away_score,
        conceded: fixture.home_score,
      },
    ];

    for (const participant of participants) {
      const key = `${fixture.sport_slug}:${fixture.league}:${participant.team}`;
      const row = table.get(key) ?? {
        sport_slug: fixture.sport_slug,
        sport_name: fixture.sport_name,
        position: 0,
        team: participant.team,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        points: 0,
        form: "",
        league: fixture.league,
        league_id: fixture.league_id ?? null,
      };

      row.played += 1;
      row.goals_for += participant.scored;
      row.goals_against += participant.conceded;

      if (participant.scored > participant.conceded) {
        row.wins += 1;
        row.points += 3;
        row.form = `W${row.form}`.slice(0, 5);
      } else if (participant.scored === participant.conceded) {
        row.draws += 1;
        row.points += 1;
        row.form = `D${row.form}`.slice(0, 5);
      } else {
        row.losses += 1;
        row.form = `L${row.form}`.slice(0, 5);
      }

      table.set(key, row);
    }
  }

  const grouped = new Map<string, StandingFeedRow[]>();
  for (const row of table.values()) {
    grouped.set(row.league, [...(grouped.get(row.league) ?? []), row]);
  }

  const rankedRows: StandingFeedRow[] = [];
  for (const rows of grouped.values()) {
    rows.sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      const leftDiff = left.goals_for - left.goals_against;
      const rightDiff = right.goals_for - right.goals_against;
      if (rightDiff !== leftDiff) {
        return rightDiff - leftDiff;
      }

      return right.goals_for - left.goals_for;
    });

    rows.forEach((row, index) => {
      row.position = index + 1;
      rankedRows.push(row);
    });
  }

  return rankedRows.sort((left, right) => {
    const leagueCompare = left.league.localeCompare(right.league);
    if (leagueCompare !== 0) {
      return leagueCompare;
    }

    return left.position - right.position;
  });
}

export function deriveHeadToHead(
  fixtures: FixtureFeedRow[],
  team1Id: number,
  team2Id: number,
  limit: number,
) {
  return fixtures
    .filter(
      (fixture) =>
        (fixture.home_team_id === team1Id && fixture.away_team_id === team2Id) ||
        (fixture.home_team_id === team2Id && fixture.away_team_id === team1Id),
    )
    .sort((left, right) =>
      String(right.starts_at ?? "").localeCompare(String(left.starts_at ?? "")),
    )
    .slice(0, limit)
    .map(
      (fixture): H2HFeedRow => ({
        match_id: fixture.match_id,
        sport_slug: fixture.sport_slug,
        sport_name: fixture.sport_name,
        league: fixture.league,
        home_team: fixture.home_team,
        away_team: fixture.away_team,
        score: fixture.score,
        status: fixture.status,
        starts_at: fixture.starts_at,
        winner:
          fixture.home_score === fixture.away_score
            ? null
            : fixture.home_score > fixture.away_score
              ? fixture.home_team
              : fixture.away_team,
      }),
    );
}

export function deriveTopScorers(
  fixtures: FixtureFeedRow[],
  sport?: string,
  leagueId?: number,
  limit = 20,
) {
  const leaderboard = new Map<string, TopScorerFeedRow>();

  for (const fixture of fixtures) {
    if (sport && fixture.sport_slug !== sport) {
      continue;
    }

    if (leagueId && fixture.league_id !== leagueId) {
      continue;
    }

    const competitors = [
      {
        name: fixture.home_team,
        scored: fixture.home_score,
      },
      {
        name: fixture.away_team,
        scored: fixture.away_score,
      },
    ];

    for (const competitor of competitors) {
      const key = `${fixture.sport_slug}:${fixture.league}:${competitor.name}`;
      const current = leaderboard.get(key) ?? {
        sport_slug: fixture.sport_slug,
        sport_name: fixture.sport_name,
        league: fixture.league,
        league_id: fixture.league_id ?? null,
        name: competitor.name,
        entity_type: isIndividualSport(fixture.sport_slug) ? "competitor" : "team",
        scored: 0,
        played: 0,
        average_scored: 0,
      };

      current.scored += competitor.scored;
      current.played += 1;
      current.average_scored = Number((current.scored / current.played).toFixed(2));
      leaderboard.set(key, current);
    }
  }

  return Array.from(leaderboard.values())
    .sort((left, right) => {
      if (right.scored !== left.scored) {
        return right.scored - left.scored;
      }

      return right.average_scored - left.average_scored;
    })
    .slice(0, limit);
}

export function deriveLiveComments(
  liveFixtures: FixtureFeedRow[],
  snapshotComments: LiveSnapshotComment[],
  sport?: string,
  fixtureId?: number,
  limit = 50,
) {
  const comments = snapshotComments
    .filter((comment) => comment.is_live)
    .filter((comment) => (sport ? comment.sport_slug === sport : true))
    .filter((comment) => (fixtureId ? comment.fixture_id === fixtureId : true))
    .map(
      (comment): CommentFeedRow => ({
        fixture_id: comment.fixture_id,
        sport_slug: comment.sport_slug,
        sport_name: comment.sport_name,
        league: comment.league,
        home_team: comment.home_team,
        away_team: comment.away_team,
        is_live: comment.is_live,
        sequence: comment.sequence,
        minute: comment.minute ?? null,
        type: comment.type,
        text: comment.text,
        is_home: comment.is_home ?? null,
        player: comment.player ?? null,
      }),
    );

  if (comments.length > 0) {
    return comments.slice(0, limit);
  }

  return liveFixtures
    .filter((fixture) => (sport ? fixture.sport_slug === sport : true))
    .filter((fixture) => (fixtureId ? fixture.match_id === fixtureId : true))
    .slice(0, limit)
    .map(
      (fixture, index): CommentFeedRow => ({
        fixture_id: fixture.match_id,
        sport_slug: fixture.sport_slug,
        sport_name: fixture.sport_name,
        league: fixture.league,
        home_team: fixture.home_team,
        away_team: fixture.away_team,
        is_live: true,
        sequence: index,
        minute: fixture.minute,
        type: "scoreUpdate",
        text: `${fixture.home_team} ${fixture.home_score} - ${fixture.away_score} ${fixture.away_team} (${fixture.minute !== null ? `${fixture.minute}'` : fixture.status})`,
        is_home: null,
        player: null,
      }),
    );
}

export function deriveProbabilities(
  fixtures: FixtureFeedRow[],
  snapshotProbabilities: LiveSnapshotProbability[],
  standings: StandingFeedRow[],
  fixtureId?: number,
  sport?: string,
  limit = 20,
) {
  const selectedFixtures = fixtures
    .filter((fixture) => (fixtureId ? fixture.match_id === fixtureId : true))
    .filter((fixture) => (sport ? fixture.sport_slug === sport : true))
    .slice(0, limit);

  const snapshotLookup = new Map<number, LiveSnapshotProbability>();
  for (const probability of snapshotProbabilities) {
    if (!snapshotLookup.has(probability.fixture_id)) {
      snapshotLookup.set(probability.fixture_id, probability);
    }
  }

  return selectedFixtures.map((fixture) => {
    const upstream = snapshotLookup.get(fixture.match_id);
    if (upstream) {
      return {
        fixture_id: upstream.fixture_id,
        sport_slug: upstream.sport_slug,
        sport_name: upstream.sport_name,
        league: upstream.league,
        home_team: upstream.home_team,
        away_team: upstream.away_team,
        market: upstream.market,
        source: upstream.source as "upstream_odds" | "model",
        home_probability: upstream.home_probability ?? null,
        draw_probability: upstream.draw_probability ?? null,
        away_probability: upstream.away_probability ?? null,
        updated_at: upstream.updated_at,
      };
    }

    return buildModelProbability(fixture, standings);
  });
}

export function deriveOdds(
  fixtures: FixtureFeedRow[],
  snapshotOdds: LiveSnapshotOdds[],
  standings: StandingFeedRow[],
  options: {
    fixtureId?: number;
    sport?: string;
    limit?: number;
    liveOnly?: boolean;
  },
) {
  const limit = options.limit ?? 20;
  const selectedFixtures = fixtures
    .filter((fixture) => (options.fixtureId ? fixture.match_id === options.fixtureId : true))
    .filter((fixture) => (options.sport ? fixture.sport_slug === options.sport : true))
    .filter((fixture) => (options.liveOnly ? isLiveStatus(fixture.status) : true))
    .slice(0, limit);

  const marketsByFixture = new Map<number, OddsMarketFeedRow[]>();
  for (const market of snapshotOdds) {
    const row: OddsMarketFeedRow = {
      fixture_id: market.fixture_id,
      sport_slug: market.sport_slug,
      sport_name: market.sport_name,
      league: market.league,
      home_team: market.home_team,
      away_team: market.away_team,
      market_name: market.market_name,
      market_group: market.market_group ?? null,
      market_period: market.market_period ?? null,
      is_live: market.is_live,
      suspended: market.suspended,
      source: market.source as "upstream_odds" | "model",
      choices: market.choices.map((choice) => ({
        name: choice.name,
        fractional_value: choice.fractional_value ?? null,
        decimal_value: choice.decimal_value ?? null,
        probability: choice.probability ?? null,
        winning: choice.winning ?? null,
      })),
    };

    marketsByFixture.set(market.fixture_id, [
      ...(marketsByFixture.get(market.fixture_id) ?? []),
      row,
    ]);
  }

  return selectedFixtures.flatMap((fixture) => {
    const upstreamMarkets = marketsByFixture.get(fixture.match_id);
    if (upstreamMarkets && upstreamMarkets.length > 0) {
      return upstreamMarkets;
    }

    return buildModelOddsMarkets(fixture, standings);
  });
}
