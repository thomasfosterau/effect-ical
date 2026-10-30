/**
 * iCalendar (RFC 5545) encoding and decoding for Effect: the plain object
 * model with its parser and encoder, the fluent builders, the pipeable
 * `Calendar`, `Event` and `Todo` modules, and `ContentLine`, the line syntax
 * iCalendar shares with vCard (the last four exported as namespaces).
 *
 * @module
 */

export * as Calendar from "./Calendar.js";
export * as ContentLine from "./ContentLine.js";
export * as Event from "./Event.js";
export * as Todo from "./Todo.js";

// The plain object model, its parser and encoder, and the fluent builders.
export * from "./parser.js";
export * from "./encoder.js";
export * from "./types.js";
export * from "./builder.js";
