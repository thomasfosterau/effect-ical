/**
 * Event module - Effect-style API for iCalendar VEVENT components
 */

import { Effect } from "effect";
import * as Schema from "effect/Schema";

/**
 * Event Schema - represents a VEVENT component
 */
export class Event extends Schema.Class<Event>("Event")({
  component: Schema.Literal("VEVENT"),
  uid: Schema.optional(Schema.String),
  dtstamp: Schema.optional(Schema.String),
  dtstart: Schema.String,
  dtend: Schema.optional(Schema.String),
  duration: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  location: Schema.optional(Schema.String),
  organizer: Schema.optional(Schema.String),
  attendee: Schema.optional(Schema.Array(Schema.String)),
  categories: Schema.optional(Schema.Array(Schema.String)),
  status: Schema.optional(Schema.Literal("TENTATIVE", "CONFIRMED", "CANCELLED")),
  rrule: Schema.optional(Schema.String),
  rdate: Schema.optional(Schema.Array(Schema.String)),
  exdate: Schema.optional(Schema.Array(Schema.String)),
  url: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.Number),
  class: Schema.optional(Schema.Literal("PUBLIC", "PRIVATE", "CONFIDENTIAL")),
}) {}

/**
 * Create a new Event with required properties
 */
export const make = (dtstart: string): Event => {
  return new Event({
    component: "VEVENT",
    dtstart,
  });
};

/**
 * Set UID
 */
export const withUid = (uid: string) => (event: Event): Event => ({
  ...event,
  uid,
});

/**
 * Set DTEND
 */
export const withDtend = (dtend: string) => (event: Event): Event => ({
  ...event,
  dtend,
});

/**
 * Set duration
 */
export const withDuration = (duration: string) => (event: Event): Event => ({
  ...event,
  duration,
});

/**
 * Set summary
 */
export const withSummary = (summary: string) => (event: Event): Event => ({
  ...event,
  summary,
});

/**
 * Set description
 */
export const withDescription = (description: string) => (event: Event): Event => ({
  ...event,
  description,
});

/**
 * Set location
 */
export const withLocation = (location: string) => (event: Event): Event => ({
  ...event,
  location,
});

/**
 * Set organizer
 */
export const withOrganizer = (organizer: string) => (event: Event): Event => ({
  ...event,
  organizer,
});

/**
 * Add an attendee
 */
export const withAttendee = (attendee: string) => (event: Event): Event => ({
  ...event,
  attendee: [...(event.attendee || []), attendee],
});

/**
 * Set categories
 */
export const withCategories = (categories: string[]) => (event: Event): Event => ({
  ...event,
  categories,
});

/**
 * Set status
 */
export const withStatus =
  (status: "TENTATIVE" | "CONFIRMED" | "CANCELLED") => (event: Event): Event => ({
    ...event,
    status,
  });

/**
 * Set recurrence rule
 */
export const withRrule = (rrule: string) => (event: Event): Event => ({
  ...event,
  rrule,
});

/**
 * Set URL
 */
export const withUrl = (url: string) => (event: Event): Event => ({
  ...event,
  url,
});

/**
 * Set priority
 */
export const withPriority = (priority: number) => (event: Event): Event => ({
  ...event,
  priority,
});

/**
 * Set classification
 */
export const withClassification =
  (classification: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL") => (event: Event): Event => ({
    ...event,
    class: classification,
  });

/**
 * Encode an event to iCal format lines
 */
export const encode = (event: Event): Effect.Effect<string[], Error> => {
  return Effect.gen(function* () {
    const lines: string[] = [];

    lines.push("BEGIN:VEVENT");
    lines.push(`DTSTART:${event.dtstart}`);

    if (event.uid) lines.push(`UID:${event.uid}`);
    if (event.dtstamp) lines.push(`DTSTAMP:${event.dtstamp}`);
    if (event.dtend) lines.push(`DTEND:${event.dtend}`);
    if (event.duration) lines.push(`DURATION:${event.duration}`);
    if (event.summary) lines.push(`SUMMARY:${event.summary}`);
    if (event.description) lines.push(`DESCRIPTION:${event.description}`);
    if (event.location) lines.push(`LOCATION:${event.location}`);
    if (event.organizer) lines.push(`ORGANIZER:${event.organizer}`);

    if (event.attendee) {
      for (const att of event.attendee) {
        lines.push(`ATTENDEE:${att}`);
      }
    }

    if (event.categories) {
      lines.push(`CATEGORIES:${event.categories.join(",")}`);
    }

    if (event.status) lines.push(`STATUS:${event.status}`);
    if (event.rrule) lines.push(`RRULE:${event.rrule}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.priority !== undefined) lines.push(`PRIORITY:${event.priority}`);
    if (event.class) lines.push(`CLASS:${event.class}`);

    lines.push("END:VEVENT");

    return lines;
  });
};
