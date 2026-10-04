/**
 * Calendar module - Effect-style API for iCalendar (VCALENDAR) components
 */

import { Effect } from "effect";
import * as Schema from "effect/Schema";

/**
 * Calendar Schema - represents a VCALENDAR component
 */
export class Calendar extends Schema.Class<Calendar>("Calendar")({
  component: Schema.Literal("VCALENDAR"),
  version: Schema.Literal("2.0"),
  prodid: Schema.String,
  calscale: Schema.optional(Schema.Literal("GREGORIAN")),
  method: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  // Forward references for sub-components - will be filled in after Event/Todo are defined
  events: Schema.optional(Schema.Array(Schema.Any)),
  todos: Schema.optional(Schema.Array(Schema.Any)),
  journals: Schema.optional(Schema.Array(Schema.Any)),
  freebusys: Schema.optional(Schema.Array(Schema.Any)),
  timezones: Schema.optional(Schema.Array(Schema.Any)),
}) {}

/**
 * Create a new Calendar with required properties
 */
export const make = (prodid: string): Calendar => {
  return new Calendar({
    component: "VCALENDAR",
    version: "2.0",
    prodid,
  });
};

/**
 * Builder context for constructing calendars
 */
export interface Builder {
  readonly calendar: Calendar;
}

/**
 * Create a builder for constructing calendars
 */
export const builder = (): Builder => ({
  calendar: make("-//effect-ical//EN"),
});

/**
 * Set the product ID
 */
export const withProdid = (prodid: string) => (builder: Builder): Builder => ({
  ...builder,
  calendar: { ...builder.calendar, prodid },
});

/**
 * Set the calendar name
 */
export const withName = (name: string) => (builder: Builder): Builder => ({
  ...builder,
  calendar: { ...builder.calendar, name },
});

/**
 * Set the calendar description
 */
export const withDescription = (description: string) => (builder: Builder): Builder => ({
  ...builder,
  calendar: { ...builder.calendar, description },
});

/**
 * Set the calendar scale
 */
export const withCalscale = (calscale: "GREGORIAN") => (builder: Builder): Builder => ({
  ...builder,
  calendar: { ...builder.calendar, calscale },
});

/**
 * Set the method
 */
export const withMethod = (method: string) => (builder: Builder): Builder => ({
  ...builder,
  calendar: { ...builder.calendar, method },
});

/**
 * Add an event to the calendar
 */
export const withEvent = (event: any) => (builder: Builder): Builder => ({
  ...builder,
  calendar: {
    ...builder.calendar,
    events: [...(builder.calendar.events || []), event],
  },
});

/**
 * Add a todo to the calendar
 */
export const withTodo = (todo: any) => (builder: Builder): Builder => ({
  ...builder,
  calendar: {
    ...builder.calendar,
    todos: [...(builder.calendar.todos || []), todo],
  },
});

/**
 * Build the final calendar from builder
 */
export const build = (builder: Builder): Calendar => builder.calendar;

/**
 * Encode a calendar to iCal format string
 */
export const encode = (calendar: Calendar): Effect.Effect<string, Error> => {
  return Effect.gen(function* () {
    const lines: string[] = [];

    lines.push("BEGIN:VCALENDAR");
    lines.push(`VERSION:${calendar.version}`);
    lines.push(`PRODID:${calendar.prodid}`);

    if (calendar.calscale) {
      lines.push(`CALSCALE:${calendar.calscale}`);
    }
    if (calendar.method) {
      lines.push(`METHOD:${calendar.method}`);
    }
    if (calendar.name) {
      lines.push(`NAME:${calendar.name}`);
    }
    if (calendar.description) {
      lines.push(`DESCRIPTION:${calendar.description}`);
    }

    // Encode events using Event module (circular dependency handled at runtime)
    if (calendar.events) {
      for (const event of calendar.events) {
        // Simple encoding for now - full Event.encode integration later
        lines.push("BEGIN:VEVENT");
        lines.push(`DTSTART:${(event as any).dtstart || ""}`);
        if ((event as any).uid) lines.push(`UID:${(event as any).uid}`);
        if ((event as any).summary) lines.push(`SUMMARY:${(event as any).summary}`);
        if ((event as any).dtend) lines.push(`DTEND:${(event as any).dtend}`);
        if ((event as any).description)
          lines.push(`DESCRIPTION:${(event as any).description}`);
        if ((event as any).location) lines.push(`LOCATION:${(event as any).location}`);
        if ((event as any).status) lines.push(`STATUS:${(event as any).status}`);
        lines.push("END:VEVENT");
      }
    }

    // Encode todos
    if (calendar.todos) {
      for (const todo of calendar.todos) {
        lines.push("BEGIN:VTODO");
        if ((todo as any).uid) lines.push(`UID:${(todo as any).uid}`);
        if ((todo as any).summary) lines.push(`SUMMARY:${(todo as any).summary}`);
        if ((todo as any).dtstart) lines.push(`DTSTART:${(todo as any).dtstart}`);
        if ((todo as any).due) lines.push(`DUE:${(todo as any).due}`);
        if ((todo as any).status) lines.push(`STATUS:${(todo as any).status}`);
        if ((todo as any).percent !== undefined)
          lines.push(`PERCENT-COMPLETE:${(todo as any).percent}`);
        lines.push("END:VTODO");
      }
    }

    lines.push("END:VCALENDAR");

    return lines.join("\r\n") + "\r\n";
  });
};

/**
 * Decode an iCal string to a Calendar
 */
export const decode = (icalString: string): Effect.Effect<Calendar, Error> => {
  return Effect.gen(function* () {
    // Simple parser for now - will be enhanced with full Schema decoding
    const lines = icalString.split(/\r?\n/).filter((l) => l.trim());

    let prodid = "";
    let version: "2.0" = "2.0";
    let name: string | undefined;
    let description: string | undefined;
    let calscale: "GREGORIAN" | undefined;
    let method: string | undefined;

    for (const line of lines) {
      const [key, ...valueParts] = line.split(":");
      const value = valueParts.join(":");

      if (key === "PRODID") prodid = value;
      else if (key === "VERSION") version = value as "2.0";
      else if (key === "NAME") name = value;
      else if (key === "DESCRIPTION") description = value;
      else if (key === "CALSCALE") calscale = value as "GREGORIAN";
      else if (key === "METHOD") method = value;
    }

    if (!prodid) {
      return yield* Effect.fail(new Error("PRODID is required"));
    }
    if (version !== "2.0") {
      return yield* Effect.fail(new Error("VERSION must be 2.0"));
    }

    return new Calendar({
      component: "VCALENDAR",
      version,
      prodid,
      calscale,
      method,
      name,
      description,
    });
  });
};
