/**
 * Ingwelala Booking — Email Notification Handler
 * 
 * SETUP:
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Paste this code
 * 4. Click Deploy → New Deployment → Web App
 * 5. Set "Execute as" = Me, "Who has access" = Anyone
 * 6. Copy the Web App URL
 * 7. Set it as GOOGLE_SCRIPT_URL in your Convex environment variables
 * 
 * SENDER EMAIL: 
 * Change SENDER_NAME below to your preferred sender name.
 * Emails will be sent from the Google account that owns this script.
 */

const SENDER_NAME = "Ingwelala Bookings";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { type, name, email, details } = data;

    if (!email || !name) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Missing name or email" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    let subject, body;

    if (type === "booking_request") {
      subject = "Ingwelala — Booking Request Received";
      body = `Hey ${name},\n\n` +
        `We have received your booking request and the administrator will provide feedback shortly.\n\n` +
        `Booking Details:\n${details}\n\n` +
        `Thank you for choosing Ingwelala!\n\n` +
        `Kind regards,\nIngwelala Bookings Team`;
    } else if (type === "booking_approved") {
      subject = "Ingwelala — Booking Approved! ✅";
      body = `Hey ${name},\n\n` +
        `Great news! Your booking has been approved and will be added to your bill.\n\n` +
        `Booking Details:\n${details}\n\n` +
        `We look forward to welcoming you!\n\n` +
        `Kind regards,\nIngwelala Bookings Team`;
    } else {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Unknown type: " + type })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      name: SENDER_NAME,
    });

    return ContentService.createTextOutput(
      JSON.stringify({ success: true })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function — run this in the script editor to verify it works
function testDoPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        type: "booking_request",
        name: "Test User",
        email: "test@example.com",
        details: "Boma: Argyle, Date: 2026-03-01"
      })
    }
  };
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
