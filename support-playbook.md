# Support Playbook — ReceptionAI

This is a working guide. Update as we learn what actually works.

---

## 1. Cancellation Request

**Suggested response:**
> I'm sorry to hear that. Before we process your cancellation, would you be open to a quick call with our team? Often there's a simple fix — wrong business hours, a number routing issue, or a feature that's already on the roadmap. If not, I'll process it immediately — no questions asked, no hoops.

**If they insist:** Confirm cancellation date, stop billing, remove phone number. I'll flag for Carlos to handle the Stripe side.

---

## 2. Billing Question / Price Concern

**Suggested response:**
> Totally fair question. Your current plan is [plan] at $[price]/mo. If usage is light, the Starter plan at $99/mo might be a better fit. If you're hitting limits, let's talk about what's driving it — sometimes a quick settings change reduces minutes without losing functionality. What's working well and what feels like overkill?

---

## 3. "It's not working" (vague)

**Diagnostic steps I can take:**
- Check dashboard health page
- Check if phone number is active in Telnyx
- Check if webhooks are configured
- Review recent call logs for errors
- Check server logs

**Suggested response:**
> Let me take a look. Can you tell me what specifically isn't working — are calls not coming through, is the AI greeting wrong, or something else? I'm checking your account now.

---

## 4. Feature Request

**Suggested response:**
> Great idea — [feature] isn't available yet but it's on our radar. Can I ask how you'd use it? That helps us prioritize. In the meantime, here's a workaround: [workaround if possible].

---

## 5. Setup / Onboarding Help

**Suggested response:**
> Happy to help. The fastest path: log in at receptionai.store/login, go to Settings, and set your business hours. Your AI receptionist will answer based on those hours. What industry are you in? I can suggest the best setup.

---

## 6. Complaint About Call Quality / AI Responses

**Suggested response:**
> Sorry about that — that's not the experience we want. Can you share what the AI said or did wrong? I can tune the responses. Also, if you call (727) 966-7556 yourself, you can hear exactly what your customers hear. Let me know what needs adjusting.

---

## 7. Refund Request

**Suggested response:**
> I understand. Let me look at your account. If this is within the 14-day trial or there's been a genuine issue on our end, I'll process the refund. Can you give me a moment to review?

Then flag for Carlos to handle the Stripe refund.

---

## Escalation Triggers

| Trigger | Action |
|---|---|
| Cancellation confirmed | Email Carlos immediately |
| Refund needed | Email Carlos with customer details + amount |
| Legal threat / demand | Email Carlos, do NOT respond substantively |
| Data deletion request | Handle directly (I can delete from DB) |
| Someone wants to talk to "a real person" | Offer to schedule a call with Carlos |
| Outage affecting multiple customers | Email Carlos + start investigating |
