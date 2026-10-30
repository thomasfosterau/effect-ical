/**
 * Pipeable constructors and setters for iCalendar `VTODO` components, as an
 * Effect Schema class.
 *
 * Start from `Todo.make()` and pipe setters (`Todo.withSummary`,
 * `Todo.withDue`, …); each returns a new to-do (an instance of the class,
 * so properties it does not declare are not carried over) and leaves its
 * input untouched. `Todo.encode` renders the to-do's content lines.
 *
 * @module
 */

// The barrel re-exports this module only as a namespace (`export * as Todo`),
// so its setter and `encode` names never collide with a sibling module's.
// fallow-ignore-file duplicate-export
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/**
 * A `VTODO` component: an action item, as an Effect Schema class.
 */
export class Todo extends Schema.Class<Todo, { readonly brand: unique symbol }>("Todo")({
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
  percent: Schema.optional(Schema.Finite),
  completed: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.Finite),
  rrule: Schema.optional(Schema.String),
}) {}

/**
 * Create an empty to-do.
 */
export const make = (): Todo => {
  return new Todo({
    component: "VTODO",
  });
};

/**
 * Return a copy of the to-do with its unique identifier (`UID`) set.
 */
export const withUid =
  (uid: string) =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      uid,
    });

/**
 * Return a copy of the to-do with its start (`DTSTART`) set.
 */
export const withDtstart =
  (dtstart: string) =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      dtstart,
    });

/**
 * Return a copy of the to-do with its due date (`DUE`) set.
 */
export const withDue =
  (due: string) =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      due,
    });

/**
 * Return a copy of the to-do with its summary (`SUMMARY`) set.
 */
export const withSummary =
  (summary: string) =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      summary,
    });

/**
 * Return a copy of the to-do with its description (`DESCRIPTION`) set.
 */
export const withDescription =
  (description: string) =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      description,
    });

/**
 * Return a copy of the to-do with its location (`LOCATION`) set.
 */
export const withLocation =
  (location: string) =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      location,
    });

/**
 * Return a copy of the to-do with its status (`STATUS`) set.
 */
export const withStatus =
  (status: "NEEDS-ACTION" | "COMPLETED" | "IN-PROCESS" | "CANCELLED") =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      status,
    });

/**
 * Return a copy of the to-do with its completion (`PERCENT-COMPLETE`) set, clamped to 0–100.
 */
export const withPercent =
  (percent: number) =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      percent: Math.max(0, Math.min(100, percent)),
    });

/**
 * Return a copy of the to-do with its completion time (`COMPLETED`) set.
 */
export const withCompleted =
  (completed: string) =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      completed,
    });

/**
 * Return a copy of the to-do with its priority (`PRIORITY`: 0 undefined, 1 highest, 9 lowest) set.
 */
export const withPriority =
  (priority: number) =>
  (todo: Todo): Todo =>
    new Todo({
      ...todo,
      priority,
    });

/**
 * Return a copy of the to-do with its recurrence rule (`RRULE`) set.
 */
export const withRrule =
  (rrule: string) =>
  (todo: Todo): Todo =>
    new Todo({
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
