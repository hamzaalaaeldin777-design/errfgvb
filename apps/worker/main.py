import atexit
import json
import logging
import os
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

BASE_URL = "https://api.sofascore.com/api/v1/sport/{sport_slug}/events/live"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Referer": "https://www.sofascore.com/",
    "Origin": "https://www.sofascore.com",
}
REQUEST_TIMEOUT_SECONDS = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "20"))
REQUEST_THROTTLE_SECONDS = float(os.getenv("REQUEST_THROTTLE_SECONDS", "3"))
FETCH_INTERVAL_SECONDS = float(os.getenv("FETCH_INTERVAL_SECONDS", "10"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "5"))
BACKOFF_BASE_SECONDS = float(os.getenv("BACKOFF_BASE_SECONDS", "1.5"))
PLAYWRIGHT_WAIT_MS = int(os.getenv("PLAYWRIGHT_WAIT_MS", "1500"))
ENABLE_PLAYWRIGHT_FALLBACK = (
    os.getenv("ENABLE_PLAYWRIGHT_FALLBACK", "true").lower() == "true"
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
class LiveMatch:
    sport_slug: str
    sport_name: str
    match_id: int
    tournament_id: int | None
    tournament_name: str
    country_name: str | None
    season_name: str | None
    home_team_id: int | None
    home_team: str
    away_team_id: int | None
    away_team: str
    home_score: int
    away_score: int
    match_status: str
    match_minute: int | None
    start_timestamp: int | None


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
    return BASE_URL.format(sport_slug=sport.slug)


def coerce_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def compute_match_minute(event: dict[str, Any]) -> int | None:
    status = event.get("status") or {}
    status_type = status.get("type")

    if status_type != "inprogress":
        return None

    event_time = event.get("time") or {}
    description = (status.get("description") or "").lower()
    period_start = event_time.get("currentPeriodStartTimestamp")
    injury_time = (
        event_time.get("injuryTime2")
        or event_time.get("injuryTime1")
        or event_time.get("extra")
        or 0
    )

    if not period_start:
        return 45 if "half" in description and "1st" not in description else None

    elapsed_seconds = max(0, int(time.time()) - int(period_start))
    elapsed_minutes = elapsed_seconds // 60

    if "2nd" in description:
        return min(120, 45 + elapsed_minutes + int(injury_time))

    return min(60, elapsed_minutes + int(injury_time))


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


def fetch_with_playwright_direct(sport: SportDefinition) -> dict[str, Any]:
    page = ensure_playwright_page()
    throttle_requests()
    response = page.goto(build_live_url(sport), wait_until="domcontentloaded")

    if not response or response.status != 200:
        raise RuntimeError(
            f"Playwright fallback returned status code {response.status if response else 'unknown'} for {sport.slug}."
        )

    payload = page.text_content("body")
    LOGGER.info("Fetched live matches via Playwright fallback for %s.", sport.slug)
    return json.loads(payload or "{}")


def fetch_live_matches(client: httpx.Client, sport: SportDefinition) -> dict[str, Any]:
    global HTTPX_BLOCKED

    if HTTPX_BLOCKED and ENABLE_PLAYWRIGHT_FALLBACK:
        return fetch_with_playwright_direct(sport)

    backoff_seconds = BACKOFF_BASE_SECONDS
    url = build_live_url(sport)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            throttle_requests()
            response = client.get(url, headers=HEADERS)

            if response.status_code == 200:
                return response.json()

            if response.status_code == 403 and ENABLE_PLAYWRIGHT_FALLBACK:
                LOGGER.warning(
                    "Received 403 from httpx for %s on attempt %s/%s. Trying Playwright session.",
                    sport.slug,
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
                    sport.slug,
                )
                return fetch_with_playwright_direct(sport)

            LOGGER.warning(
                "Unexpected status code %s for %s on attempt %s/%s.",
                response.status_code,
                sport.slug,
                attempt,
                MAX_RETRIES,
            )
        except httpx.HTTPError as error:
            LOGGER.error(
                "HTTP error for %s on attempt %s/%s: %s",
                sport.slug,
                attempt,
                MAX_RETRIES,
                error,
            )

        if attempt < MAX_RETRIES:
            LOGGER.info(
                "Retrying %s in %.1f seconds.",
                sport.slug,
                backoff_seconds,
            )
            time.sleep(backoff_seconds)
            backoff_seconds *= 2

    if ENABLE_PLAYWRIGHT_FALLBACK:
        HTTPX_BLOCKED = True
        LOGGER.warning(
            "httpx retries exhausted for %s. Escalating to direct Playwright request.",
            sport.slug,
        )
        return fetch_with_playwright_direct(sport)

    raise RuntimeError(f"Failed to fetch live matches for {sport.slug}.")


def extract_competitors(
    event: dict[str, Any],
) -> tuple[int | None, str, int | None, str]:
    home_team = event.get("homeTeam") or event.get("homeCompetitor") or {}
    away_team = event.get("awayTeam") or event.get("awayCompetitor") or {}

    if home_team or away_team:
        return (
            home_team.get("id"),
            home_team.get("name", "Home"),
            away_team.get("id"),
            away_team.get("name", "Away"),
        )

    participants = event.get("participants") or event.get("competitors") or []
    if len(participants) >= 2:
        first = participants[0] or {}
        second = participants[1] or {}
        return (
            first.get("id"),
            first.get("name", "Home"),
            second.get("id"),
            second.get("name", "Away"),
        )

    return (None, "Home", None, event.get("name", "Away"))


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


def parse_matches(
    payload: dict[str, Any], sport: SportDefinition
) -> list[LiveMatch]:
    matches: list[LiveMatch] = []

    for event in payload.get("events", []):
        tournament = event.get("tournament") or {}
        unique_tournament = tournament.get("uniqueTournament") or {}
        category = tournament.get("category") or {}
        season = event.get("season") or {}
        home_team_id, home_team, away_team_id, away_team = extract_competitors(event)
        home_score, away_score = extract_scores(event)

        matches.append(
            LiveMatch(
                sport_slug=sport.slug,
                sport_name=sport.name,
                match_id=int(event.get("id", 0)),
                tournament_id=unique_tournament.get("id") or tournament.get("id"),
                tournament_name=unique_tournament.get("name")
                or tournament.get("name")
                or "Unknown tournament",
                country_name=category.get("name"),
                season_name=season.get("name"),
                home_team_id=home_team_id,
                home_team=home_team,
                away_team_id=away_team_id,
                away_team=away_team,
                home_score=home_score,
                away_score=away_score,
                match_status=(event.get("status") or {}).get("description", "Unknown"),
                match_minute=compute_match_minute(event),
                start_timestamp=event.get("startTimestamp"),
            )
        )

    return matches


def format_match(match: LiveMatch) -> str:
    time_suffix = (
        f"{match.match_minute}'" if match.match_minute is not None else match.match_status
    )
    return (
        f"[{match.sport_name}] {match.home_team} {match.home_score} - "
        f"{match.away_score} {match.away_team} ({time_suffix})"
    )


def emit_line(message: str) -> None:
    sys.stdout.buffer.write(f"{message}\n".encode("utf-8", errors="replace"))
    sys.stdout.flush()


def persist_live_snapshot(
    selected_sports: list[SportDefinition],
    sport_matches: dict[str, list[LiveMatch]],
    sport_updated_at: dict[str, str],
) -> None:
    matches = [
        {
            "sport_slug": match.sport_slug,
            "sport_name": match.sport_name,
            "match_id": match.match_id,
            "league": match.tournament_name,
            "country": match.country_name,
            "season": match.season_name,
            "home_team": match.home_team,
            "away_team": match.away_team,
            "home_score": match.home_score,
            "away_score": match.away_score,
            "score": f"{match.home_score}-{match.away_score}",
            "minute": match.match_minute,
            "status": match.match_status,
            "starts_at": (
                datetime.fromtimestamp(match.start_timestamp, tz=UTC).isoformat()
                if match.start_timestamp
                else None
            ),
        }
        for sport in selected_sports
        for match in sport_matches.get(sport.slug, [])
    ]

    snapshot = {
        "updated_at": datetime.now(UTC).isoformat(),
        "count": len(matches),
        "sports": [
            {
                "slug": sport.slug,
                "name": sport.name,
                "live_count": len(sport_matches.get(sport.slug, [])),
                "updated_at": sport_updated_at.get(sport.slug),
                "endpoint": build_live_url(sport),
            }
            for sport in selected_sports
        ],
        "matches": matches,
    }

    LIVE_SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_path = LIVE_SNAPSHOT_PATH.with_suffix(".tmp")
    temp_path.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temp_path.replace(LIVE_SNAPSHOT_PATH)


def persist_matches(matches: list[LiveMatch]) -> None:
    if not DATABASE_URL or DATABASE_URL.startswith("memory://"):
        return

    try:
        import psycopg
    except ImportError:
        LOGGER.warning("psycopg is not installed; skipping database persistence.")
        return

    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            for match in matches:
                if (
                    not match.tournament_id
                    or not match.home_team_id
                    or not match.away_team_id
                    or not match.start_timestamp
                ):
                    continue

                league_source_id = f"{match.sport_slug}:{match.tournament_id}"
                home_source_id = f"{match.sport_slug}:{match.home_team_id}"
                away_source_id = f"{match.sport_slug}:{match.away_team_id}"
                fixture_source_id = f"{match.sport_slug}:{match.match_id}"

                cursor.execute(
                    """
                    insert into leagues (source_id, sport_slug, sport_name, name, country, season)
                    values (%s, %s, %s, %s, %s, %s)
                    on conflict (source_id) do update
                    set
                      sport_slug = excluded.sport_slug,
                      sport_name = excluded.sport_name,
                      name = excluded.name,
                      country = coalesce(excluded.country, leagues.country),
                      season = coalesce(excluded.season, leagues.season),
                      updated_at = now()
                    returning id
                    """,
                    (
                        league_source_id,
                        match.sport_slug,
                        match.sport_name,
                        match.tournament_name,
                        match.country_name,
                        match.season_name or "Live",
                    ),
                )
                league_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    insert into teams (source_id, league_id, name)
                    values (%s, %s, %s)
                    on conflict (source_id) do update
                    set
                      league_id = excluded.league_id,
                      name = excluded.name,
                      updated_at = now()
                    returning id
                    """,
                    (home_source_id, league_id, match.home_team),
                )
                home_db_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    insert into teams (source_id, league_id, name)
                    values (%s, %s, %s)
                    on conflict (source_id) do update
                    set
                      league_id = excluded.league_id,
                      name = excluded.name,
                      updated_at = now()
                    returning id
                    """,
                    (away_source_id, league_id, match.away_team),
                )
                away_db_id = cursor.fetchone()[0]

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
                      away_score
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                      updated_at = now()
                    """,
                    (
                        fixture_source_id,
                        league_id,
                        home_db_id,
                        away_db_id,
                        datetime.fromtimestamp(match.start_timestamp, tz=UTC),
                        match.match_status,
                        match.match_minute or 0,
                        match.home_score,
                        match.away_score,
                    ),
                )

        connection.commit()


def run_scraper() -> None:
    selected_sports = resolve_selected_sports()
    LOGGER.info(
        "Starting SofaScore live scraper for sports: %s",
        ", ".join(sport.slug for sport in selected_sports),
    )

    sport_matches: dict[str, list[LiveMatch]] = {
        sport.slug: [] for sport in selected_sports
    }
    sport_updated_at: dict[str, str] = {}

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
                    payload = fetch_live_matches(client, sport)
                    matches = parse_matches(payload, sport)
                    sport_matches[sport.slug] = matches
                    sport_updated_at[sport.slug] = datetime.now(UTC).isoformat()
                    persist_live_snapshot(selected_sports, sport_matches, sport_updated_at)
                    persist_matches(matches)

                    if not matches:
                        LOGGER.info("No live events returned for %s.", sport.slug)
                    else:
                        LOGGER.info(
                            "Fetched %s live events for %s.",
                            len(matches),
                            sport.slug,
                        )
                        for match in matches:
                            emit_line(format_match(match))
                except Exception as error:  # noqa: BLE001
                    LOGGER.exception(
                        "Scraper cycle failed for %s: %s",
                        sport.slug,
                        error,
                    )

            elapsed = time.monotonic() - cycle_started_at
            sleep_seconds = max(0.0, FETCH_INTERVAL_SECONDS - elapsed)
            time.sleep(sleep_seconds)


if __name__ == "__main__":
    try:
        run_scraper()
    except KeyboardInterrupt:
        LOGGER.info("Scraper stopped by user.")
