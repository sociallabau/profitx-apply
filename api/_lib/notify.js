// Emails each new application to NOTIFY_EMAIL (default dan@danwilmott.com) through Resend.
// Needs RESEND_API_KEY; RESEND_FROM should be an address on a domain verified in Resend
// (falls back to Resend's shared sender, which only delivers to the Resend account owner).
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function emailApplication(app) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const rows = [
    ["Name", app.name], ["Email", app.email], ["Mobile", app.phone], ["Business", app.business],
    ["Monthly revenue", app.revenueLabel], ["Video work", app.workLabel], ["Biggest blocker", app.blockerLabel],
    ["Leads from", app.leadsLabel], ["12-month goal", app.goalLabel], ["Urgency", app.urgencyLabel],
    ["Source", app.source],
  ];
  const html = `<h2>New application: ${esc(app.name)}</h2><table cellpadding="6" style="border-collapse:collapse">` +
    rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v) || "-"}</td></tr>`).join("") + "</table>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "ProfitX Apply <onboarding@resend.dev>",
        to: [process.env.NOTIFY_EMAIL || "dan@danwilmott.com"],
        reply_to: app.email,
        subject: `New application: ${app.name} (${app.revenueLabel || "no revenue given"})`,
        html,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.error("notify: resend", r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) {
    console.error("notify error", e.message);
    return false;
  }
}

module.exports = { emailApplication };
