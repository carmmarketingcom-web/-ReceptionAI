/**
 * Telnyx helper functions for phone number management.
 *
 * Uses TELNYX_API_KEY and TELNYX_CONNECTION_ID from environment.
 */

const TELNYX = "https://api.telnyx.com/v2";

function headers() {
  return {
    Authorization: `Bearer ${process.env.TELNYX_API_KEY || ""}`,
    "Content-Type": "application/json",
  };
}

export interface PurchasedNumber {
  phoneNumber: string;
  telnyxNumberId: string;
}

/**
 * Search available phone numbers and purchase one.
 * If areaCode is provided, filter by that area code.
 * Returns the purchased number's phone number and Telnyx ID.
 */
export async function buyPhoneNumber(
  areaCode?: string
): Promise<PurchasedNumber | null> {
  const connectionId = process.env.TELNYX_CONNECTION_ID;
  if (!connectionId) {
    console.error("[Telnyx] TELNYX_CONNECTION_ID not set");
    return null;
  }

  try {
    // Step 1: Search for available numbers
    const searchParams = new URLSearchParams();
    searchParams.set("filter[voice][connection_id]", connectionId);
    searchParams.set("filter[voice][features][sms_enabled]", "true");
    searchParams.set("filter[limit]", "3");
    if (areaCode) {
      searchParams.set("filter[national_destination_code]", areaCode);
    }

    const searchRes = await fetch(
      `${TELNYX}/available_phone_numbers?${searchParams.toString()}`,
      { headers: headers() }
    );
    const searchData = (await searchRes.json()) as any;

    if (searchData.errors || !searchData.data?.length) {
      console.error(
        "[Telnyx] No numbers available:",
        JSON.stringify(searchData.errors || searchData).slice(0, 200)
      );
      return null;
    }

    const selected = searchData.data[0];
    const phoneNumber = selected.phone_number as string;

    // Step 2: Order the number
    const orderRes = await fetch(`${TELNYX}/number_orders`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        connection_id: connectionId,
        phone_numbers: [{ phone_number: phoneNumber }],
      }),
    });
    const orderData = (await orderRes.json()) as any;

    if (orderData.errors) {
      console.error(
        "[Telnyx] Order failed:",
        JSON.stringify(orderData.errors).slice(0, 200)
      );
      return null;
    }

    // Extract the phone number ID from the order
    const phoneNumberData = orderData.data?.phone_numbers?.[0];
    const telnyxNumberId = phoneNumberData?.id || selected.id || "";

    console.log(
      `[Telnyx] Purchased ${phoneNumber} (ID: ${telnyxNumberId})`
    );

    return { phoneNumber, telnyxNumberId };
  } catch (err) {
    console.error("[Telnyx] buyPhoneNumber error:", String(err).slice(0, 200));
    return null;
  }
}

/**
 * Look up an existing phone number in the Telnyx account.
 */
export async function lookupNumber(
  phoneNumber: string
): Promise<{ id: string; phone_number: string } | null> {
  try {
    const res = await fetch(
      `${TELNYX}/phone_numbers/${encodeURIComponent(phoneNumber)}`,
      { headers: headers() }
    );
    const data = (await res.json()) as any;
    if (data.errors || !data.data) return null;
    return { id: data.data.id, phone_number: data.data.phone_number };
  } catch {
    return null;
  }
}

/**
 * Update the voice webhook URL for a phone number.
 */
export async function setVoiceWebhook(
  telnyxNumberId: string,
  webhookUrl: string
): Promise<boolean> {
  try {
    const res = await fetch(`${TELNYX}/phone_numbers/${telnyxNumberId}/voice`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        connection_id: process.env.TELNYX_CONNECTION_ID || "",
        webhook_url: webhookUrl,
      }),
    });
    const data = (await res.json()) as any;
    return !data.errors;
  } catch {
    return false;
  }
}

/**
 * Get the base URL for webhooks from the current request or environment.
 */
export function getWebhookBase(request?: Request): string {
  if (request) {
    const host = request.headers.get("host") || "";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }
  return process.env.PUBLIC_URL || "http://localhost:3000";
}
