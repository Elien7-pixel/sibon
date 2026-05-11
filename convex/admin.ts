import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const isConfigured = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    return Boolean(settings?.value?.adminKey);
  },
});

export const setAdminKey = mutation({
  args: { adminKey: v.string() },
  handler: async (ctx, { adminKey }) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (existing?.value?.adminKey) throw new Error("Admin key already set");
    if (existing) {
      await ctx.db.patch(existing._id, { value: { ...(existing.value ?? {}), adminKey } });
    } else {
      await ctx.db.insert("settings", { key: "global", value: { adminKey, maxCapacity: 16 } });
    }
  },
});

export const verifyAdminKey = query({
  args: { adminKey: v.string() },
  handler: async (ctx, { adminKey }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const stored = settings?.value?.adminKey;
    if (!stored) return false;
    return stored === adminKey;
  },
});

export const updateAdminKey = mutation({
  args: { currentKey: v.string(), newKey: v.string() },
  handler: async (ctx, { currentKey, newKey }) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const stored = settings?.value?.adminKey;
    if (!stored || stored !== currentKey) throw new Error("Forbidden");
    await ctx.db.patch(settings!._id, {
      value: { ...(settings!.value ?? {}), adminKey: newKey },
    });
  },
});
