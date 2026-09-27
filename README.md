# ProfitX apply page

One screen, no scroll: headline, one video, an **Apply now** button. One outcome: a booked Gameplan Call.

Flow: Apply now -> 3 questions -> name / email / mobile / business -> pick a time -> booked.
Applicants under $10K a month are saved as applications but not offered a call (they see a "we'll email you next steps" message).

No framework or build step: `index.html` is the page and `api/` is a handful of small Vercel functions.

## Change things

Everything you'd edit is in the `CONFIG` block near the bottom of `index.html`:
headline, sub-line, video embed URL, questions and options, thank-you text, Meta Pixel id.

- **Video:** paste an *embed* URL into `videoUrl` (Wistia `.../embed/iframe/ID`, YouTube `.../embed/ID`, Vimeo `player.vimeo.com/video/ID`).
- **Who gets a call:** `qualified` in `api/_lib/config.js` (currently $10K+ a month, same as the workshop funnel).
- **Call times, length, days:** `api/_lib/config.js`. It mirrors `funnel.booking` in `profitx-funnel`, so change both together.

## Calendar (same as the workshop funnel)

Bookings use the same Google Calendar setup as `profitx-funnel`: they check free/busy on your calendars, then create a "Gameplan Call: Name" event in `GOOGLE_CALENDAR_ID` with a Google Meet link, and Google emails the invite. The Vercel project needs the same five `GOOGLE_*` variables (see `.env.example`).

## Where applications go

- **Google Calendar:** every booked call.
- **Kit** (`KIT_API_KEY` + tag ids): every applicant, with phone, monthly revenue, blocker and urgency (the workshop funnel's field names). Tags: applied, qualified / unqualified, booked.
- **`APPLICATION_WEBHOOK_URL`** (optional): posts each application and booking as JSON to Slack / Zapier / Make / GHL.
- **Vercel logs:** every application is also logged as `APPLICATION` as a safety net.

The business / website / Instagram answer goes to the calendar event, the webhook and the logs. To keep it in Kit too, create a `business_link` custom field there and add it to `fields` in `api/apply.js` and `api/book.js`.

## Run and deploy

```bash
npx vercel dev            # local, with the /api functions
npx vercel --prod --yes   # deploy
```

Local testing without Google: set `DEMO_BOOKING=1` (sample times, fake bookings). Never set it in production.

Git email for commits here is sociallabau@gmail.com (Vercel blocks deploys from an email that isn't linked to GitHub).
