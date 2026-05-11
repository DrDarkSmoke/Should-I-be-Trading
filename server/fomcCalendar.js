const FED_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm?embed=true";

const FALLBACK_MEETINGS = [
  "2026-01-28",
  "2026-03-18",
  "2026-04-29",
  "2026-06-17",
  "2026-07-29",
  "2026-09-16",
  "2026-10-28",
  "2026-12-09",
  "2027-01-27",
  "2027-03-17",
  "2027-04-28",
  "2027-06-09",
  "2027-07-28",
  "2027-09-15",
  "2027-10-27",
  "2027-12-08"
];

const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

function decisionTime(dateString) {
  return new Date(`${dateString}T14:00:00-04:00`);
}

function fallbackDates() {
  return FALLBACK_MEETINGS.map((date) => ({
    date,
    timestamp: decisionTime(date),
    source: "fallback"
  }));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;|&#8211;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ");
}

function parseFedCalendar(html) {
  const text = stripHtml(html);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const meetings = [];
  let currentYear = null;
  let currentMonth = null;

  for (const line of lines) {
    const yearMatch = line.match(/^(20\d{2}) FOMC Meetings$/i);
    if (yearMatch) {
      currentYear = Number(yearMatch[1]);
      currentMonth = null;
      continue;
    }

    const monthKey = line.toLowerCase();
    if (MONTHS[monthKey] !== undefined) {
      currentMonth = MONTHS[monthKey];
      continue;
    }

    const dateMatch = line.match(/^(\d{1,2})(?:-(\d{1,2}))?\*?$/);
    if (currentYear && currentMonth !== null && dateMatch) {
      const day = Number(dateMatch[2] ?? dateMatch[1]);
      const date = new Date(Date.UTC(currentYear, currentMonth, day)).toISOString().slice(0, 10);
      meetings.push({
        date,
        timestamp: decisionTime(date),
        source: "federalreserve.gov"
      });
    }
  }

  return meetings;
}

export async function getFomcRisk(now = new Date()) {
  let meetings = fallbackDates();
  let source = "fallback";

  try {
    const response = await fetch(FED_CALENDAR_URL, {
      headers: {
        Accept: "text/html,*/*",
        "User-Agent": "Mozilla/5.0 ShouldIBeTrading/1.0"
      }
    });
    if (response.ok) {
      const parsed = parseFedCalendar(await response.text());
      if (parsed.length >= 8) {
        meetings = parsed;
        source = "federalreserve.gov";
      }
    }
  } catch {
    source = "fallback";
  }

  const upcoming = meetings
    .filter((meeting) => meeting.timestamp.getTime() >= now.getTime() - 1000 * 60 * 60 * 12)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const next = upcoming[0] ?? null;
  const hoursUntil = next ? (next.timestamp.getTime() - now.getTime()) / 36e5 : null;
  const sameDay = next ? next.date === now.toISOString().slice(0, 10) : false;

  return {
    source,
    sourceUrl: FED_CALENDAR_URL,
    nextEvent: next
      ? {
          label: "FOMC policy decision",
          date: next.date,
          timestamp: next.timestamp.toISOString(),
          hoursUntil: Math.round(hoursUntil)
        }
      : null,
    within72Hours: Number.isFinite(hoursUntil) ? hoursUntil >= -12 && hoursUntil <= 72 : false,
    sameDay
  };
}
