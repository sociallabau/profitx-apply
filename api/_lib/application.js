// Validates and normalises what the page sends, shared by /api/apply and /api/book.
const b = require("./config");

const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const ANSWER_IDS = ["revenue", "work", "blocker", "leads", "goal", "urgency"];

function parseApplication(body) {
  const src = typeof body === "string" ? safeParse(body) : body || {};
  const a = src.answers || {};
  const app = {
    name: clean(src.name, 80),
    email: clean(src.email, 120).toLowerCase(),
    phone: clean(src.phone, 30),
    business: clean(src.business, 200),
    source: clean(src.source, 300),
    honeypot: clean(src.company, 50),
    start: clean(src.start, 40),
    eventId: clean(src.eventId, 64),
    eventSourceUrl: clean(src.eventSourceUrl, 300),
    fbc: clean(src.fbc, 200),
  };
  for (const id of ANSWER_IDS) {
    app[id] = clean(a[id], id === "work" ? 100 : 30);
    app[id + "Label"] = b.labels[id]?.[app[id]] || app[id];
  }
  app.valid = !!app.name && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(app.email) && app.phone.replace(/\D/g, "").length >= 8 && !!app.business;
  app.qualified = b.qualified.includes(app.revenue);
  return app;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

module.exports = { parseApplication };
