// Saves an application (step 1). Runs when someone submits their details, before they pick a time,
// so people who don't finish booking are still captured.
//
// Where it goes (all optional, use any combination):
//   KIT_API_KEY (+ KIT_TAG_APPLIED / KIT_TAG_QUALIFIED / KIT_TAG_UNQUALIFIED)  -> Kit subscriber + tags
//   APPLICATION_WEBHOOK_URL                                                    -> any URL that accepts JSON (Slack, Zapier, Make, GHL)
// It is always written to the Vercel function logs too (search for APPLICATION).
//
// Everyone who applies gets to book a call (no revenue gate) — `qualified` is kept only as
// extra info on the lead (it also picks which Kit tag they get).
const { parseApplication } = require("./_lib/application");
const { upsertSubscriber, tag } = require("./_lib/kit");

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) console.error("apply: webhook", res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

function kitFields(app) {
  return {
    phone: app.phone,
    business: app.business,
    monthly_revenue: app.revenueLabel,
    video_work: app.workLabel,
    biggest_blocker: app.blockerLabel,
    lead_source: app.leadsLabel,
    revenue_goal: app.goalLabel,
    urgency: app.urgencyLabel,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const app = parseApplication(req.body);
  // Honeypot: real people never fill this hidden field. Pretend it worked.
  if (app.honeypot) return res.status(200).json({ ok: true });
  if (!app.valid) return res.status(400).json({ ok: false, error: "invalid" });

  console.log("APPLICATION", JSON.stringify({ ...app, receivedAt: new Date().toISOString() }));

  const configured = !!(process.env.KIT_API_KEY || process.env.APPLICATION_WEBHOOK_URL);
  let delivered = false;
  try {
    if (process.env.KIT_API_KEY) {
      const ok = await upsertSubscriber({ email: app.email, name: app.name, fields: kitFields(app) });
      await tag(app.email, process.env.KIT_TAG_APPLIED);
      await tag(app.email, app.qualified ? process.env.KIT_TAG_QUALIFIED : process.env.KIT_TAG_UNQUALIFIED);
      if (ok) delivered = true;
    }
    if (process.env.APPLICATION_WEBHOOK_URL) {
      const text = `New application: ${app.name} (${app.email}, ${app.phone})\n${app.business}\n` +
        `Revenue: ${app.revenueLabel} | Work: ${app.workLabel} | Blocker: ${app.blockerLabel}\n` +
        `Leads from: ${app.leadsLabel} | 12mo goal: ${app.goalLabel} | Urgency: ${app.urgencyLabel}\n` +
        (app.qualified ? "$10K+ a month" : "Under $10K a month");
      if (await postJson(process.env.APPLICATION_WEBHOOK_URL, { text, ...app, honeypot: undefined })) delivered = true;
    }
  } catch (e) {
    console.error("apply: delivery error", e);
  }
  // A destination is set up but every one failed: let the page say so, so they can retry.
  if (configured && !delivered) return res.status(502).json({ ok: false, error: "delivery" });
  return res.status(200).json({ ok: true });
};
