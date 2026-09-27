// Books a Gameplan Call (step 2): re-checks the slot is still free, creates the Google Calendar event
// with a Meet link (Google emails the invite), then tags the person "booked" in Kit.
// Every applicant can book — revenue is collected as info on the lead, not a gate.
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
        ["What kind of video work do you mainly do?", app.workLabel],
        ["What's the biggest thing holding you back right now?", app.blockerLabel],
        ["Where do most of your leads come from?", app.leadsLabel],
        ["Where would you like your monthly revenue to be in 12 months?", app.goalLabel],
        ["What's the urgency to solve this?", app.urgencyLabel],
      ],
    });
    await upsertSubscriber({
      email: app.email,
      name: app.name,
      fields: {
        phone: app.phone, business: app.business, monthly_revenue: app.revenueLabel, video_work: app.workLabel,
        biggest_blocker: app.blockerLabel, lead_source: app.leadsLabel, revenue_goal: app.goalLabel, urgency: app.urgencyLabel,
      },
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
