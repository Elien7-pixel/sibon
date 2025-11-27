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
    userType: v.union(v.literal("owner"), v.literal("registered")),
    notes: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
    bomaDates: v.optional(v.array(v.string())),
    type: v.optional(v.union(v.literal("bungalow"), v.literal("boma"))),
  },
  handler: async (ctx, { checkIn, checkOut, bungalowNumber, userType, notes, userEmail, userName, bomaDates, type }) => {
    const bookingType = type ?? "bungalow";

    if (bookingType === "boma") {
      // Boma-specific validation - bungalowNumber contains the boma name
      const bomaName = bungalowNumber || "Argyle";
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
        bungalowNumber: bomaName,
        userType: "registered",
        checkIn,
        checkOut,
        status: "pending",
        notes,
        type: "boma",
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
          const bomaName = booking.bungalowNumber || "Argyle";
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
        } else {
          // For Bungalow bookings
          if (existing) {
            await ctx.db.patch(existing._id, { available: 0, blocked: true });
          } else {
            await ctx.db.insert("availability", { date: dateStr, available: 0, blocked: true });
          }
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
    await ctx.db.delete(id);
  },
});
