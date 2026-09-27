// Free Gameplan Call start times from the Google Calendar (ISO strings, UTC).
const { openSlots } = require("./_lib/calendar");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    return res.status(200).json({ slots: await openSlots() });
  } catch (e) {
    console.error("slots", e);
    return res.status(503).json({ slots: [], error: "The calendar isn't available right now." });
  }
};
