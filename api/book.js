// Books a Gameplan Call (step 2): re-checks the slot is still free, creates the Google Calendar event
// with a Meet link (Google emails the invite), then tags the person "booked" in Kit.
const { parseApplication } = require("./_lib/application");
const { isStillFree, bookCall } = require("./_lib/calendar");
const { upsertSubscriber, tag } = require("./_lib/kit");
const b = require("./_lib/config");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const app = parseApplication(req.body);
  if (app.honeypot) return res.status(200).json({ ok: true, meetLink: null });
  if (!app.valid || !app.start || Number.isNaN(Date.parse(app.start))) {
    return res.status(400).json({ error: "Pick a time and check your details." });
  }
  // Only qualified applicants get a call.
  if (!app.qualified) return res.status(403).json({ error: "Not eligible for a call." });

  try {
    if (!(await isStillFree(app.start))) {
      return res.status(409).json({ error: "That time was just taken. Pick another one." });
    }
    const { meetLink } = await bookCall({
      startIso: app.start,
      name: app.name,
      email: app.email,
      phone: app.phone,
      business: app.business,
      answers: [
        ["What's your monthly revenue right now?", app.revenueLabel],
        ["What's holding you back the most?", app.blockerLabel],
        ["How ready are you to fix it?", app.urgencyLabel],
      ],
    });
    await upsertSubscriber({
      email: app.email,
      name: app.name,
      fields: { phone: app.phone, monthly_revenue: app.revenueLabel, biggest_blocker: app.blockerLabel, urgency: app.urgencyLabel },
    }).catch((e) => console.error("book: kit", e));
    await tag(app.email, process.env.KIT_TAG_BOOKED).catch((e) => console.error("book: kit tag", e));
    if (process.env.APPLICATION_WEBHOOK_URL) {
      fetch(process.env.APPLICATION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${b.callTitle} booked: ${app.name} (${app.email}) at ${app.start}` }),
      }).catch((e) => console.error("book: webhook", e));
    }
    console.log("BOOKED", JSON.stringify({ name: app.name, email: app.email, start: app.start }));
    return res.status(200).json({ ok: true, meetLink, start: new Date(app.start).toISOString() });
  } catch (e) {
    console.error("book", e);
    return res.status(500).json({ error: "Booking failed. Please try again." });
  }
};
