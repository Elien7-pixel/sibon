import { action } from "./_generated/server";
import { v } from "convex/values";

// Set this in Convex environment variables: GOOGLE_SCRIPT_URL
// Deploy your Google Apps Script as a web app and paste the URL here

export const sendNotification = action({
  args: {
    type: v.union(v.literal("booking_request"), v.literal("booking_approved"), v.literal("booking_rejected")),
    name: v.string(),
    email: v.string(),
    details: v.string(),
  },
  handler: async (_ctx, { type, name, email, details }) => {
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      console.warn("[Email] GOOGLE_SCRIPT_URL not configured — skipping email");
      return { sent: false, reason: "no_script_url" };
    }

    try {
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, email, details }),
      });

      if (!response.ok) {
        console.error(`[Email] Google Script returned ${response.status}`);
        return { sent: false, reason: "script_error" };
      }

      console.log(`[Email] Sent ${type} notification to ${email}`);
      return { sent: true };
    } catch (error) {
      console.error("[Email] Failed to send:", error);
      return { sent: false, reason: "fetch_error" };
    }
  },
});
