/**
 * The business types a customer can choose.
 *
 * One list, imported by both the setup wizard and the Settings screen: the wizard asks the
 * question at signup, Settings lets the customer change the answer later, and a value saved
 * by one must be selectable in the other. Stored verbatim in `organizations.industry`.
 */
export const BUSINESS_TYPES = [
  "HVAC", "Plumbing", "Electrical", "Roofing", "Dental", "Veterinary",
  "Law Firm", "Med Spa", "Home Services", "Auto Repair",
  "Marketing", "Consulting", "Accounting", "Real Estate", "Insurance",
  "IT Services", "Cleaning Services", "Landscaping", "Salon & Spa", "Other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
