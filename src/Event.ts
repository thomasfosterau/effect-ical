/**
 * Pipeable constructors and setters for iCalendar `VEVENT` components, as an
 * Effect Schema class.
 *
 * Start from `Event.make(dtstart)` and pipe setters (`Event.withSummary`,
 * `Event.withLocation`, …); each returns a new event and leaves its input
 * untouched. `Event.encode` renders the event's content lines.
 *
 * @module
 */

// The barrel re-exports this module only as a namespace (`export * as Event`),
// so its setter and `encode` names never collide with a sibling module's.
// fallow-ignore-file duplicate-export
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/**
 * A `VEVENT` component: a scheduled event, as an Effect Schema class.
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
  status: Schema.optional(Schema.Literals(["TENTATIVE", "CONFIRMED", "CANCELLED"])),
  rrule: Schema.optional(Schema.String),
  rdate: Schema.optional(Schema.Array(Schema.String)),
  exdate: Schema.optional(Schema.Array(Schema.String)),
  url: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.Number),
  class: Schema.optional(Schema.Literals(["PUBLIC", "PRIVATE", "CONFIDENTIAL"])),
}) {}

/**
 * Create an event starting at `dtstart` (an RFC 5545 DATE or DATE-TIME string).
 */
export const make = (dtstart: string): Event => {
  return new Event({
    component: "VEVENT",
    dtstart,
  });
};

/**
 * Return a copy of the event with its unique identifier (`UID`) set.
 */
export const withUid =
  (uid: string) =>
  (event: Event): Event => ({
    ...event,
    uid,
  });

/**
 * Return a copy of the event with its end (`DTEND`) set.
 */
export const withDtend =
  (dtend: string) =>
  (event: Event): Event => ({
    ...event,
    dtend,
  });

/**
 * Return a copy of the event with its duration (`DURATION`, e.g. `PT1H`) set.
 */
export const withDuration =
  (duration: string) =>
  (event: Event): Event => ({
    ...event,
    duration,
  });

/**
 * Return a copy of the event with its summary (`SUMMARY`) set.
 */
export const withSummary =
  (summary: string) =>
  (event: Event): Event => ({
    ...event,
    summary,
  });

/**
 * Return a copy of the event with its description (`DESCRIPTION`) set.
 */
export const withDescription =
  (description: string) =>
  (event: Event): Event => ({
    ...event,
    description,
  });

/**
 * Return a copy of the event with its location (`LOCATION`) set.
 */
export const withLocation =
  (location: string) =>
  (event: Event): Event => ({
    ...event,
    location,
  });

/**
 * Return a copy of the event with its organizer (`ORGANIZER`, e.g. a `mailto:` URI) set.
 */
export const withOrganizer =
  (organizer: string) =>
  (event: Event): Event => ({
    ...event,
    organizer,
  });

/**
 * Return a copy of the event with one more attendee (`ATTENDEE`) appended.
 */
export const withAttendee =
  (attendee: string) =>
  (event: Event): Event => ({
    ...event,
    attendee: [...(event.attendee || []), attendee],
  });

/**
 * Return a copy of the event with its categories (`CATEGORIES`) replaced.
 */
export const withCategories =
  (categories: string[]) =>
  (event: Event): Event => ({
    ...event,
    categories,
  });

/**
 * Return a copy of the event with its status (`STATUS`) set.
 */
export const withStatus =
  (status: "TENTATIVE" | "CONFIRMED" | "CANCELLED") =>
  (event: Event): Event => ({
    ...event,
    status,
  });

/**
 * Return a copy of the event with its recurrence rule (`RRULE`, e.g. `FREQ=WEEKLY`) set.
 */
export const withRrule =
  (rrule: string) =>
  (event: Event): Event => ({
    ...event,
    rrule,
  });

/**
 * Return a copy of the event with its URL (`URL`) set.
 */
export const withUrl =
  (url: string) =>
  (event: Event): Event => ({
    ...event,
    url,
  });

/**
 * Return a copy of the event with its priority (`PRIORITY`: 0 undefined, 1 highest, 9 lowest) set.
 */
export const withPriority =
  (priority: number) =>
  (event: Event): Event => ({
    ...event,
    priority,
  });

/**
 * Return a copy of the event with its access classification (`CLASS`) set.
 */
export const withClassification =
  (classification: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL") =>
  (event: Event): Event => ({
    ...event,
    class: classification,
  });

/**
 * Render an event as its iCalendar content lines, from `BEGIN:VEVENT` to
 * `END:VEVENT`.
 *
 * Values are written verbatim: no escaping and no line folding (the
 * `encode` function at the package root does both, for a whole calendar).
 * Empty optional strings are omitted; `priority` is written whenever it is
 * set, including `0`.
 *
 * @category encoding
 */
export const encode = (event: Event): Effect.Effect<Array<string>> =>
  Effect.sync(() => [
    "BEGIN:VEVENT",
    `DTSTART:${event.dtstart}`,
    ...(event.uid ? [`UID:${event.uid}`] : []),
    ...(event.dtstamp ? [`DTSTAMP:${event.dtstamp}`] : []),
    ...(event.dtend ? [`DTEND:${event.dtend}`] : []),
    ...(event.duration ? [`DURATION:${event.duration}`] : []),
    ...(event.summary ? [`SUMMARY:${event.summary}`] : []),
    ...(event.description ? [`DESCRIPTION:${event.description}`] : []),
    ...(event.location ? [`LOCATION:${event.location}`] : []),
    ...(event.organizer ? [`ORGANIZER:${event.organizer}`] : []),
    ...Arr.map(event.attendee ?? [], (attendee) => `ATTENDEE:${attendee}`),
    ...(event.categories ? [`CATEGORIES:${Arr.join(event.categories, ",")}`] : []),
    ...(event.status ? [`STATUS:${event.status}`] : []),
    ...(event.rrule ? [`RRULE:${event.rrule}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    ...(event.priority === undefined ? [] : [`PRIORITY:${event.priority}`]),
    ...(event.class ? [`CLASS:${event.class}`] : []),
    "END:VEVENT",
  ]);
