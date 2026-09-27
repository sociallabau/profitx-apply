// Google Calendar, using plain fetch (no googleapis package). Same env vars as the workshop funnel:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//   GOOGLE_CALENDAR_ID        where bookings go (the "Gameplan Calls" calendar)
//   GOOGLE_BUSY_CALENDAR_IDS  comma-separated calendars to check for clashes (default: primary)
const b = require("./config");

const MIN = 60_000;
const API = "https://www.googleapis.com/calendar/v3";

const hasCreds = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
// Sample times + fake bookings so the page can be clicked through before Google is connected.
// Only ever on when DEMO_BOOKING=1 AND there are no Google credentials.
const demoMode = () => process.env.DEMO_BOOKING === "1" && !hasCreds();

const calendarId = () => process.env.GOOGLE_CALENDAR_ID || "primary";
const busyCalendarIds = () => [
  ...new Set([calendarId(), ...(process.env.GOOGLE_BUSY_CALENDAR_IDS ?? "primary").split(",").map((s) => s.trim()).filter(Boolean)]),
];

let token = { value: null, expires: 0 };
async function accessToken() {
  if (token.value && Date.now() < token.expires) return token.value;
  if (!hasCreds()) throw new Error("Google Calendar env vars are not set");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  const j = await res.json();
  token = { value: j.access_token, expires: Date.now() + (j.expires_in - 120) * 1000 };
  return token.value;
}

async function gcal(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar ${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function busyBetween(from, to) {
  if (demoMode()) return [];
  const ids = busyCalendarIds();
  const data = await gcal("/freeBusy", { timeMin: from.toISOString(), timeMax: to.toISOString(), items: ids.map((id) => ({ id })) });
  return ids.flatMap((id) => data.calendars?.[id]?.busy ?? []).map((x) => ({ start: Date.parse(x.start), end: Date.parse(x.end) }));
}

// Local (Brisbane) calendar date -> the UTC instant of HH:MM on that date.
function atLocal(y, m, d, h, min) {
  const pad = (n) => String(n).padStart(2, "0");
  return Date.parse(`${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00${b.utcOffset}`);
}

function localParts(ms) {
  const f = new Intl.DateTimeFormat("en-AU", { timeZone: b.timezone, year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(new Date(ms));
  const get = (t) => f.find((p) => p.type === t).value;
  return { y: +get("year"), m: +get("month"), d: +get("day"), wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")) };
}

const hm = (s) => s.split(":").map(Number);

// Fixed blocks from the config for one local date.
function blockedOn(y, m, d, wd) {
  return b.blocked.flatMap((x) => {
    if (!x.days.includes(wd)) return [];
    if (x.from) {
      const weeks = Math.round((atLocal(y, m, d, 12, 0) - Date.parse(`${x.from}T12:00:00${b.utcOffset}`)) / (7 * 24 * 60 * MIN));
      if (weeks < 0 || weeks % x.everyWeeks !== 0) return [];
    }
    return [{ start: atLocal(y, m, d, ...hm(x.start)), end: atLocal(y, m, d, ...hm(x.end)) }];
  });
}

const clash = (t, busy) => {
  const end = t + b.slotMinutes * MIN;
  return busy.some((x) => t < x.end + b.bufferMinutes * MIN && end + b.bufferMinutes * MIN > x.start);
};

// Seeded shuffle per day: the same "random" times all day, a new pick each day.
function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Picks 2-4 daytime slots: the best-ranked free morning and afternoon first, then the rest by rank,
// never two back-to-back.
function pickDay(key, grid, free) {
  const rand = seeded(key);
  const { min, max } = b.spotsPerDay;
  const want = min + Math.floor(rand() * (max - min + 1));
  const order = new Map(grid.map((t) => [t, rand()]));
  const ranked = grid.filter(free).sort((a, z) => order.get(a) - order.get(z));
  const isMorning = (t) => Number(new Date(t).toLocaleString("en-AU", { timeZone: b.timezone, hour: "numeric", hour12: false })) < 12;
  const step = (b.slotMinutes + b.bufferMinutes) * MIN;
  const picked = [];
  const tryAdd = (t) => {
    if (t === undefined || picked.length >= want || picked.includes(t) || picked.some((p) => Math.abs(p - t) <= step)) return;
    picked.push(t);
  };
  tryAdd(ranked.find(isMorning));
  tryAdd(ranked.find((t) => !isMorning(t)));
  ranked.forEach(tryAdd);
  return picked;
}

/** Open slot start times (ISO strings) for the next `daysAhead` booking days. */
async function openSlots() {
  const now = Date.now();
  const earliest = now + b.minNoticeHours * 60 * MIN;
  const days = [];

  let dayMs = now;
  for (let i = 0; i < 14 && days.length < b.daysAhead; i++, dayMs += 24 * 60 * MIN) {
    const { y, m, d, wd } = localParts(dayMs);
    if (!b.days.includes(wd)) continue;
    const blocks = blockedOn(y, m, d, wd);
    const ok = (t) => t >= earliest && !clash(t, blocks);
    const grid = [];
    for (let t = atLocal(y, m, d, b.startHour, 0); t + b.slotMinutes * MIN <= atLocal(y, m, d, b.endHour, 0); t += (b.slotMinutes + b.bufferMinutes) * MIN) grid.push(t);
    const extras = b.extraTimes.map((x) => atLocal(y, m, d, ...hm(x))).filter(ok);
    // Keep the full grid for ranking, so the daily pick doesn't depend on what's booked.
    if (grid.some(ok) || extras.length) days.push({ key: `${y}-${m}-${d}`, blocks, grid, extras });
  }
  const all = days.flatMap((x) => [...x.grid, ...x.extras]).filter((t) => t >= earliest);
  if (!all.length) return [];

  if (demoMode()) {
    // A few fixed sample times per day, no calendar lookup.
    return days.flatMap((day) => [day.grid[3], day.grid[9], day.grid[14]].filter((t) => t && t >= earliest)).map((t) => new Date(t).toISOString());
  }

  const busy = await busyBetween(new Date(Math.min(...all)), new Date(Math.max(...all) + b.slotMinutes * MIN));
  const out = [];
  for (const day of days) {
    const free = (t) => t >= earliest && !clash(t, busy) && !clash(t, day.blocks);
    out.push(...pickDay(day.key, day.grid, free), ...day.extras.filter(free));
  }
  return out.sort((a, z) => a - z).map((t) => new Date(t).toISOString());
}

async function isStillFree(startIso) {
  return (await openSlots()).includes(new Date(startIso).toISOString());
}

/** Creates the calendar event with a Google Meet link. Google emails the invite to the attendee. */
async function bookCall({ startIso, name, email, phone, business, answers }) {
  if (demoMode()) return { meetLink: null };
  const start = new Date(startIso);
  const end = new Date(start.getTime() + b.slotMinutes * MIN);
  const event = await gcal(`/calendars/${encodeURIComponent(calendarId())}/events?conferenceDataVersion=1&sendUpdates=all`, {
    summary: `${b.callTitle}: ${name}`,
    description: [
      "Booked from the ProfitX apply page.",
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : "",
      business ? `Business / website / Instagram: ${business}` : "",
      ...answers.flatMap(([q, a]) => ["", q, `-> ${a}`]),
    ].filter(Boolean).join("\n"),
    start: { dateTime: start.toISOString(), timeZone: b.timezone },
    end: { dateTime: end.toISOString(), timeZone: b.timezone },
    attendees: [{ email, displayName: name }],
    conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
  });
  return { meetLink: event.hangoutLink ?? null };
}

module.exports = { openSlots, isStillFree, bookCall, demoMode };
