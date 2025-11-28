import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
  },
});

export const createBooking = mutation({
  args: {
    checkIn: v.string(), // YYYY-MM-DD
    checkOut: v.string(),
    bungalowNumber: v.string(),
    unitName: v.optional(v.string()),
    userType: v.union(v.literal("owner"), v.literal("registered")),
    notes: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
    bomaDates: v.optional(v.array(v.string())),
    type: v.optional(v.union(v.literal("bungalow"), v.literal("boma"), v.literal("cottage"))),
  },
  handler: async (ctx, { checkIn, checkOut, bungalowNumber, unitName, userType, notes, userEmail, userName, bomaDates, type }) => {
    const bookingType = type ?? "bungalow";

    if (bookingType === "boma") {
      // Boma-specific validation
      // For Boma, 'unitName' carries the boma name (e.g. "Argyle"), 'bungalowNumber' is the user's residence
      const bomaName = unitName || "Argyle";
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      const bomaFieldMap: Record<string, string> = {
        "Argyle": "bomaBlocked",
        "Platform": "platformBlocked",
        "Beacon": "beaconBlocked"
      };
      const blockedField = bomaFieldMap[bomaName] || "bomaBlocked";

      for (let d = new Date(checkInDate); d < checkOutDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const availability = await ctx.db
          .query("availability")
          .withIndex("by_date", (q) => q.eq("date", dateStr))
          .unique();

        if (availability && (availability as any)[blockedField]) {
          throw new Error(`${bomaName} Boma is not available on ${dateStr}`);
        }
      }

      const createdAt = Date.now();
      return await ctx.db.insert("bookings", {
        userId: `boma-${createdAt}`,
        userEmail,
        userName,
        bungalowNumber, // User's bungalow
        unitName: bomaName, // Booked Boma
        userType: "registered",
        checkIn,
        checkOut,
        status: "pending",
        notes,
        type: "boma",
        createdAt,
      });
    }

    if (bookingType === "cottage") {
      // Cottage-specific validation
      const newStart = new Date(checkIn);
      const newEnd = new Date(checkOut);
      // For Cottage, 'unitName' carries the cottage name
      const cottageName = unitName || "Hornbill Cottage"; 

      // Check availability table for manual blocks
      const cottageFieldMap: Record<string, string> = {
        "Hornbill Cottage": "hornbillBlocked",
        "Francolin Cottage": "francolinBlocked",
        "Guineafowl Cottage": "guineafowlBlocked"
      };
      const blockedField = cottageFieldMap[cottageName];

      if (blockedField) {
        for (let d = new Date(newStart); d < newEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const availability = await ctx.db
            .query("availability")
            .withIndex("by_date", (q) => q.eq("date", dateStr))
            .unique();
          
          if (availability && (availability as any)[blockedField]) {
            throw new Error(`${cottageName} is manually blocked by admin on ${dateStr}`);
          }
        }
      }

      const existingCottageBookings = await ctx.db
        .query("bookings")
        .withIndex("by_bungalow", (q) => q.eq("bungalowNumber", bungalowNumber)) // This might be checking user bungalow, not unit. 
        // Actually, we need to check overlaps on the UNIT.
        // The schema index "by_bungalow" indexes the `bungalowNumber` field. 
        // Since we are changing `bungalowNumber` to mean "User's Bungalow", this index is no longer sufficient for checking unit availability efficiently 
        // UNLESS we add an index on `unitName`.
        // For now, let's fetch all cottages and filter in memory (assuming low volume) or rely on availability table blocks.
        // Better: Rely on availability table flags which we set on approval. 
        // BUT for immediate "double booking" check on creation, we should check if another booking exists for this unitName.
        .collect();
        
      // Let's fetch all bookings for this time range/type instead to be safe? 
      // Or just trust the manual block logic below? 
      // Let's iterate all active cottage bookings to check unit overlap.
      const allCottageBookings = await ctx.db.query("bookings").filter(q => q.eq(q.field("type"), "cottage")).collect();

      const overlaps = allCottageBookings.find((booking) => {
        if (booking.unitName !== cottageName) return false; // Check specific unit
        if (["rejected"].includes(booking.status)) return false;
        const existingStart = new Date(booking.checkIn);
        const existingEnd = new Date(booking.checkOut);
        // Overlap if date ranges intersect
        return existingStart < newEnd && newStart < existingEnd;
      });

      if (overlaps) {
        throw new Error("This cottage is already booked for some of the selected dates. Please choose different dates.");
      }

      const createdAt = Date.now();
      return await ctx.db.insert("bookings", {
        userId: `cottage-${bungalowNumber}`,
        userEmail,
        userName,
        bungalowNumber, // User's bungalow
        unitName: cottageName, // Booked Cottage
        userType,
        checkIn,
        checkOut,
        status: "pending",
        notes,
        type: "cottage",
        createdAt,
      });
    }

    // Bungalow-specific validation
    // Validate: Check if user already has a booking within 1 year cooldown
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);

    const existingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_bungalow", (q) => q.eq("bungalowNumber", bungalowNumber))
      .collect();

    // Check if user has a completed stay within the past year
    const recentCompletedStay = existingBookings.find((booking) => {
      // Only check confirmed bookings with a completed stay date
      if (booking.status === "confirmed" && booking.stayCompletedAt) {
        return booking.stayCompletedAt > oneYearAgo;
      }
      return false;
    });

    if (recentCompletedStay) {
      const daysRemaining = Math.ceil((365 * 24 * 60 * 60 * 1000 - (Date.now() - recentCompletedStay.stayCompletedAt!)) / (24 * 60 * 60 * 1000));
      throw new Error(`You can only book once per year. Your last stay was completed ${Math.floor((Date.now() - recentCompletedStay.stayCompletedAt!) / (24 * 60 * 60 * 1000))} days ago. Please wait ${daysRemaining} more days.`);
    }

    // Check if user has an active/pending booking
    const activeBooking = existingBookings.find((booking) =>
      ["pending", "approved", "payment_requested", "payment_received", "confirmed"].includes(booking.status)
    );

    if (activeBooking) {
      throw new Error("You already have an active booking request. Please wait for it to be processed or contact an admin.");
    }

    const createdAt = Date.now();
    const doc = await ctx.db.insert("bookings", {
      userId: `${bungalowNumber}-${userType}`,
      userEmail,
      userName,
      bungalowNumber,
      userType,
      checkIn,
      checkOut,
      status: "pending",
      notes,
      bomaDates,
      type: "bungalow",
      createdAt,
    });
    return doc;
  },
});

export const updateBooking = mutation({
  args: {
    id: v.id("bookings"),
    checkIn: v.optional(v.string()),
    checkOut: v.optional(v.string()),
    guests: v.optional(v.number()),
    notes: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  handler: async (ctx, { id, adminKey, ...updates }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const storedKey = settings?.value?.adminKey;
    if (storedKey && storedKey !== adminKey) throw new Error("Forbidden");

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Not found");
    await ctx.db.patch(id, updates);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("bookings"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("payment_requested"),
      v.literal("payment_received"),
      v.literal("confirmed")
    ),
    adminKey: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, adminKey }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const storedKey = settings?.value?.adminKey;
    if (storedKey && storedKey !== adminKey) throw new Error("Forbidden");

    const updates: Record<string, unknown> = { status };

    // Track timestamps for workflow stages
    if (status === "payment_requested") {
      updates.paymentRequestedAt = Date.now();
    } else if (status === "payment_received") {
      updates.paymentReceivedAt = Date.now();
    } else if (status === "confirmed") {
      updates.confirmedAt = Date.now();
    }

    await ctx.db.patch(id, updates);

    // When a booking is approved or confirmed, block the dates in availability
    if (status === "approved" || status === "confirmed") {
      const booking = await ctx.db.get(id);
      if (!booking) return;
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      // Iterate nights: [checkIn, checkOut)
      for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${day}`;
        const existing = await ctx.db
          .query("availability")
          .withIndex("by_date", (q) => q.eq("date", dateStr))
          .unique();

        if (booking.type === "boma") {
          // For Boma bookings, block the specific boma type
          // Use unitName if available (new schema), fallback to bungalowNumber (old schema)
          const bomaName = booking.unitName || booking.bungalowNumber || "Argyle";
          const bomaFieldMap: Record<string, string> = {
            "Argyle": "bomaBlocked",
            "Platform": "platformBlocked",
            "Beacon": "beaconBlocked"
          };
          const blockedField = bomaFieldMap[bomaName] || "bomaBlocked";

          if (existing) {
            await ctx.db.patch(existing._id, { [blockedField]: true } as any);
          } else {
            const maxCapacity = settings?.value?.maxCapacity ?? 16;
            await ctx.db.insert("availability", {
              date: dateStr,
              available: maxCapacity,
              blocked: false,
              [blockedField]: true
            } as any);
          }
        } else if (booking.type === "cottage") {
          // For Cottages: block specific cottage type
          const cottageName = booking.unitName || booking.bungalowNumber; 
          const cottageFieldMap: Record<string, string> = {
             "Hornbill Cottage": "hornbillBlocked",
             "Francolin Cottage": "francolinBlocked",
             "Guineafowl Cottage": "guineafowlBlocked"
          };
          // Fallback shouldn't happen if data is correct, but safety check
          const blockedField = cottageName ? cottageFieldMap[cottageName] : undefined;
          
          if (blockedField) {
            if (existing) {
              // We must preserve existing flags for OTHER cottages/bomas/sibon.
              // `patch` performs a partial update, so only the specified fields are changed.
              // This is correct: it sets THIS cottage's flag to true, leaving others alone.
              await ctx.db.patch(existing._id, { [blockedField]: true } as any);
            } else {
              // If the record doesn't exist, create it.
              // IMPORTANT: We must initialize ALL blocked flags to false (except the one being blocked)
              // to avoid undefined behavior or treating missing fields as blocked/unblocked incorrectly.
              // The schema defines them as optional, so if missing, frontend might default them to false.
              // Let's explicitly set the one we want to true.
              const maxCapacity = settings?.value?.maxCapacity ?? 16;
              await ctx.db.insert("availability", {
                date: dateStr,
                available: maxCapacity,
                blocked: false,
                [blockedField]: true
              } as any);
            }
          }
        } else if (!booking.type || booking.type === "bungalow") {
          // For main Sibon bungalow bookings, block accommodation globally
          if (existing) {
            await ctx.db.patch(existing._id, { available: 0, blocked: true });
          } else {
            await ctx.db.insert("availability", { date: dateStr, available: 0, blocked: true });
          }
        } else {
          // For cottages (and any other future types), do not change global availability;
          // overlapping prevention is handled per-unit when creating the booking.
        }
      }

      // Also block Boma dates if present (for bungalow bookings with add-on boma)
      if (booking.bomaDates && booking.bomaDates.length > 0) {
        for (const dateStr of booking.bomaDates) {
          const existing = await ctx.db
            .query("availability")
            .withIndex("by_date", (q) => q.eq("date", dateStr))
            .unique();
          if (existing) {
            await ctx.db.patch(existing._id, { bomaBlocked: true });
          } else {
            // If availability record doesn't exist, create it with default available but blocked Boma
            const settings = await ctx.db
              .query("settings")
              .withIndex("by_key", (q) => q.eq("key", "global"))
              .unique();
            const maxCapacity = settings?.value?.maxCapacity ?? 16;
            await ctx.db.insert("availability", {
              date: dateStr,
              available: maxCapacity,
              blocked: false,
              bomaBlocked: true
            });
          }
        }
      }
    }
  },
});

// New mutation: Mark stay as completed (triggers cooldown period)
export const completeStay = mutation({
  args: {
    id: v.id("bookings"),
    adminKey: v.optional(v.string()),
  },
  handler: async (ctx, { id, adminKey }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const storedKey = settings?.value?.adminKey;
    if (storedKey && storedKey !== adminKey) throw new Error("Forbidden");

    const booking = await ctx.db.get(id);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "confirmed") throw new Error("Can only complete confirmed bookings");

    await ctx.db.patch(id, {
      stayCompletedAt: Date.now()
    });
  },
});

export const remove = mutation({
  args: { id: v.id("bookings"), adminKey: v.optional(v.string()) },
  handler: async (ctx, { id, adminKey }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const storedKey = settings?.value?.adminKey;
    if (storedKey && storedKey !== adminKey) throw new Error("Forbidden");

    const booking = await ctx.db.get(id);
    if (!booking) {
      // Booking not found, maybe already deleted
      return; 
    }

    // If booking was approved or confirmed, we need to unblock the availability
    if (["approved", "confirmed"].includes(booking.status)) {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);

      for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${day}`;
        const existing = await ctx.db
          .query("availability")
          .withIndex("by_date", (q) => q.eq("date", dateStr))
          .unique();

        if (existing) {
          if (booking.type === "boma") {
            const bomaName = booking.unitName || booking.bungalowNumber || "Argyle";
            const bomaFieldMap: Record<string, string> = {
              "Argyle": "bomaBlocked",
              "Platform": "platformBlocked",
              "Beacon": "beaconBlocked"
            };
            const blockedField = bomaFieldMap[bomaName];
            if (blockedField) {
              await ctx.db.patch(existing._id, { [blockedField]: false } as any);
            }
          } else if (booking.type === "cottage") {
            const cottageName = booking.unitName || booking.bungalowNumber || "Hornbill Cottage";
            const cottageFieldMap: Record<string, string> = {
              "Hornbill Cottage": "hornbillBlocked",
              "Francolin Cottage": "francolinBlocked",
              "Guineafowl Cottage": "guineafowlBlocked"
            };
            const blockedField = cottageFieldMap[cottageName];
            if (blockedField) {
              await ctx.db.patch(existing._id, { [blockedField]: false } as any);
            }
          } else if (!booking.type || booking.type === "bungalow") {
            // For main Sibon bungalow bookings, unblock accommodation
            const maxCapacity = settings?.value?.maxCapacity ?? 16;
            await ctx.db.patch(existing._id, { available: maxCapacity, blocked: false });
          }
        }
      }

      // Also unblock add-on Boma dates
      if (booking.bomaDates && booking.bomaDates.length > 0) {
        for (const dateStr of booking.bomaDates) {
          const existing = await ctx.db
            .query("availability")
            .withIndex("by_date", (q) => q.eq("date", dateStr))
            .unique();
          if (existing) {
            await ctx.db.patch(existing._id, { bomaBlocked: false });
          }
        }
      }
    }

    await ctx.db.delete(id);
  },
});
