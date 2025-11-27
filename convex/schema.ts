import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  bookings: defineTable({
    userId: v.string(),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
    bungalowNumber: v.optional(v.string()), // User's bungalow number
    type: v.optional(v.union(v.literal("bungalow"), v.literal("boma"))), // Booking type
    userType: v.optional(v.union(v.literal("owner"), v.literal("registered"))), // Owner or Registered User
    checkIn: v.string(), // YYYY-MM-DD (Arrival Date)
    checkOut: v.string(), // YYYY-MM-DD (Departure Date)
    guests: v.optional(v.number()), // Made optional since capacity is fixed
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("payment_requested"), // Admin sent EFT request
      v.literal("payment_received"), // Payment received, ready for confirmation
      v.literal("confirmed") // Fully confirmed, dates blocked
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    stayCompletedAt: v.optional(v.number()), // Unix timestamp when stay was completed
    paymentRequestedAt: v.optional(v.number()),
    paymentReceivedAt: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    bomaDates: v.optional(v.array(v.string())),
  })
    .index("by_user", ["userId"]) // list my bookings
    .index("by_bungalow", ["bungalowNumber"]) // lookup by bungalow number
    .index("by_status", ["status", "createdAt"]) // admin views
    .index("by_createdAt", ["createdAt"]),

  availability: defineTable({
    date: v.string(), // YYYY-MM-DD
    available: v.number(),
    blocked: v.boolean(),
    bomaBlocked: v.optional(v.boolean()), // Argyle Boma blocked?
    platformBlocked: v.optional(v.boolean()), // The Platform blocked?
    beaconBlocked: v.optional(v.boolean()), // Beacon Boma blocked?
    seasonType: v.optional(v.union(v.literal("peak"), v.literal("offpeak"))), // Season pricing
  }).index("by_date", ["date"]),

  settings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  admins: defineTable({
    userId: v.string(),
  }).index("by_userId", ["userId"]),
});
