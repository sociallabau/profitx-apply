// Kit (ConvertKit) v4. Tags drive your Kit automations. Skips quietly if KIT_API_KEY isn't set.
const BASE = "https://api.kit.com/v4";

async function kit(path, body) {
  const key = process.env.KIT_API_KEY;
  if (!key) return null;
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Kit-Api-Key": key }, body: JSON.stringify(body) });
  if (!res.ok) console.error("Kit", path, res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

// Same custom field names the workshop funnel uses: phone, monthly_revenue, biggest_blocker, urgency.
async function upsertSubscriber({ email, name, fields }) {
  return kit("/subscribers", { email_address: email, first_name: name.split(" ")[0], fields });
}

async function tag(email, tagId) {
  if (!tagId) return null;
  return kit(`/tags/${tagId}/subscribers`, { email_address: email });
}

module.exports = { upsertSubscriber, tag };
