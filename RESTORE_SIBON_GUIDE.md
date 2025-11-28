# Recovery Plan: Restore Sibon Bungalow Booking

This file serves as a reminder and guide to restore the Sibon Bungalow booking functionality after the "Ingwelala Boma Booking" demo.

## Changes made for the demo:

1.  **`src/pages/Index.tsx`**:
    *   Default `bookingType` set to `"boma"`.
    *   State type restricted to `<"boma" | "cottage">`.
    *   Footer text changed to "© 2025 Ingwelala Boma Booking".

2.  **`src/components/BookingTypeToggle.tsx`**:
    *   Removed the "Sibon (Bungalows)" button.
    *   Restricted `BookingType` to `"boma" | "cottage"`.

3.  **`src/components/BookingForm.tsx`**:
    *   Removed "bungalow" from `type` prop definition.
    *   Updated conditions to hide bungalow-specific fields (like `bungalowNumber` input).
    *   Changed header text logic.

4.  **`src/pages/Admin.tsx`**:
    *   Changed page title to "Ingwelala Boma Booking".
    *   Removed "Sibon (Accommodation)" button from calendar toggle.
    *   Hid the "Accommodation Requests" table with `className="... hidden"`.
    *   Commented out or removed "accommodation" branches in calendar blocking/unblocking logic.

## Steps to Restore:

1.  **Revert `src/pages/Index.tsx`**:
    *   Allow `"bungalow"` in `bookingType` state.
    *   Set default `bookingType` back to `"bungalow"` (or keep user choice).
    *   Restore footer text to original copyright.

2.  **Revert `src/components/BookingTypeToggle.tsx`**:
    *   Add `| "bungalow"` back to the type definition.
    *   Uncomment/restore the "Sibon (Bungalows)" button.

3.  **Revert `src/components/BookingForm.tsx`**:
    *   Add `| "bungalow"` back to the `type` prop.
    *   Restore the `bungalowNumber` input field logic.
    *   Update header to include "Book Sibon".

4.  **Revert `src/pages/Admin.tsx`**:
    *   Change title back to "Admin Dashboard" (or generic).
    *   Restore "Sibon (Accommodation)" button in calendar toggle.
    *   Remove `hidden` class from "Accommodation Requests" table.
    *   Restore `calendarMode === "accommodation"` logic in `handleBlockDate`, `handleUnblockDate`, and rendering logic.

*Note: The backend logic in `convex/bookings.ts` and `convex/schema.ts` was largely untouched regarding the actual bungalow implementation, so no major backend reverts should be needed unless specific constraints were added.*
