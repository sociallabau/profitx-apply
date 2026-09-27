// Booking rules. These mirror `funnel.booking` in profitx-funnel/src/config/funnel.ts so both
// funnels offer the same Gameplan Call times from the same Google Calendar. If you change
// them there, change them here too.
module.exports = {
  timezone: "Australia/Brisbane",
  utcOffset: "+10:00", // Gold Coast has no daylight saving, so a fixed offset is safe
  days: [1, 2, 3, 4, 5], // Mon-Fri
  startHour: 9,
  endHour: 17,
  slotMinutes: 20,
  bufferMinutes: 10, // 20-min call + 10-min gap = times on the hour and half-hour
  daysAhead: 3,
  spotsPerDay: { min: 2, max: 4 },
  extraTimes: ["07:15", "19:30"],
  minNoticeHours: 2,
  callTitle: "Gameplan Call",
  // Never offered, even if the calendar is clear. days: 0 Sun ... 6 Sat. `from` + `everyWeeks` = fortnightly etc.
  blocked: [
    { days: [2], start: "07:30", end: "08:30" },
    { days: [3], start: "07:00", end: "09:00", from: "2026-09-30", everyWeeks: 2 },
  ],

  // Revenue answers that get a call ($10K+ a month, same cut-off as the workshop funnel).
  qualified: ["10k-20k", "20k-50k", "50k-plus"],

  labels: {
    revenue: { "under-3k": "Just starting / under $3K", "3k-10k": "$3K-$10K", "10k-20k": "$10K-$20K", "20k-50k": "$20K-$50K", "50k-plus": "$50K+" },
    blocker: { offer: "Offer / competing on price", clients: "Getting clients consistently", delivery: "Delivery bottleneck", retainers: "Retainers don't stick or scale" },
    urgency: { now: "Now, ready to invest", soon: "In the next 1-3 months", exploring: "Just exploring" },
  },
};
