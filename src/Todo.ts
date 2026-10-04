/**
 * Todo module - Effect-style API for iCalendar VTODO components
 */

import { Effect } from "effect";
import * as Schema from "effect/Schema";

/**
 * Todo Schema - represents a VTODO component
 */
export class Todo extends Schema.Class<Todo>("Todo")({
  component: Schema.Literal("VTODO"),
  uid: Schema.optional(Schema.String),
  dtstamp: Schema.optional(Schema.String),
  dtstart: Schema.optional(Schema.String),
  due: Schema.optional(Schema.String),
  duration: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  location: Schema.optional(Schema.String),
  status: Schema.optional(
    Schema.Literal("NEEDS-ACTION", "COMPLETED", "IN-PROCESS", "CANCELLED")
  ),
  percent: Schema.optional(Schema.Number),
  completed: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.Number),
  rrule: Schema.optional(Schema.String),
}) {}

/**
 * Create a new Todo
 */
export const make = (): Todo => {
  return new Todo({
    component: "VTODO",
  });
};

/**
 * Set UID
 */
export const withUid = (uid: string) => (todo: Todo): Todo => ({
  ...todo,
  uid,
});

/**
 * Set DTSTART
 */
export const withDtstart = (dtstart: string) => (todo: Todo): Todo => ({
  ...todo,
  dtstart,
});

/**
 * Set DUE
 */
export const withDue = (due: string) => (todo: Todo): Todo => ({
  ...todo,
  due,
});

/**
 * Set summary
 */
export const withSummary = (summary: string) => (todo: Todo): Todo => ({
  ...todo,
  summary,
});

/**
 * Set description
 */
export const withDescription = (description: string) => (todo: Todo): Todo => ({
  ...todo,
  description,
});

/**
 * Set location
 */
export const withLocation = (location: string) => (todo: Todo): Todo => ({
  ...todo,
  location,
});

/**
 * Set status
 */
export const withStatus =
  (status: "NEEDS-ACTION" | "COMPLETED" | "IN-PROCESS" | "CANCELLED") =>
  (todo: Todo): Todo => ({
    ...todo,
    status,
  });

/**
 * Set percent complete (0-100)
 */
export const withPercent = (percent: number) => (todo: Todo): Todo => ({
  ...todo,
  percent: Math.max(0, Math.min(100, percent)),
});

/**
 * Set completed date
 */
export const withCompleted = (completed: string) => (todo: Todo): Todo => ({
  ...todo,
  completed,
});

/**
 * Set priority
 */
export const withPriority = (priority: number) => (todo: Todo): Todo => ({
  ...todo,
  priority,
});

/**
 * Set recurrence rule
 */
export const withRrule = (rrule: string) => (todo: Todo): Todo => ({
  ...todo,
  rrule,
});

/**
 * Encode a todo to iCal format lines
 */
export const encode = (todo: Todo): Effect.Effect<string[], Error> => {
  return Effect.gen(function* () {
    const lines: string[] = [];

    lines.push("BEGIN:VTODO");

    if (todo.uid) lines.push(`UID:${todo.uid}`);
    if (todo.dtstamp) lines.push(`DTSTAMP:${todo.dtstamp}`);
    if (todo.dtstart) lines.push(`DTSTART:${todo.dtstart}`);
    if (todo.due) lines.push(`DUE:${todo.due}`);
    if (todo.duration) lines.push(`DURATION:${todo.duration}`);
    if (todo.summary) lines.push(`SUMMARY:${todo.summary}`);
    if (todo.description) lines.push(`DESCRIPTION:${todo.description}`);
    if (todo.location) lines.push(`LOCATION:${todo.location}`);
    if (todo.status) lines.push(`STATUS:${todo.status}`);
    if (todo.percent !== undefined) lines.push(`PERCENT-COMPLETE:${todo.percent}`);
    if (todo.completed) lines.push(`COMPLETED:${todo.completed}`);
    if (todo.priority !== undefined) lines.push(`PRIORITY:${todo.priority}`);
    if (todo.rrule) lines.push(`RRULE:${todo.rrule}`);

    lines.push("END:VTODO");

    return lines;
  });
};
