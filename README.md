# ProfitX apply page

One screen, no scroll: headline, one video, an **Apply now** button. One outcome: a booked Gameplan Call.

Flow: Apply now -> 6 questions -> name / email / mobile / business -> pick a time -> booked. Everyone who applies gets to book a call; the questions (same wording as the workshop funnel) are just extra info on the lead, not a gate.

No framework or build step: `index.html` is the page and `api/` is a handful of small Vercel functions.

## Change things

Everything you'd edit is in the `CONFIG` block near the bottom of `index.html`:
headline, sub-line, video embed URL, questions and options, thank-you text, Meta Pixel id.

- **Video:** paste an *embed* URL into `videoUrl` (Wistia `.../embed/iframe/ID`, YouTube `.../embed/ID`, Vimeo `player.vimeo.com/video/ID`).
- **Questions:** the `questions` array in `index.html`'s `CONFIG`. They match the workshop funnel's wording (`revenueOptions` + `bookingQuestions` in `profitx-funnel/src/config/funnel.ts`) so both funnels send Kit the same values.
- **"Qualified" tag only, no gate:** `qualified` in `api/_lib/config.js` ($10K+ a month) just picks the Kit tag and shows up in the webhook text — it doesn't stop anyone from booking. Remove `app.qualified` from `api/apply.js` / `api/book.js` if you don't want that tag either.
- **Call times, length, days:** `api/_lib/config.js`. It mirrors `funnel.booking` in `profitx-funnel`, so change both together.

## Calendar (same as the workshop funnel)

Bookings use the same Google Calendar setup as `profitx-funnel`: they check free/busy on your calendars, then create a "Gameplan Call: Name" event in `GOOGLE_CALENDAR_ID` with a Google Meet link, and Google emails the invite. The Vercel project needs the same five `GOOGLE_*` variables (see `.env.example`).

## Where applications go

- **Google Calendar:** every booked call.
- **Kit** (`KIT_API_KEY` + tag ids): every applicant, with phone, business, monthly revenue, video work, blocker, lead source, 12-month goal and urgency — the same custom field names the workshop funnel uses (plus a new `business` field; create it in Kit before sending real traffic, or that one value is silently dropped). Tags: applied, qualified / unqualified, booked.
- **`APPLICATION_WEBHOOK_URL`** (optional): posts each application and booking as JSON to Slack / Zapier / Make / GHL.
- **Vercel logs:** every application is also logged as `APPLICATION` as a safety net.

## Run and deploy

```bash
npx vercel dev            # local, with the /api functions
npx vercel --prod --yes   # deploy
```

Local testing without Google: set `DEMO_BOOKING=1` (sample times, fake bookings). Never set it in production.

Git email for commits here is sociallabau@gmail.com (Vercel blocks deploys from an email that isn't linked to GitHub).
