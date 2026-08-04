/**
 * Telnyx Balance Monitor
 * Run: bun run /home/team/shared/scripts/check-telnyx-balance.ts
 * Alerts when balance drops below $5 threshold.
 */
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
if (!TELNYX_API_KEY) {
  console.error("TELNYX_API_KEY environment variable is required");
  process.exit(1);
}
const THRESHOLD = 5; // dollars
const API = "https://api.telnyx.com/v2";
async function checkBalance() {
  const res = await fetch(`${API}/balance`, {
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
  });
  const data = await res.json() as any;
  const balance = parseFloat(data.data?.balance || "0");
  const currency = data.data?.currency || "USD";
  console.log(`Telnyx balance: $${balance.toFixed(2)} ${currency}`);
  if (balance < THRESHOLD) {
    const warning = `⚠️ LOW BALANCE: $${balance.toFixed(2)}. At ~$1.65/customer/month, you can cover ~${Math.floor(balance / 1.65)} more customers. Refill at https://portal.telnyx.com/#/billing`;
    console.log(warning);
    // Also write to a file so the lead can check it
    const fs = await import("fs");
    fs.writeFileSync("/home/team/shared/telnyx_balance_alert.txt", warning);
    return { low: true, balance, warning };
  }
  return { low: false, balance };
}
checkBalance().then(r => {
  if (r.low) process.exit(1);
  process.exit(0);
});
