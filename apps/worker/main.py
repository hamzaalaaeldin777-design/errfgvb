import atexit
import json
import logging
import os
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import httpx

LIVE_URL = "https://api.sofascore.com/api/v1/sport/{sport_slug}/events/live"
SCHEDULED_URL = (
    "https://api.sofascore.com/api/v1/sport/{sport_slug}/scheduled-events/{target_date}"
)
TEAM_PLAYERS_URL = "https://api.sofascore.com/api/v1/team/{team_id}/players"
STANDINGS_URL = (
    "https://api.sofascore.com/api/v1/unique-tournament/{tournament_id}/season/{season_id}/standings/total"
)

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Referer": "https://www.sofascore.com/",
    "Origin": "https://www.sofascore.com",
}

REQUEST_TIMEOUT_SECONDS = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "20"))
REQUEST_THROTTLE_SECONDS = float(os.getenv("REQUEST_THROTTLE_SECONDS", "3"))
FETCH_INTERVAL_SECONDS = float(os.getenv("FETCH_INTERVAL_SECONDS", "10"))
MAX_CYCLES = int(os.getenv("MAX_CYCLES", "0"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "5"))
BACKOFF_BASE_SECONDS = float(os.getenv("BACKOFF_BASE_SECONDS", "1.5"))
PLAYWRIGHT_WAIT_MS = int(os.getenv("PLAYWRIGHT_WAIT_MS", "1500"))
ENABLE_PLAYWRIGHT_FALLBACK = (
    os.getenv("ENABLE_PLAYWRIGHT_FALLBACK", "true").lower() == "true"
)
MAX_TEAM_ENRICHMENTS_PER_CYCLE = int(
    os.getenv("MAX_TEAM_ENRICHMENTS_PER_CYCLE", "10")
)
MAX_STANDINGS_ENRICHMENTS_PER_CYCLE = int(
    os.getenv("MAX_STANDINGS_ENRICHMENTS_PER_CYCLE", "10")
)
MAX_EVENT_DETAIL_ENRICHMENTS_PER_CYCLE = int(
    os.getenv("MAX_EVENT_DETAIL_ENRICHMENTS_PER_CYCLE", "8")
)
MAX_DETAIL_FIXTURES_PER_SPORT = int(
    os.getenv("MAX_DETAIL_FIXTURES_PER_SPORT", "4")
)
TEAM_REFRESH_INTERVAL_SECONDS = float(
    os.getenv("TEAM_REFRESH_INTERVAL_SECONDS", "21600")
)
STANDINGS_REFRESH_INTERVAL_SECONDS = float(
    os.getenv("STANDINGS_REFRESH_INTERVAL_SECONDS", "1800")
)
EVENT_DETAIL_REFRESH_INTERVAL_SECONDS = float(
    os.getenv("EVENT_DETAIL_REFRESH_INTERVAL_SECONDS", "21600")
)
LIVE_EVENT_DETAIL_REFRESH_INTERVAL_SECONDS = float(
    os.getenv("LIVE_EVENT_DETAIL_REFRESH_INTERVAL_SECONDS", "120")
)
DATABASE_URL = os.getenv("DATABASE_URL")
LIVE_SNAPSHOT_PATH = Path(
    os.getenv("LIVE_SNAPSHOT_PATH")
    or Path(__file__).resolve().parents[2] / ".codex-runtime" / "live-matches.json"
)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(message)s",
)
LOGGER = logging.getLogger("sofascore-scraper")
LAST_REQUEST_AT = 0.0
SESSION_HYDRATED = False
HTTPX_BLOCKED = False
PLAYWRIGHT_STATE: dict[str, Any] = {}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


@dataclass(frozen=True, slots=True)
class SportDefinition:
    name: str
    slug: str


@dataclass(slots=True)
class ParsedCompetitor:
    competitor_id: int | None
    name: str
    short_name: str | None
    country: str | None
    is_individual: bool


@dataclass(slots=True)
class ParsedEvent:
    sport_slug: str
    sport_name: str
    match_id: int
    tournament_id: int | None
    tournament_name: str
    country_name: str | None
    season_id: int | None
    season_name: str | None
    home: ParsedCompetitor
    away: ParsedCompetitor
    home_score: int
    away_score: int
    match_status: str
    match_minute: int | None
    start_timestamp: int | None
    venue: str | None


@dataclass(slots=True)
class StructuredState:
    live_matches: dict[str, dict[int, dict[str, Any]]] = field(default_factory=dict)
    leagues: dict[str, dict[str, Any]] = field(default_factory=dict)
    teams: dict[str, dict[str, Any]] = field(default_factory=dict)
    players: dict[str, dict[str, Any]] = field(default_factory=dict)
    fixtures: dict[str, dict[str, Any]] = field(default_factory=dict)
    standings: dict[str, dict[str, Any]] = field(default_factory=dict)
    comments: dict[str, dict[str, Any]] = field(default_factory=dict)
    videos: dict[str, dict[str, Any]] = field(default_factory=dict)
    odds: dict[str, dict[str, Any]] = field(default_factory=dict)
    probabilities: dict[str, dict[str, Any]] = field(default_factory=dict)
    sport_updated_at: dict[str, str] = field(default_factory=dict)
    pending_team_keys: deque[tuple[str, int]] = field(default_factory=deque)
    pending_team_set: set[tuple[str, int]] = field(default_factory=set)
    pending_standings_keys: deque[tuple[str, int, int]] = field(default_factory=deque)
    pending_standings_set: set[tuple[str, int, int]] = field(default_factory=set)
    pending_detail_keys: deque[tuple[str, int]] = field(default_factory=deque)
    pending_detail_set: set[tuple[str, int]] = field(default_factory=set)
    team_refreshed_at: dict[tuple[str, int], float] = field(default_factory=dict)
    standings_refreshed_at: dict[tuple[str, int, int], float] = field(default_factory=dict)
    detail_refreshed_at: dict[tuple[str, int], float] = field(default_factory=dict)


SPORTS_CATALOG = [
    SportDefinition(name="Esports", slug="esports"),
    SportDefinition(name="Football", slug="football"),
    SportDefinition(name="Tennis", slug="tennis"),
    SportDefinition(name="Basketball", slug="basketball"),
    SportDefinition(name="Baseball", slug="baseball"),
    SportDefinition(name="Volleyball", slug="volleyball"),
    SportDefinition(name="American Football", slug="american-football"),
    SportDefinition(name="Handball", slug="handball"),
    SportDefinition(name="Table Tennis", slug="table-tennis"),
    SportDefinition(name="Ice Hockey", slug="ice-hockey"),
    SportDefinition(name="Darts", slug="darts"),
    SportDefinition(name="Motorsport", slug="motorsport"),
    SportDefinition(name="Cycling", slug="cycling"),
    SportDefinition(name="Cricket", slug="cricket"),
    SportDefinition(name="MMA", slug="mma"),
    SportDefinition(name="Rugby", slug="rugby"),
    SportDefinition(name="Futsal", slug="futsal"),
    SportDefinition(name="Badminton", slug="badminton"),
    SportDefinition(name="Water polo", slug="waterpolo"),
    SportDefinition(name="Snooker", slug="snooker"),
    SportDefinition(name="Aussie Rules", slug="aussie-rules"),
    SportDefinition(name="Beach Volleyball", slug="beach-volley"),
    SportDefinition(name="Minifootball", slug="minifootball"),
    SportDefinition(name="Floorball", slug="floorball"),
    SportDefinition(name="Bandy", slug="bandy"),
]


def throttle_requests() -> None:
    global LAST_REQUEST_AT

    elapsed = time.monotonic() - LAST_REQUEST_AT
    if elapsed < REQUEST_THROTTLE_SECONDS:
        time.sleep(REQUEST_THROTTLE_SECONDS - elapsed)
    LAST_REQUEST_AT = time.monotonic()


def resolve_selected_sports() -> list[SportDefinition]:
    requested = os.getenv("SPORTS")
    if not requested:
        return SPORTS_CATALOG

    requested_slugs = {
        slug.strip().lower() for slug in requested.split(",") if slug.strip()
    }
    selected = [sport for sport in SPORTS_CATALOG if sport.slug in requested_slugs]
    missing = sorted(requested_slugs.difference({sport.slug for sport in selected}))

    if missing:
        LOGGER.warning("Ignoring unsupported sports: %s", ", ".join(missing))

    return selected or SPORTS_CATALOG


def build_live_url(sport: SportDefinition) -> str:
    return LIVE_URL.format(sport_slug=sport.slug)


def build_scheduled_url(sport: SportDefinition, target_date: date) -> str:
    return SCHEDULED_URL.format(
        sport_slug=sport.slug,
        target_date=target_date.isoformat(),
    )


def build_team_players_url(team_id: int) -> str:
    return TEAM_PLAYERS_URL.format(team_id=team_id)


def build_standings_url(tournament_id: int, season_id: int) -> str:
    return STANDINGS_URL.format(tournament_id=tournament_id, season_id=season_id)


def build_event_comments_url(event_id: int) -> str:
    return f"https://api.sofascore.com/api/v1/event/{event_id}/comments"


def build_event_incidents_url(event_id: int) -> str:
    return f"https://api.sofascore.com/api/v1/event/{event_id}/incidents"


def build_event_media_url(event_id: int) -> str:
    return f"https://api.sofascore.com/api/v1/event/{event_id}/media"


def build_event_odds_url(event_id: int) -> str:
    return f"https://api.sofascore.com/api/v1/event/{event_id}/odds/1/all"


def coerce_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def coerce_optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def compute_age(date_of_birth_timestamp: Any) -> int | None:
    if not date_of_birth_timestamp:
        return None

    try:
        born = datetime.fromtimestamp(int(date_of_birth_timestamp), tz=UTC).date()
    except (TypeError, ValueError, OSError):
        return None

    today = datetime.now(UTC).date()
    return today.year - born.year - (
        (today.month, today.day) < (born.month, born.day)
    )


def compute_match_minute(event: dict[str, Any], sport_slug: str) -> int | None:
    status = event.get("status") or {}
    status_type = status.get("type")

    if status_type != "inprogress":
        return None

    event_time = event.get("time") or {}
    period_start = event_time.get("currentPeriodStartTimestamp")
    if not period_start:
        return None

    elapsed_seconds = max(0, int(time.time()) - int(period_start))
    elapsed_minutes = elapsed_seconds // 60

    if sport_slug == "football":
        description = (status.get("description") or "").lower()
        injury_time = (
            event_time.get("injuryTime2")
            or event_time.get("injuryTime1")
            or event_time.get("extra")
            or 0
        )
        if "2nd" in description:
            return min(130, 45 + elapsed_minutes + int(injury_time))
        return min(70, elapsed_minutes + int(injury_time))

    return min(300, elapsed_minutes)


def ensure_playwright_page():
    if PLAYWRIGHT_STATE.get("page") is not None:
        return PLAYWRIGHT_STATE["page"]

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise RuntimeError(
            "Playwright fallback requested but playwright is not installed."
        ) from error

    manager = sync_playwright().start()
    browser = manager.chromium.launch(
        headless=True,
        args=["--disable-blink-features=AutomationControlled"],
    )
    context = browser.new_context(user_agent=HEADERS["User-Agent"])
    page = context.new_page()
    throttle_requests()
    page.goto("https://www.sofascore.com", wait_until="domcontentloaded")
    page.wait_for_timeout(PLAYWRIGHT_WAIT_MS)
    PLAYWRIGHT_STATE.update(
        {
            "manager": manager,
            "browser": browser,
            "context": context,
            "page": page,
        }
    )
    return page


def close_playwright_session() -> None:
    page = PLAYWRIGHT_STATE.get("page")
    context = PLAYWRIGHT_STATE.get("context")
    browser = PLAYWRIGHT_STATE.get("browser")
    manager = PLAYWRIGHT_STATE.get("manager")

    if page is not None:
        page.close()
    if context is not None:
        context.close()
    if browser is not None:
        browser.close()
    if manager is not None:
        manager.stop()


atexit.register(close_playwright_session)


def hydrate_httpx_session_with_playwright(client: httpx.Client) -> bool:
    global SESSION_HYDRATED

    if SESSION_HYDRATED:
        return True

    try:
        ensure_playwright_page()
        context = PLAYWRIGHT_STATE["context"]
        cookies = context.cookies()
        if cookies:
            cookie_header = "; ".join(
                f"{cookie['name']}={cookie['value']}" for cookie in cookies
            )
            client.headers["Cookie"] = cookie_header
        SESSION_HYDRATED = True
        LOGGER.info("Hydrated httpx session using Playwright cookies.")
        return True
    except Exception as error:  # noqa: BLE001
        LOGGER.error("Failed to hydrate session with Playwright: %s", error)
        return False


def fetch_with_playwright_direct(url: str, label: str) -> dict[str, Any]:
    page = ensure_playwright_page()
    throttle_requests()
    response = page.goto(url, wait_until="domcontentloaded")

    if not response or response.status != 200:
        raise RuntimeError(
            f"Playwright fallback returned status code {response.status if response else 'unknown'} for {label}."
        )

    payload = page.text_content("body")
    LOGGER.info("Fetched %s via Playwright fallback.", label)
    return json.loads(payload or "{}")


def fetch_json(client: httpx.Client, url: str, label: str) -> dict[str, Any]:
    global HTTPX_BLOCKED

    if HTTPX_BLOCKED and ENABLE_PLAYWRIGHT_FALLBACK:
        return fetch_with_playwright_direct(url, label)

    backoff_seconds = BACKOFF_BASE_SECONDS

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            throttle_requests()
            response = client.get(url, headers=HEADERS)

            if response.status_code == 200:
                return response.json()

            if response.status_code == 403 and ENABLE_PLAYWRIGHT_FALLBACK:
                LOGGER.warning(
                    "Received 403 from httpx for %s on attempt %s/%s. Trying Playwright session.",
                    label,
                    attempt,
                    MAX_RETRIES,
                )
                if hydrate_httpx_session_with_playwright(client):
                    throttle_requests()
                    hydrated_response = client.get(url, headers=HEADERS)
                    if hydrated_response.status_code == 200:
                        return hydrated_response.json()

                HTTPX_BLOCKED = True
                LOGGER.warning(
                    "httpx remains blocked for %s. Switching to Playwright navigation.",
                    label,
                )
                return fetch_with_playwright_direct(url, label)

            LOGGER.warning(
                "Unexpected status code %s for %s on attempt %s/%s.",
                response.status_code,
                label,
                attempt,
                MAX_RETRIES,
            )
        except httpx.HTTPError as error:
            LOGGER.error(
                "HTTP error for %s on attempt %s/%s: %s",
                label,
                attempt,
                MAX_RETRIES,
                error,
            )

        if attempt < MAX_RETRIES:
            LOGGER.info("Retrying %s in %.1f seconds.", label, backoff_seconds)
            time.sleep(backoff_seconds)
            backoff_seconds *= 2

    if ENABLE_PLAYWRIGHT_FALLBACK:
        HTTPX_BLOCKED = True
        LOGGER.warning(
            "httpx retries exhausted for %s. Escalating to direct Playwright request.",
            label,
        )
        return fetch_with_playwright_direct(url, label)

    raise RuntimeError(f"Failed to fetch JSON for {label}.")


def extract_competitor(
    participant: dict[str, Any] | None,
    fallback_name: str,
) -> ParsedCompetitor:
    participant = participant or {}
    country = participant.get("country") or {}

    return ParsedCompetitor(
        competitor_id=coerce_optional_int(participant.get("id")),
        name=participant.get("name") or fallback_name,
        short_name=participant.get("shortName"),
        country=country.get("name"),
        is_individual=bool(participant.get("playerTeamInfo"))
        or participant.get("type") == 1,
    )


def extract_competitors(event: dict[str, Any]) -> tuple[ParsedCompetitor, ParsedCompetitor]:
    home_team = event.get("homeTeam") or event.get("homeCompetitor")
    away_team = event.get("awayTeam") or event.get("awayCompetitor")

    if home_team or away_team:
        return (
            extract_competitor(home_team, "Home"),
            extract_competitor(away_team, "Away"),
        )

    participants = event.get("participants") or event.get("competitors") or []
    if len(participants) >= 2:
        return (
            extract_competitor(participants[0], "Home"),
            extract_competitor(participants[1], "Away"),
        )

    return (
        ParsedCompetitor(
            competitor_id=None,
            name="Home",
            short_name=None,
            country=None,
            is_individual=False,
        ),
        ParsedCompetitor(
            competitor_id=None,
            name=event.get("name") or "Away",
            short_name=None,
            country=None,
            is_individual=False,
        ),
    )


def extract_scores(event: dict[str, Any]) -> tuple[int, int]:
    home_score = coerce_int((event.get("homeScore") or {}).get("current"))
    away_score = coerce_int((event.get("awayScore") or {}).get("current"))

    if home_score or away_score:
        return home_score, away_score

    scores = event.get("scores") or event.get("score") or []
    if isinstance(scores, list) and len(scores) >= 2:
        first = scores[0] or {}
        second = scores[1] or {}
        return coerce_int(first.get("current")), coerce_int(second.get("current"))

    return 0, 0


def extract_venue(event: dict[str, Any]) -> str | None:
    venue = event.get("venue") or {}
    stadium = venue.get("stadium") or {}
    return venue.get("name") or stadium.get("name")


def parse_events(payload: dict[str, Any], sport: SportDefinition) -> list[ParsedEvent]:
    parsed_events: list[ParsedEvent] = []

    for event in payload.get("events", []):
        tournament = event.get("tournament") or {}
        unique_tournament = tournament.get("uniqueTournament") or {}
        category = tournament.get("category") or {}
        season = event.get("season") or {}
        home, away = extract_competitors(event)
        home_score, away_score = extract_scores(event)

        match_id = coerce_int(event.get("id"))
        if not match_id:
            continue

        parsed_events.append(
            ParsedEvent(
                sport_slug=sport.slug,
                sport_name=sport.name,
                match_id=match_id,
                tournament_id=coerce_optional_int(
                    unique_tournament.get("id") or tournament.get("id")
                ),
                tournament_name=unique_tournament.get("name")
                or tournament.get("name")
                or "Unknown tournament",
                country_name=category.get("name")
                or (category.get("country") or {}).get("name"),
                season_id=coerce_optional_int(season.get("id")),
                season_name=season.get("name"),
                home=home,
                away=away,
                home_score=home_score,
                away_score=away_score,
                match_status=(event.get("status") or {}).get("description", "Unknown"),
                match_minute=compute_match_minute(event, sport.slug),
                start_timestamp=coerce_optional_int(event.get("startTimestamp")),
                venue=extract_venue(event),
            )
        )

    return parsed_events


def iso_from_timestamp(timestamp: int | None) -> str | None:
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=UTC).isoformat()


def emit_line(message: str) -> None:
    sys.stdout.buffer.write(f"{message}\n".encode("utf-8", errors="replace"))
    sys.stdout.flush()


def format_match(match: dict[str, Any]) -> str:
    minute = match["minute"]
    time_display = f"{minute}'" if minute is not None else match["status"]
    return (
        f"[{match['sport_name']}] {match['home_team']} {match['home_score']} - "
        f"{match['away_score']} {match['away_team']} ({time_display})"
    )


def queue_team_refresh(state: StructuredState, sport_slug: str, team_id: int | None) -> None:
    if team_id is None:
        return

    key = (sport_slug, team_id)
    refreshed_at = state.team_refreshed_at.get(key)
    if refreshed_at and (time.monotonic() - refreshed_at) < TEAM_REFRESH_INTERVAL_SECONDS:
        return

    if key not in state.pending_team_set:
        state.pending_team_set.add(key)
        state.pending_team_keys.append(key)


def queue_standings_refresh(
    state: StructuredState,
    sport_slug: str,
    tournament_id: int | None,
    season_id: int | None,
) -> None:
    if tournament_id is None or season_id is None:
        return

    key = (sport_slug, tournament_id, season_id)
    refreshed_at = state.standings_refreshed_at.get(key)
    if refreshed_at and (
        time.monotonic() - refreshed_at
    ) < STANDINGS_REFRESH_INTERVAL_SECONDS:
        return

    if key not in state.pending_standings_set:
        state.pending_standings_set.add(key)
        state.pending_standings_keys.append(key)


def upsert_individual_player(
    state: StructuredState,
    sport: SportDefinition,
    competitor: ParsedCompetitor,
) -> None:
    if competitor.competitor_id is None:
        return

    team_source_id = f"{sport.slug}:{competitor.competitor_id}"
    player_source_id = f"{sport.slug}:player:{competitor.competitor_id}"

    state.players[player_source_id] = {
        "id": competitor.competitor_id,
        "source_id": player_source_id,
        "team_id": competitor.competitor_id,
        "team_source_id": team_source_id,
        "name": competitor.name,
        "position": None,
        "age": None,
        "nationality": competitor.country,
        "photo_url": None,
        "team": competitor.name,
        "sport_slug": sport.slug,
        "sport_name": sport.name,
    }


def record_event(
    state: StructuredState,
    sport: SportDefinition,
    event: ParsedEvent,
    is_live: bool,
) -> None:
    league_id = event.tournament_id or event.match_id
    league_source_id = f"{sport.slug}:{league_id}"
    season_name = event.season_name or datetime.now(UTC).strftime("%Y")

    state.leagues[league_source_id] = {
        "id": league_id,
        "source_id": league_source_id,
        "sport_slug": sport.slug,
        "sport_name": sport.name,
        "name": event.tournament_name,
        "country": event.country_name,
        "season": season_name,
        "logo_url": None,
    }

    for competitor in (event.home, event.away):
        if competitor.competitor_id is None:
            continue

        team_source_id = f"{sport.slug}:{competitor.competitor_id}"
        state.teams[team_source_id] = {
            "id": competitor.competitor_id,
            "source_id": team_source_id,
            "league_id": league_id,
            "league_source_id": league_source_id,
            "name": competitor.name,
            "short_name": competitor.short_name,
            "country": competitor.country,
            "founded": None,
            "venue": None,
            "logo_url": None,
            "league": event.tournament_name,
            "sport_slug": sport.slug,
            "sport_name": sport.name,
        }

        if competitor.is_individual:
            upsert_individual_player(state, sport, competitor)
        elif sport.slug != "esports":
            queue_team_refresh(state, sport.slug, competitor.competitor_id)

    fixture_source_id = f"{sport.slug}:{event.match_id}"
    fixture_row = {
        "match_id": event.match_id,
        "source_id": fixture_source_id,
        "league_id": league_id,
        "league_source_id": league_source_id,
        "sport_slug": sport.slug,
        "sport_name": sport.name,
        "league": event.tournament_name,
        "country": event.country_name,
        "season": season_name,
        "home_team_id": event.home.competitor_id,
        "home_team_source_id": (
            f"{sport.slug}:{event.home.competitor_id}"
            if event.home.competitor_id is not None
            else None
        ),
        "away_team_id": event.away.competitor_id,
        "away_team_source_id": (
            f"{sport.slug}:{event.away.competitor_id}"
            if event.away.competitor_id is not None
            else None
        ),
        "home_team": event.home.name,
        "away_team": event.away.name,
        "home_score": event.home_score,
        "away_score": event.away_score,
        "score": f"{event.home_score}-{event.away_score}",
        "minute": event.match_minute,
        "status": event.match_status,
        "starts_at": iso_from_timestamp(event.start_timestamp),
        "venue": event.venue,
    }
    state.fixtures[fixture_source_id] = fixture_row

    if is_live:
        sport_live_matches = state.live_matches.setdefault(sport.slug, {})
        sport_live_matches[event.match_id] = {
            key: fixture_row[key]
            for key in (
                "sport_slug",
                "sport_name",
                "match_id",
                "league",
                "country",
                "season",
                "home_team",
                "away_team",
                "home_score",
                "away_score",
                "score",
                "minute",
                "status",
                "starts_at",
            )
        }

    queue_standings_refresh(state, sport.slug, event.tournament_id, event.season_id)


def merge_events(primary: list[ParsedEvent], secondary: list[ParsedEvent]) -> list[ParsedEvent]:
    merged: dict[int, ParsedEvent] = {}
    for event in secondary:
        merged[event.match_id] = event
    for event in primary:
        merged[event.match_id] = event
    return list(merged.values())


def queue_event_detail_refresh(
    state: StructuredState,
    sport_slug: str,
    match_id: int,
    is_live: bool,
) -> None:
    key = (sport_slug, match_id)
    refreshed_at = state.detail_refreshed_at.get(key)
    refresh_interval = (
        LIVE_EVENT_DETAIL_REFRESH_INTERVAL_SECONDS
        if is_live
        else EVENT_DETAIL_REFRESH_INTERVAL_SECONDS
    )

    if refreshed_at and (time.monotonic() - refreshed_at) < refresh_interval:
        return

    if key not in state.pending_detail_set:
        state.pending_detail_set.add(key)
        state.pending_detail_keys.append(key)


def fractional_to_decimal(value: str | None) -> float | None:
    if not value or "/" not in value:
        return None

    try:
        numerator_text, denominator_text = value.split("/", maxsplit=1)
        numerator = float(numerator_text)
        denominator = float(denominator_text)
        if denominator == 0:
            return None
        return round((numerator / denominator) + 1, 4)
    except ValueError:
        return None


def normalize_choice_probabilities(
    choices: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    raw_probabilities: list[float | None] = []
    for choice in choices:
        decimal_value = choice.get("decimal_value")
        if decimal_value is None or decimal_value <= 1:
            raw_probabilities.append(None)
        else:
            raw_probabilities.append(1 / decimal_value)

    total_probability = sum(value for value in raw_probabilities if value is not None)

    normalized_choices: list[dict[str, Any]] = []
    for choice, probability in zip(choices, raw_probabilities, strict=False):
        normalized_choice = dict(choice)
        if probability is not None and total_probability > 0:
            normalized_choice["probability"] = round(probability / total_probability, 4)
        else:
            normalized_choice["probability"] = None
        normalized_choices.append(normalized_choice)

    return normalized_choices


def build_fallback_comment(
    fixture: dict[str, Any],
    sequence: int,
) -> dict[str, Any]:
    minute = fixture.get("minute")
    if minute is not None:
        prefix = f"{minute}'"
    else:
        prefix = fixture.get("status") or "Update"

    return {
        "source_id": f"{fixture['source_id']}:comment:fallback",
        "fixture_id": fixture["match_id"],
        "sport_slug": fixture["sport_slug"],
        "sport_name": fixture["sport_name"],
        "league": fixture["league"],
        "home_team": fixture["home_team"],
        "away_team": fixture["away_team"],
        "is_live": fixture["status"] not in {"Not started", "FT", "Finished"},
        "sequence": sequence,
        "minute": minute,
        "type": "scoreUpdate",
        "text": (
            f"{prefix} {fixture['home_team']} {fixture['home_score']} - "
            f"{fixture['away_score']} {fixture['away_team']}"
        ),
        "is_home": None,
        "player": None,
    }


def incident_to_comment_row(
    fixture: dict[str, Any],
    incident: dict[str, Any],
) -> dict[str, Any] | None:
    text = incident.get("text")
    if not text:
        player_name = incident.get("playerName") or (incident.get("player") or {}).get("name")
        incident_type = incident.get("incidentType") or incident.get("type")
        if player_name and incident_type:
            text = f"{player_name} {incident_type}"
        elif incident_type:
            text = str(incident_type)

    if not text:
        return None

    comment_id = incident.get("id") or abs(hash(text)) % 2_000_000_000

    return {
        "source_id": f"{fixture['source_id']}:comment:{comment_id}",
        "fixture_id": fixture["match_id"],
        "sport_slug": fixture["sport_slug"],
        "sport_name": fixture["sport_name"],
        "league": fixture["league"],
        "home_team": fixture["home_team"],
        "away_team": fixture["away_team"],
        "is_live": fixture["status"] not in {"Not started", "FT", "Finished"},
        "sequence": coerce_int(incident.get("sequence") or 0),
        "minute": coerce_optional_int(incident.get("time")),
        "type": incident.get("incidentType") or incident.get("type") or "incident",
        "text": text,
        "is_home": incident.get("isHome"),
        "player": incident.get("playerName") or (incident.get("player") or {}).get("name"),
    }


def sync_sport_events(
    client: httpx.Client,
    state: StructuredState,
    sport: SportDefinition,
) -> None:
    live_payload = fetch_json(client, build_live_url(sport), f"{sport.slug} live")
    scheduled_payload = fetch_json(
        client,
        build_scheduled_url(sport, datetime.now(UTC).date()),
        f"{sport.slug} scheduled",
    )

    live_events = parse_events(live_payload, sport)
    scheduled_events = parse_events(scheduled_payload, sport)
    combined_events = merge_events(live_events, scheduled_events)
    live_match_ids = {event.match_id for event in live_events}

    state.live_matches[sport.slug] = {}
    for event in combined_events:
        record_event(
            state,
            sport,
            event,
            is_live=event.match_id in live_match_ids,
        )

    state.sport_updated_at[sport.slug] = datetime.now(UTC).isoformat()

    prioritized_events = sorted(
        combined_events,
        key=lambda item: (
            0 if item.match_id in live_match_ids else 1,
            0 if item.match_status != "Not started" else 1,
            item.start_timestamp or 0,
        ),
    )

    for event in prioritized_events[:MAX_DETAIL_FIXTURES_PER_SPORT]:
        queue_event_detail_refresh(
            state,
            sport.slug,
            event.match_id,
            is_live=event.match_id in live_match_ids,
        )

    completed_event = next(
        (
            event
            for event in prioritized_events
            if event.match_id not in live_match_ids and event.match_status != "Not started"
        ),
        None,
    )
    if completed_event is not None:
        queue_event_detail_refresh(
            state,
            sport.slug,
            completed_event.match_id,
            is_live=False,
        )

    if not live_events:
        LOGGER.info("No live events returned for %s.", sport.slug)
    else:
        LOGGER.info("Fetched %s live events for %s.", len(live_events), sport.slug)
        for match in state.live_matches.get(sport.slug, {}).values():
            emit_line(format_match(match))

    if scheduled_events:
        LOGGER.info(
            "Captured %s structured fixtures for %s.",
            len(combined_events),
            sport.slug,
        )


def extract_player_position(player: dict[str, Any]) -> str | None:
    position = player.get("position")
    if isinstance(position, str):
        return position
    if isinstance(position, dict):
        return position.get("name") or position.get("shortName")

    primary_position = player.get("primaryPosition")
    if isinstance(primary_position, str):
        return primary_position
    if isinstance(primary_position, dict):
        return primary_position.get("name") or primary_position.get("shortName")

    return None


def upsert_roster_player(
    state: StructuredState,
    sport_slug: str,
    team_id: int,
    player: dict[str, Any],
) -> None:
    player_id = coerce_optional_int(player.get("id"))
    player_name = player.get("name")
    if not player_name:
        return

    team_source_id = f"{sport_slug}:{team_id}"
    team_row = state.teams.get(team_source_id)
    sport_name = (
        team_row["sport_name"]
        if team_row
        else sport_slug.replace("-", " ").title()
    )

    if player_id is not None:
        player_source_id = f"{sport_slug}:player:{player_id}"
    else:
        player_source_id = f"{sport_slug}:player:{team_id}:{player_name.lower()}"

    nationality = (player.get("country") or {}).get("name")

    state.players[player_source_id] = {
        "id": player_id or abs(hash(player_source_id)) % 2_000_000_000,
        "source_id": player_source_id,
        "team_id": team_id,
        "team_source_id": team_source_id,
        "name": player_name,
        "position": extract_player_position(player),
        "age": compute_age(player.get("dateOfBirthTimestamp")),
        "nationality": nationality,
        "photo_url": None,
        "team": team_row["name"] if team_row else None,
        "sport_slug": sport_slug,
        "sport_name": sport_name,
    }


def enrich_team_rosters(client: httpx.Client, state: StructuredState) -> None:
    processed = 0

    while state.pending_team_keys and processed < MAX_TEAM_ENRICHMENTS_PER_CYCLE:
        sport_slug, team_id = state.pending_team_keys.popleft()
        state.pending_team_set.discard((sport_slug, team_id))
        state.team_refreshed_at[(sport_slug, team_id)] = time.monotonic()

        try:
            payload = fetch_json(
                client,
                build_team_players_url(team_id),
                f"{sport_slug} team {team_id} players",
            )
            for item in payload.get("players", []):
                player = item.get("player") or item
                if isinstance(player, dict):
                    upsert_roster_player(state, sport_slug, team_id, player)

            processed += 1
        except Exception as error:  # noqa: BLE001
            LOGGER.warning(
                "Roster enrichment failed for %s team %s: %s",
                sport_slug,
                team_id,
                error,
            )
        finally:
            processed += 1


def upsert_standing_row(
    state: StructuredState,
    sport_slug: str,
    tournament_id: int,
    row: dict[str, Any],
) -> None:
    league_source_id = f"{sport_slug}:{tournament_id}"
    league = state.leagues.get(league_source_id)
    team = row.get("team") or {}
    team_id = coerce_optional_int(team.get("id"))
    team_source_id = f"{sport_slug}:{team_id}" if team_id is not None else None

    if team_id is not None and team_source_id not in state.teams:
        sport_name = (
            league["sport_name"]
            if league
            else sport_slug.replace("-", " ").title()
        )
        state.teams[team_source_id] = {
            "id": team_id,
            "source_id": team_source_id,
            "league_id": tournament_id,
            "league_source_id": league_source_id,
            "name": team.get("name") or "Unknown",
            "short_name": team.get("shortName"),
            "country": (team.get("country") or {}).get("name"),
            "founded": None,
            "venue": None,
            "logo_url": None,
            "league": league["name"] if league else None,
            "sport_slug": sport_slug,
            "sport_name": sport_name,
        }

    points = row.get("points")
    if points is None:
        points = row.get("score")
    if points is None:
        points = row.get("wins")

    standing_key = f"{sport_slug}:{tournament_id}:{team_id or row.get('position')}"
    state.standings[standing_key] = {
        "league_id": tournament_id,
        "league_source_id": league_source_id,
        "team_id": team_id,
        "team_source_id": team_source_id,
        "sport_slug": sport_slug,
        "sport_name": (
            league["sport_name"]
            if league
            else sport_slug.replace("-", " ").title()
        ),
        "position": coerce_int(row.get("position")),
        "team": team.get("name") or "Unknown",
        "played": coerce_int(row.get("matches") or row.get("played")),
        "wins": coerce_int(row.get("wins")),
        "draws": coerce_int(row.get("draws")),
        "losses": coerce_int(row.get("losses")),
        "goals_for": coerce_int(row.get("scoresFor") or row.get("goalsFor")),
        "goals_against": coerce_int(
            row.get("scoresAgainst") or row.get("goalsAgainst")
        ),
        "points": coerce_int(points),
        "form": str(row.get("form") or row.get("streak") or ""),
        "league": league["name"] if league else "Unknown",
    }


def enrich_league_standings(client: httpx.Client, state: StructuredState) -> None:
    processed = 0

    while (
        state.pending_standings_keys
        and processed < MAX_STANDINGS_ENRICHMENTS_PER_CYCLE
    ):
        sport_slug, tournament_id, season_id = state.pending_standings_keys.popleft()
        state.pending_standings_set.discard((sport_slug, tournament_id, season_id))
        state.standings_refreshed_at[(sport_slug, tournament_id, season_id)] = (
            time.monotonic()
        )

        try:
            payload = fetch_json(
                client,
                build_standings_url(tournament_id, season_id),
                f"{sport_slug} standings {tournament_id}/{season_id}",
            )
            for standing_group in payload.get("standings", []):
                for row in standing_group.get("rows", []):
                    if isinstance(row, dict):
                        upsert_standing_row(state, sport_slug, tournament_id, row)
            processed += 1
        except Exception as error:  # noqa: BLE001
            LOGGER.warning(
                "Standings enrichment failed for %s tournament %s season %s: %s",
                sport_slug,
                tournament_id,
                season_id,
                error,
            )
        finally:
            processed += 1


def enrich_event_details(client: httpx.Client, state: StructuredState) -> None:
    processed = 0

    while (
        state.pending_detail_keys
        and processed < MAX_EVENT_DETAIL_ENRICHMENTS_PER_CYCLE
    ):
        sport_slug, match_id = state.pending_detail_keys.popleft()
        state.pending_detail_set.discard((sport_slug, match_id))
        state.detail_refreshed_at[(sport_slug, match_id)] = time.monotonic()

        fixture_source_id = f"{sport_slug}:{match_id}"
        fixture = state.fixtures.get(fixture_source_id)
        if fixture is None:
            processed += 1
            continue

        try:
            comments_payload: dict[str, Any] | None = None
            incidents_payload: dict[str, Any] | None = None

            try:
                comments_payload = fetch_json(
                    client,
                    build_event_comments_url(match_id),
                    f"{sport_slug} comments {match_id}",
                )
            except Exception:
                comments_payload = None

            if comments_payload is None or not comments_payload.get("comments"):
                try:
                    incidents_payload = fetch_json(
                        client,
                        build_event_incidents_url(match_id),
                        f"{sport_slug} incidents {match_id}",
                    )
                except Exception:
                    incidents_payload = None

            if comments_payload and comments_payload.get("comments"):
                for comment in comments_payload.get("comments", []):
                    comment_id = comment.get("id") or abs(hash(comment.get("text", ""))) % 2_000_000_000
                    state.comments[f"{fixture_source_id}:comment:{comment_id}"] = {
                        "source_id": f"{fixture_source_id}:comment:{comment_id}",
                        "fixture_id": match_id,
                        "sport_slug": fixture["sport_slug"],
                        "sport_name": fixture["sport_name"],
                        "league": fixture["league"],
                        "home_team": fixture["home_team"],
                        "away_team": fixture["away_team"],
                        "is_live": fixture["status"] not in {"Not started", "FT", "Finished"},
                        "sequence": coerce_int(comment.get("sequence") or 0),
                        "minute": coerce_optional_int(comment.get("time")),
                        "type": comment.get("type") or "comment",
                        "text": comment.get("text") or "",
                        "is_home": comment.get("isHome"),
                        "player": comment.get("playerName") or (comment.get("player") or {}).get("name"),
                    }
            elif incidents_payload and incidents_payload.get("incidents"):
                for incident in incidents_payload.get("incidents", []):
                    row = incident_to_comment_row(fixture, incident)
                    if row is not None:
                        state.comments[row["source_id"]] = row
            elif fixture["status"] not in {"Not started", "FT", "Finished"}:
                fallback_comment = build_fallback_comment(fixture, processed)
                state.comments[fallback_comment["source_id"]] = fallback_comment

            try:
                media_payload = fetch_json(
                    client,
                    build_event_media_url(match_id),
                    f"{sport_slug} media {match_id}",
                )
            except Exception:
                media_payload = None

            if media_payload and media_payload.get("media"):
                for media in media_payload.get("media", []):
                    media_id = media.get("id") or abs(hash(media.get("url", ""))) % 2_000_000_000
                    state.videos[f"{fixture_source_id}:video:{media_id}"] = {
                        "source_id": f"{fixture_source_id}:video:{media_id}",
                        "fixture_id": match_id,
                        "sport_slug": fixture["sport_slug"],
                        "sport_name": fixture["sport_name"],
                        "league": fixture["league"],
                        "home_team": fixture["home_team"],
                        "away_team": fixture["away_team"],
                        "title": media.get("title") or f"{fixture['home_team']} vs {fixture['away_team']}",
                        "subtitle": media.get("subtitle"),
                        "url": media.get("url") or media.get("sourceUrl"),
                        "thumbnail_url": media.get("thumbnailUrl"),
                        "media_type": str(media.get("mediaType")) if media.get("mediaType") is not None else None,
                        "published_at": iso_from_timestamp(coerce_optional_int(media.get("createdAtTimestamp"))),
                        "is_highlight": bool(media.get("keyHighlight")),
                    }

            try:
                odds_payload = fetch_json(
                    client,
                    build_event_odds_url(match_id),
                    f"{sport_slug} odds {match_id}",
                )
            except Exception:
                odds_payload = None

            if odds_payload and odds_payload.get("markets"):
                for market in odds_payload.get("markets", [])[:12]:
                    market_key = (
                        f"{fixture_source_id}:odds:"
                        f"{market.get('marketId') or market.get('id') or market.get('marketName')}"
                    )
                    normalized_choices = normalize_choice_probabilities(
                        [
                            {
                                "name": choice.get("name") or "Selection",
                                "fractional_value": choice.get("fractionalValue"),
                                "decimal_value": fractional_to_decimal(choice.get("fractionalValue")),
                                "winning": choice.get("winning"),
                            }
                            for choice in market.get("choices", [])
                        ]
                    )
                    state.odds[market_key] = {
                        "source_id": market_key,
                        "fixture_id": match_id,
                        "sport_slug": fixture["sport_slug"],
                        "sport_name": fixture["sport_name"],
                        "league": fixture["league"],
                        "home_team": fixture["home_team"],
                        "away_team": fixture["away_team"],
                        "market_id": coerce_optional_int(market.get("marketId") or market.get("id")),
                        "market_name": market.get("marketName") or "Market",
                        "market_group": market.get("marketGroup"),
                        "market_period": market.get("marketPeriod"),
                        "is_live": bool(market.get("isLive")),
                        "suspended": bool(market.get("suspended")),
                        "source": "upstream_odds",
                        "choices": normalized_choices,
                    }

                    if len(normalized_choices) >= 2:
                        probability_key = f"{fixture_source_id}:probability:{market.get('marketName') or 'match'}"
                        state.probabilities[probability_key] = {
                            "source_id": probability_key,
                            "fixture_id": match_id,
                            "sport_slug": fixture["sport_slug"],
                            "sport_name": fixture["sport_name"],
                            "league": fixture["league"],
                            "home_team": fixture["home_team"],
                            "away_team": fixture["away_team"],
                            "market": market.get("marketName") or "Match winner",
                            "source": "upstream_odds",
                            "home_probability": normalized_choices[0].get("probability"),
                            "draw_probability": (
                                normalized_choices[1].get("probability")
                                if len(normalized_choices) == 3
                                else None
                            ),
                            "away_probability": normalized_choices[-1].get("probability"),
                            "updated_at": datetime.now(UTC).isoformat(),
                        }
        except Exception as error:  # noqa: BLE001
            LOGGER.warning(
                "Event detail enrichment failed for %s fixture %s: %s",
                sport_slug,
                match_id,
                error,
            )
        finally:
            processed += 1


def persist_live_snapshot(
    selected_sports: list[SportDefinition],
    state: StructuredState,
) -> None:
    matches = [
        match
        for sport in selected_sports
        for match in state.live_matches.get(sport.slug, {}).values()
    ]
    matches.sort(key=lambda match: match.get("starts_at") or "", reverse=False)

    leagues = list(state.leagues.values())
    leagues.sort(key=lambda row: (row["sport_name"], row["name"]))

    teams = list(state.teams.values())
    teams.sort(key=lambda row: (row["sport_name"], row["name"]))

    players = list(state.players.values())
    players.sort(key=lambda row: (row["sport_name"], row["name"]))

    fixtures = list(state.fixtures.values())
    fixtures.sort(key=lambda row: row.get("starts_at") or "", reverse=True)

    standings = list(state.standings.values())
    standings.sort(key=lambda row: (row["league"], row["position"], row["team"]))

    comments = list(state.comments.values())
    comments.sort(
        key=lambda row: (
            row["sport_name"],
            row["fixture_id"],
            row["sequence"],
            row["minute"] if row["minute"] is not None else -1,
        )
    )

    videos = list(state.videos.values())
    videos.sort(
        key=lambda row: (row["sport_name"], row["published_at"] or "", row["title"]),
        reverse=True,
    )

    odds = list(state.odds.values())
    odds.sort(key=lambda row: (row["sport_name"], row["fixture_id"], row["market_name"]))

    probabilities = list(state.probabilities.values())
    probabilities.sort(key=lambda row: (row["sport_name"], row["fixture_id"], row["market"]))

    snapshot = {
        "updated_at": datetime.now(UTC).isoformat(),
        "count": len(matches),
        "sports": [
            {
                "slug": sport.slug,
                "name": sport.name,
                "live_count": len(state.live_matches.get(sport.slug, {})),
                "updated_at": state.sport_updated_at.get(sport.slug),
                "endpoint": build_live_url(sport),
            }
            for sport in selected_sports
        ],
        "matches": matches,
        "leagues": leagues,
        "teams": teams,
        "players": players,
        "fixtures": fixtures,
        "standings": standings,
        "comments": comments,
        "videos": videos,
        "odds": odds,
        "probabilities": probabilities,
        "structured_counts": {
            "leagues": len(leagues),
            "teams": len(teams),
            "players": len(players),
            "fixtures": len(fixtures),
            "standings": len(standings),
            "comments": len(comments),
            "videos": len(videos),
            "odds": len(odds),
            "probabilities": len(probabilities),
        },
    }

    LIVE_SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_path = LIVE_SNAPSHOT_PATH.with_suffix(".tmp")
    temp_path.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temp_path.replace(LIVE_SNAPSHOT_PATH)


def persist_snapshot_to_database(state: StructuredState) -> None:
    if not DATABASE_URL or DATABASE_URL.startswith("memory://"):
        return

    try:
        import psycopg
    except ImportError:
        LOGGER.warning("psycopg is not installed; skipping database persistence.")
        return

    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            league_db_ids: dict[str, int] = {}
            for league in state.leagues.values():
                cursor.execute(
                    """
                    insert into leagues (
                      source_id,
                      sport_slug,
                      sport_name,
                      name,
                      country,
                      logo_url,
                      season
                    )
                    values (%s, %s, %s, %s, %s, %s, %s)
                    on conflict (source_id) do update
                    set
                      sport_slug = excluded.sport_slug,
                      sport_name = excluded.sport_name,
                      name = excluded.name,
                      country = excluded.country,
                      logo_url = excluded.logo_url,
                      season = excluded.season,
                      updated_at = now()
                    returning id
                    """,
                    (
                        league["source_id"],
                        league["sport_slug"],
                        league["sport_name"],
                        league["name"],
                        league["country"],
                        league["logo_url"],
                        league["season"],
                    ),
                )
                league_db_ids[league["source_id"]] = cursor.fetchone()[0]

            team_db_ids: dict[str, int] = {}
            for team in state.teams.values():
                cursor.execute(
                    """
                    insert into teams (
                      source_id,
                      league_id,
                      name,
                      short_name,
                      country,
                      founded,
                      venue,
                      logo_url
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    on conflict (source_id) do update
                    set
                      league_id = excluded.league_id,
                      name = excluded.name,
                      short_name = excluded.short_name,
                      country = excluded.country,
                      founded = excluded.founded,
                      venue = excluded.venue,
                      logo_url = excluded.logo_url,
                      updated_at = now()
                    returning id
                    """,
                    (
                        team["source_id"],
                        league_db_ids.get(team["league_source_id"]),
                        team["name"],
                        team["short_name"],
                        team["country"],
                        team["founded"],
                        team["venue"],
                        team["logo_url"],
                    ),
                )
                team_db_ids[team["source_id"]] = cursor.fetchone()[0]

            for player in state.players.values():
                cursor.execute(
                    """
                    insert into players (
                      source_id,
                      team_id,
                      name,
                      position,
                      age,
                      nationality,
                      photo_url
                    )
                    values (%s, %s, %s, %s, %s, %s, %s)
                    on conflict (source_id) do update
                    set
                      team_id = excluded.team_id,
                      name = excluded.name,
                      position = excluded.position,
                      age = excluded.age,
                      nationality = excluded.nationality,
                      photo_url = excluded.photo_url,
                      updated_at = now()
                    """,
                    (
                        player["source_id"],
                        team_db_ids.get(player["team_source_id"]),
                        player["name"],
                        player["position"],
                        player["age"],
                        player["nationality"],
                        player["photo_url"],
                    ),
                )

            for fixture in state.fixtures.values():
                league_db_id = league_db_ids.get(fixture["league_source_id"])
                home_team_db_id = team_db_ids.get(fixture["home_team_source_id"])
                away_team_db_id = team_db_ids.get(fixture["away_team_source_id"])

                if not league_db_id or not home_team_db_id or not away_team_db_id:
                    continue

                starts_at = (
                    datetime.fromisoformat(fixture["starts_at"])
                    if fixture["starts_at"]
                    else datetime.now(UTC)
                )

                cursor.execute(
                    """
                    insert into fixtures (
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
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    on conflict (source_id) do update
                    set
                      league_id = excluded.league_id,
                      home_team_id = excluded.home_team_id,
                      away_team_id = excluded.away_team_id,
                      starts_at = excluded.starts_at,
                      status = excluded.status,
                      minute = excluded.minute,
                      home_score = excluded.home_score,
                      away_score = excluded.away_score,
                      venue = excluded.venue,
                      updated_at = now()
                    """,
                    (
                        fixture["source_id"],
                        league_db_id,
                        home_team_db_id,
                        away_team_db_id,
                        starts_at,
                        fixture["status"],
                        fixture["minute"] or 0,
                        fixture["home_score"],
                        fixture["away_score"],
                        fixture["venue"],
                    ),
                )

            standings_by_league: dict[str, list[dict[str, Any]]] = {}
            for standing in state.standings.values():
                standings_by_league.setdefault(standing["league_source_id"], []).append(
                    standing
                )

            for league_source_id, rows in standings_by_league.items():
                league_db_id = league_db_ids.get(league_source_id)
                if not league_db_id:
                    continue

                cursor.execute(
                    "delete from standings where league_id = %s",
                    (league_db_id,),
                )

                for standing in rows:
                    team_db_id = team_db_ids.get(standing["team_source_id"])
                    if not team_db_id:
                        continue

                    cursor.execute(
                        """
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
                        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        on conflict (league_id, team_id) do update
                        set
                          position = excluded.position,
                          played = excluded.played,
                          wins = excluded.wins,
                          draws = excluded.draws,
                          losses = excluded.losses,
                          goals_for = excluded.goals_for,
                          goals_against = excluded.goals_against,
                          points = excluded.points,
                          form = excluded.form,
                          updated_at = now()
                        """,
                        (
                            league_db_id,
                            team_db_id,
                            standing["position"],
                            standing["played"],
                            standing["wins"],
                            standing["draws"],
                            standing["losses"],
                            standing["goals_for"],
                            standing["goals_against"],
                            standing["points"],
                            standing["form"],
                        ),
                    )

        connection.commit()


def run_scraper() -> None:
    selected_sports = resolve_selected_sports()
    state = StructuredState()
    completed_cycles = 0

    LOGGER.info(
        "Starting SofaScore structured scraper for sports: %s",
        ", ".join(sport.slug for sport in selected_sports),
    )

    with httpx.Client(
        http2=True,
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers=HEADERS,
        follow_redirects=True,
    ) as client:
        while True:
            cycle_started_at = time.monotonic()

            for sport in selected_sports:
                try:
                    sync_sport_events(client, state, sport)
                    persist_live_snapshot(selected_sports, state)
                except Exception as error:  # noqa: BLE001
                    LOGGER.exception(
                        "Scraper cycle failed for %s: %s",
                        sport.slug,
                        error,
                    )

            try:
                enrich_event_details(client, state)
                enrich_league_standings(client, state)
                enrich_team_rosters(client, state)
                persist_live_snapshot(selected_sports, state)
                persist_snapshot_to_database(state)
            except Exception as error:  # noqa: BLE001
                LOGGER.exception("Structured persistence failed: %s", error)

            completed_cycles += 1
            if MAX_CYCLES > 0 and completed_cycles >= MAX_CYCLES:
                LOGGER.info("Stopping after %s cycle(s).", completed_cycles)
                break

            elapsed = time.monotonic() - cycle_started_at
            sleep_seconds = max(0.0, FETCH_INTERVAL_SECONDS - elapsed)
            time.sleep(sleep_seconds)


if __name__ == "__main__":
    try:
        run_scraper()
    except KeyboardInterrupt:
        LOGGER.info("Scraper stopped by user.")
