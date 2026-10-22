/**
 * Pipeable constructors and setters for iCalendar `VTODO` components, as an
 * Effect Schema class.
 *
 * Start from `Todo.make()` and pipe setters (`Todo.withSummary`,
 * `Todo.withDue`, …); each returns a new to-do and leaves its input
 * untouched. `Todo.encode` renders the to-do's content lines.
 *
 * @module
 */

import * as Effect from "effect/Effect";
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
    Schema.Literals(["NEEDS-ACTION", "COMPLETED", "IN-PROCESS", "CANCELLED"]),
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
export const withUid =
  (uid: string) =>
  (todo: Todo): Todo => ({
    ...todo,
    uid,
  });

/**
 * Set DTSTART
 */
export const withDtstart =
  (dtstart: string) =>
  (todo: Todo): Todo => ({
    ...todo,
    dtstart,
  });

/**
 * Set DUE
 */
export const withDue =
  (due: string) =>
  (todo: Todo): Todo => ({
    ...todo,
    due,
  });

/**
 * Set summary
 */
export const withSummary =
  (summary: string) =>
  (todo: Todo): Todo => ({
    ...todo,
    summary,
  });

/**
 * Set description
 */
export const withDescription =
  (description: string) =>
  (todo: Todo): Todo => ({
    ...todo,
    description,
  });

/**
 * Set location
 */
export const withLocation =
  (location: string) =>
  (todo: Todo): Todo => ({
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
export const withPercent =
  (percent: number) =>
  (todo: Todo): Todo => ({
    ...todo,
    percent: Math.max(0, Math.min(100, percent)),
  });

/**
 * Set completed date
 */
export const withCompleted =
  (completed: string) =>
  (todo: Todo): Todo => ({
    ...todo,
    completed,
  });

/**
 * Set priority
 */
export const withPriority =
  (priority: number) =>
  (todo: Todo): Todo => ({
    ...todo,
    priority,
  });

/**
 * Set recurrence rule
 */
export const withRrule =
  (rrule: string) =>
  (todo: Todo): Todo => ({
    ...todo,
    rrule,
  });

/**
 * Render a to-do as its iCalendar content lines, from `BEGIN:VTODO` to
 * `END:VTODO`.
 *
 * Values are written verbatim: no escaping and no line folding (the
 * `encode` function at the package root does both, for a whole calendar).
 * Empty optional strings are omitted; `percent` and `priority` are written
 * whenever they are set, including `0`.
 *
 * @category encoding
 */
export const encode = (todo: Todo): Effect.Effect<Array<string>> =>
  Effect.sync(() => [
    "BEGIN:VTODO",
    ...(todo.uid ? [`UID:${todo.uid}`] : []),
    ...(todo.dtstamp ? [`DTSTAMP:${todo.dtstamp}`] : []),
    ...(todo.dtstart ? [`DTSTART:${todo.dtstart}`] : []),
    ...(todo.due ? [`DUE:${todo.due}`] : []),
    ...(todo.duration ? [`DURATION:${todo.duration}`] : []),
    ...(todo.summary ? [`SUMMARY:${todo.summary}`] : []),
    ...(todo.description ? [`DESCRIPTION:${todo.description}`] : []),
    ...(todo.location ? [`LOCATION:${todo.location}`] : []),
    ...(todo.status ? [`STATUS:${todo.status}`] : []),
    ...(todo.percent === undefined ? [] : [`PERCENT-COMPLETE:${todo.percent}`]),
    ...(todo.completed ? [`COMPLETED:${todo.completed}`] : []),
    ...(todo.priority === undefined ? [] : [`PRIORITY:${todo.priority}`]),
    ...(todo.rrule ? [`RRULE:${todo.rrule}`] : []),
    "END:VTODO",
  ]);
