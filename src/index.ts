/**
 * effect-ical - iCal (RFC 5545) library using Effect idioms
 * 
 * This module exports the main API using Effect-style module namespaces.
 */

export * as Calendar from "./Calendar.js";
export * as Event from "./Event.js";
export * as Todo from "./Todo.js";

// Also export the legacy API for backward compatibility
export * from "./parser.js";
export * from "./encoder.js";
export * from "./types.js";
export * from "./builder.js";
