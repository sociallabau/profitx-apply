// Validates and normalises what the page sends, shared by /api/apply and /api/book.
const b = require("./config");

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

function parseApplication(body) {
  const src = typeof body === "string" ? safeParse(body) : body || {};
  const a = src.answers || {};
  const app = {
    name: clean(src.name, 80),
    email: clean(src.email, 120).toLowerCase(),
    phone: clean(src.phone, 30),
    business: clean(src.business, 200),
    revenue: clean(a.revenue, 30),
    blocker: clean(a.blocker, 30),
    urgency: clean(a.urgency, 30),
    source: clean(src.source, 300),
    honeypot: clean(src.company, 50),
    start: clean(src.start, 40),
  };
  app.valid = !!app.name && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(app.email) && app.phone.replace(/\D/g, "").length >= 8 && !!app.business;
  app.qualified = b.qualified.includes(app.revenue);
  app.revenueLabel = b.labels.revenue[app.revenue] || app.revenue;
  app.blockerLabel = b.labels.blocker[app.blocker] || app.blocker;
  app.urgencyLabel = b.labels.urgency[app.urgency] || app.urgency;
  return app;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

module.exports = { parseApplication };
