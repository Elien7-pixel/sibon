import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    return doc?.value ?? { maxCapacity: 16 };
  },
});

export const setMaxCapacity = mutation({
  args: { maxCapacity: v.number(), adminKey: v.optional(v.string()) },
  handler: async (ctx, { maxCapacity, adminKey }) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const storedKey = existing?.value?.adminKey;
    if (storedKey && storedKey !== adminKey) throw new Error("Forbidden");
    if (existing) {
      await ctx.db.patch(existing._id, { value: { ...(existing.value ?? {}), maxCapacity } });
    } else {
      await ctx.db.insert("settings", { key: "global", value: { maxCapacity } });
    }
  },
});

export const getMonthAvailability = query({
  args: { year: v.number(), month: v.number() }, // month: 1-12
  handler: async (ctx, { year, month }) => {
    // Pull all dates for the month
    const results = await ctx.db.query("availability").collect();
    const prefix = `${year}-${String(month).padStart(2, "0")}-`;
    const byDate: Record<string, { available: number; blocked: boolean; bomaBlocked?: boolean; platformBlocked?: boolean; beaconBlocked?: boolean; hornbillBlocked?: boolean; francolinBlocked?: boolean; guineafowlBlocked?: boolean; seasonType?: "peak" | "offpeak" }> = {};
    for (const r of results) {
      if (r.date.startsWith(prefix)) {
        byDate[r.date] = { 
          available: r.available, 
          blocked: r.blocked,
          bomaBlocked: r.bomaBlocked,
          platformBlocked: r.platformBlocked,
          beaconBlocked: r.beaconBlocked,
          hornbillBlocked: r.hornbillBlocked,
          francolinBlocked: r.francolinBlocked,
          guineafowlBlocked: r.guineafowlBlocked,
          seasonType: r.seasonType 
        };
      }
    }
    return byDate;
  },
});

export const setDateAvailability = mutation({
  args: { 
    date: v.string(), 
    available: v.optional(v.number()), 
    blocked: v.optional(v.boolean()),
    bomaBlocked: v.optional(v.boolean()),
    platformBlocked: v.optional(v.boolean()),
    beaconBlocked: v.optional(v.boolean()),
    hornbillBlocked: v.optional(v.boolean()),
    francolinBlocked: v.optional(v.boolean()),
    guineafowlBlocked: v.optional(v.boolean()),
    seasonType: v.optional(v.union(v.literal("peak"), v.literal("offpeak"))),
    adminKey: v.optional(v.string()) 
  },
  handler: async (ctx, { date, available, blocked, bomaBlocked, platformBlocked, beaconBlocked, hornbillBlocked, francolinBlocked, guineafowlBlocked, seasonType, adminKey }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const storedKey = settings?.value?.adminKey;
    // Debugging logs
    if (storedKey && storedKey !== adminKey) {
      // console.log(`Forbidden access: storedKey=${storedKey}, receivedKey=${adminKey}`);
      throw new Error(`Forbidden: Invalid Admin Key. Stored: ${storedKey ? "***" : "None"}, Received: ${adminKey ? "***" : "None"}`);
    }

    const existing = await ctx.db
      .query("availability")
      .withIndex("by_date", (q) => q.eq("date", date))
      .unique();

    if (existing) {
      const updates: any = {};
      if (available !== undefined) updates.available = available;
      if (blocked !== undefined) updates.blocked = blocked;
      // If available is 0, force blocked to true unless explicitly set
      if (available === 0 && blocked === undefined) updates.blocked = true;
      
      if (bomaBlocked !== undefined) updates.bomaBlocked = bomaBlocked;
      if (platformBlocked !== undefined) updates.platformBlocked = platformBlocked;
      if (beaconBlocked !== undefined) updates.beaconBlocked = beaconBlocked;
      if (hornbillBlocked !== undefined) updates.hornbillBlocked = hornbillBlocked;
      if (francolinBlocked !== undefined) updates.francolinBlocked = francolinBlocked;
      if (guineafowlBlocked !== undefined) updates.guineafowlBlocked = guineafowlBlocked;
      if (seasonType !== undefined) updates.seasonType = seasonType;

      await ctx.db.patch(existing._id, updates);
    } else {
      // For new records, require basic fields or defaults
      const maxCapacity = settings?.value?.maxCapacity ?? 16;
      await ctx.db.insert("availability", { 
        date, 
        available: available ?? maxCapacity, 
        blocked: blocked ?? (available === 0), 
        bomaBlocked: bomaBlocked ?? false,
        platformBlocked: platformBlocked ?? false,
        beaconBlocked: beaconBlocked ?? false,
        hornbillBlocked: hornbillBlocked ?? false,
        francolinBlocked: francolinBlocked ?? false,
        guineafowlBlocked: guineafowlBlocked ?? false,
        seasonType 
      });
    }
  },
});

// Batch set season type for date range
export const setSeasonForDateRange = mutation({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(),   // YYYY-MM-DD
    seasonType: v.union(v.literal("peak"), v.literal("offpeak")),
    adminKey: v.optional(v.string()),
  },
  handler: async (ctx, { startDate, endDate, seasonType, adminKey }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const storedKey = settings?.value?.adminKey;
    if (storedKey && storedKey !== adminKey) throw new Error("Forbidden");

    // Get max capacity
    const maxCapacity = settings?.value?.maxCapacity ?? 16;

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const updates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      const existing = await ctx.db
        .query("availability")
        .withIndex("by_date", (q) => q.eq("date", dateStr))
        .unique();
      
      if (existing) {
        await ctx.db.patch(existing._id, { seasonType });
      } else {
        await ctx.db.insert("availability", { 
          date: dateStr, 
          available: maxCapacity, 
          blocked: false,
          seasonType 
        });
      }
      updates.push(dateStr);
    }
    
    return { success: true, datesUpdated: updates.length };
  },
});
