/**
 * Public facts about the product that screens render — kept in one place so no page has to
 * hardcode a phone number.
 *
 * PUBLIC_LINE is the only line that answers calls today. We do not provision a number per
 * customer (that is the deliberate product decision the FAQ explains), so this is the number
 * a customer can actually call to test the receptionist.
 */
export const PUBLIC_LINE = {
  /** How the number is written for a human. */
  display: "(727) 966-7556",
  /** A tel: href, for a phone that is going to dial it. */
  tel: "tel:+17279667556",
} as const;
