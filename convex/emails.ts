import { action } from "./_generated/server";
import { v } from "convex/values";

// Sends booking notifications via a Pipedream HTTP workflow that uses the
// Microsoft Outlook (M365) integration to deliver mail.
//
// Set EMAIL_WEBHOOK_URL in Convex env vars to the Pipedream HTTP trigger URL.
// The webhook receives: { type, name, email, details } and is expected to
// branch on `type` to send the appropriate Outlook email.

export const sendNotification = action({
  args: {
    type: v.union(v.literal("booking_request"), v.literal("booking_approved"), v.literal("booking_rejected")),
    name: v.string(),
    email: v.string(),
    details: v.string(),
  },
  handler: async (_ctx, { type, name, email, details }) => {
    const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn("[Email] EMAIL_WEBHOOK_URL not configured — skipping email");
      return { sent: false, reason: "no_webhook_url" };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, email, details }),
      });

      if (!response.ok) {
        console.error(`[Email] Webhook returned ${response.status}`);
        return { sent: false, reason: "webhook_error" };
      }

      console.log(`[Email] Sent ${type} notification to ${email}`);
      return { sent: true };
    } catch (error) {
      console.error("[Email] Failed to send:", error);
      return { sent: false, reason: "fetch_error" };
    }
  },
});
