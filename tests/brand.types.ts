/**
 * Compile-time assertions for the branded Schema classes (#9): a structurally
 * compatible plain object is not an `Event`, `Todo`, `Calendar` or error
 * instance, so instances come only from `make`, the setters, the constructors
 * or decoding. Type-checked by `vp run check` (`tsconfig.test.json`), never run.
 */

import type { BuildError, Calendar, EncodeError, Event, ParseError, Todo } from "../src/index";

/** Compiles only when `T` is `true`. */
type Assert<T extends true> = T;

/** `true` when `A` is assignable to `B`, else `false`. */
type Assignable<A, B> = [A] extends [B] ? true : false;

/** `true` when `A` is not assignable to `B`, else `false`. */
type NotAssignable<A, B> = [A] extends [B] ? false : true;

// Instances are still instances.
export type EventInstance = Assert<Assignable<Event.Event, Event.Event>>;
export type CalendarSetterTakesEvent = Assert<
  Assignable<Event.Event, Parameters<typeof Calendar.withEvent>[0]>
>;

// A plain object with every field an instance carries is rejected.
export type PlainEvent = Assert<
  NotAssignable<{ readonly component: "VEVENT"; readonly dtstart: string }, Event.Event>
>;
export type PlainEventToWithEvent = Assert<
  NotAssignable<
    { readonly component: "VEVENT"; readonly dtstart: string },
    Parameters<typeof Calendar.withEvent>[0]
  >
>;
export type PlainTodo = Assert<NotAssignable<{ readonly component: "VTODO" }, Todo.Todo>>;
export type PlainCalendar = Assert<
  NotAssignable<
    { readonly component: "VCALENDAR"; readonly version: "2.0"; readonly prodid: string },
    Calendar.Calendar
  >
>;

// An error's own fields alone do not make one of the package's errors.
export type PlainParseError = Assert<
  NotAssignable<Omit<ParseError, "brand"> & { readonly brand?: never }, ParseError>
>;
export type PlainEncodeError = Assert<
  NotAssignable<Omit<EncodeError, "brand"> & { readonly brand?: never }, EncodeError>
>;
export type PlainBuildError = Assert<
  NotAssignable<Omit<BuildError, "brand"> & { readonly brand?: never }, BuildError>
>;
