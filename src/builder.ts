/**
 * Fluent, mutable builders for the plain {@link Types.VCalendar} object
 * model: `createCalendar(prodid)`, `createEvent()` and `createTodo()`.
 *
 * Each setter mutates the builder and returns it, so calls chain; `build()`
 * returns the builder's own object (later setter calls still change it).
 *
 * @module
 */

import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type * as Types from "./types.js";
import { encode, encodeSync, type EncodeError } from "./encoder.js";

/**
 * Thrown by a builder's `build()` when a required property is missing: an
 * event's `dtstart` or a calendar's `prodid`. `message` says which.
 *
 * @category errors
 */
export class BuildError extends Schema.TaggedError<BuildError, { readonly brand: unique symbol }>()(
  "BuildError",
  {
    message: Schema.String,
  },
) {}

/** An event under construction is complete once it has a non-empty `dtstart`. */
const isCompleteEvent = (event: Partial<Types.VEvent>): event is Types.VEvent =>
  Boolean(event.dtstart);

/** A calendar under construction is complete once it has a non-empty `prodid`. */
const isCompleteCalendar = (calendar: Partial<Types.VCalendar>): calendar is Types.VCalendar =>
  Boolean(calendar.prodid);

/**
 * A mutable, chainable builder for a `VEvent`; `build()` requires `dtstart`.
 */
export class EventBuilder {
  private event: Partial<Types.VEvent> = {
    component: "VEVENT",
  };

  /**
   * Set the unique identifier for the event
   */
  uid(uid: string): this {
    this.event.uid = uid;
    return this;
  }

  /**
   * Set the start date/time
   */
  dtstart(dtstart: string): this {
    this.event.dtstart = dtstart;
    return this;
  }

  /**
   * Set the end date/time
   */
  dtend(dtend: string): this {
    this.event.dtend = dtend;
    return this;
  }

  /**
   * Set the duration (alternative to dtend)
   */
  duration(duration: string): this {
    this.event.duration = duration;
    return this;
  }

  /**
   * Set the event summary/title
   */
  summary(summary: string): this {
    this.event.summary = summary;
    return this;
  }

  /**
   * Set the event description
   */
  description(description: string): this {
    this.event.description = description;
    return this;
  }

  /**
   * Set the event location
   */
  location(location: string): this {
    this.event.location = location;
    return this;
  }

  /**
   * Set the organizer
   */
  organizer(organizer: string): this {
    this.event.organizer = organizer;
    return this;
  }

  /**
   * Add an attendee
   */
  addAttendee(attendee: string): this {
    if (!this.event.attendee) {
      this.event.attendee = [];
    }
    this.event.attendee.push(attendee);
    return this;
  }

  /**
   * Set attendees
   */
  attendees(attendees: string[]): this {
    this.event.attendee = attendees;
    return this;
  }

  /**
   * Set categories
   */
  categories(categories: string[]): this {
    this.event.categories = categories;
    return this;
  }

  /**
   * Set the event status
   */
  status(status: "TENTATIVE" | "CONFIRMED" | "CANCELLED"): this {
    this.event.status = status;
    return this;
  }

  /**
   * Set the recurrence rule
   */
  rrule(rrule: string): this {
    this.event.rrule = rrule;
    return this;
  }

  /**
   * Set the URL
   */
  url(url: string): this {
    this.event.url = url;
    return this;
  }

  /**
   * Set geographic position
   */
  geo(lat: number, lon: number): this {
    this.event.geo = { lat, lon };
    return this;
  }

  /**
   * Set priority (0-9, where 0 = undefined, 1 = highest, 9 = lowest)
   */
  priority(priority: number): this {
    this.event.priority = priority;
    return this;
  }

  /**
   * Set classification
   */
  classification(classification: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL"): this {
    this.event.class = classification;
    return this;
  }

  /**
   * Set the timestamp
   */
  dtstamp(dtstamp: string): this {
    this.event.dtstamp = dtstamp;
    return this;
  }

  /**
   * Add an alarm to the event
   */
  addAlarm(alarm: Types.VAlarm): this {
    if (!this.event.alarms) {
      this.event.alarms = [];
    }
    this.event.alarms.push(alarm);
    return this;
  }

  /**
   * Add a `DISPLAY` alarm firing at `trigger` (e.g. `-PT15M`), with an optional description.
   */
  addDisplayAlarm(trigger: string, description?: string): this {
    const alarm: Types.VAlarm = { component: "VALARM", action: "DISPLAY", trigger };
    return this.addAlarm(description === undefined ? alarm : { ...alarm, description });
  }

  /**
   * Return the event, throwing a {@link BuildError} if `dtstart` is missing or empty.
   */
  build(): Types.VEvent {
    if (!isCompleteEvent(this.event)) {
      throw new BuildError({ message: "Event requires dtstart" });
    }
    return this.event;
  }
}

/**
 * A mutable, chainable builder for a `VTodo`.
 */
export class TodoBuilder {
  private todo: Types.VTodo = {
    component: "VTODO",
  };

  /**
   * Set the unique identifier
   */
  uid(uid: string): this {
    this.todo.uid = uid;
    return this;
  }

  /**
   * Set the start date/time
   */
  dtstart(dtstart: string): this {
    this.todo.dtstart = dtstart;
    return this;
  }

  /**
   * Set the due date/time
   */
  due(due: string): this {
    this.todo.due = due;
    return this;
  }

  /**
   * Set the duration
   */
  duration(duration: string): this {
    this.todo.duration = duration;
    return this;
  }

  /**
   * Set the summary
   */
  summary(summary: string): this {
    this.todo.summary = summary;
    return this;
  }

  /**
   * Set the description
   */
  description(description: string): this {
    this.todo.description = description;
    return this;
  }

  /**
   * Set the location
   */
  location(location: string): this {
    this.todo.location = location;
    return this;
  }

  /**
   * Set the status
   */
  status(status: "NEEDS-ACTION" | "COMPLETED" | "IN-PROCESS" | "CANCELLED"): this {
    this.todo.status = status;
    return this;
  }

  /**
   * Set the percent complete, clamped to 0–100.
   */
  percentComplete(percent: number): this {
    this.todo.percent = Math.max(0, Math.min(100, percent));
    return this;
  }

  /**
   * Set the completed date/time
   */
  completed(completed: string): this {
    this.todo.completed = completed;
    return this;
  }

  /**
   * Set priority (0-9)
   */
  priority(priority: number): this {
    this.todo.priority = priority;
    return this;
  }

  /**
   * Set the timestamp
   */
  dtstamp(dtstamp: string): this {
    this.todo.dtstamp = dtstamp;
    return this;
  }

  /**
   * Set the recurrence rule
   */
  rrule(rrule: string): this {
    this.todo.rrule = rrule;
    return this;
  }

  /**
   * Add an alarm
   */
  addAlarm(alarm: Types.VAlarm): this {
    if (!this.todo.alarms) {
      this.todo.alarms = [];
    }
    this.todo.alarms.push(alarm);
    return this;
  }

  /**
   * Return the to-do (the builder's own object; later setter calls still change it).
   */
  build(): Types.VTodo {
    return this.todo;
  }
}

/**
 * A mutable, chainable builder for a `VCalendar`; `build()` requires `prodid`.
 */
export class CalendarBuilder {
  private calendar: Partial<Types.VCalendar> = {
    component: "VCALENDAR",
    version: "2.0",
  };

  /**
   * Set the product identifier
   */
  prodid(prodid: string): this {
    this.calendar.prodid = prodid;
    return this;
  }

  /**
   * Set the calendar scale (default: GREGORIAN)
   */
  calscale(calscale: "GREGORIAN"): this {
    this.calendar.calscale = calscale;
    return this;
  }

  /**
   * Set the method (used with iTIP)
   */
  method(method: string): this {
    this.calendar.method = method;
    return this;
  }

  /**
   * Set the calendar name
   */
  name(name: string): this {
    this.calendar.name = name;
    return this;
  }

  /**
   * Set the calendar description
   */
  description(description: string): this {
    this.calendar.description = description;
    return this;
  }

  /**
   * Add an event to the calendar
   */
  addEvent(event: Types.VEvent): this {
    if (!this.calendar.events) {
      this.calendar.events = [];
    }
    this.calendar.events.push(event);
    return this;
  }

  /**
   * Build an event with `builderFn` on a fresh `EventBuilder` and add it.
   */
  event(builderFn: (builder: EventBuilder) => EventBuilder): this {
    const builder = new EventBuilder();
    const event = builderFn(builder).build();
    return this.addEvent(event);
  }

  /**
   * Add a todo to the calendar
   */
  addTodo(todo: Types.VTodo): this {
    if (!this.calendar.todos) {
      this.calendar.todos = [];
    }
    this.calendar.todos.push(todo);
    return this;
  }

  /**
   * Build a to-do with `builderFn` on a fresh `TodoBuilder` and add it.
   */
  todo(builderFn: (builder: TodoBuilder) => TodoBuilder): this {
    const builder = new TodoBuilder();
    const todo = builderFn(builder).build();
    return this.addTodo(todo);
  }

  /**
   * Add a journal entry to the calendar
   */
  addJournal(journal: Types.VJournal): this {
    if (!this.calendar.journals) {
      this.calendar.journals = [];
    }
    this.calendar.journals.push(journal);
    return this;
  }

  /**
   * Add a timezone to the calendar
   */
  addTimezone(timezone: Types.VTimezone): this {
    if (!this.calendar.timezones) {
      this.calendar.timezones = [];
    }
    this.calendar.timezones.push(timezone);
    return this;
  }

  /**
   * Return the calendar, throwing a {@link BuildError} if `prodid` is missing or empty.
   */
  build(): Types.VCalendar {
    if (!isCompleteCalendar(this.calendar)) {
      throw new BuildError({ message: "Calendar requires prodid" });
    }
    return this.calendar;
  }

  /**
   * Build the calendar and encode it as iCalendar text with `encodeSync`.
   */
  toICalString(): string {
    return encodeSync(this.build());
  }

  /**
   * Build the calendar and encode it with `encode`; `build()` runs (and may throw) immediately.
   */
  toICalEffect(): Effect.Effect<string, EncodeError> {
    return encode(this.build());
  }
}

/**
 * Start building a calendar with the given product identifier (`PRODID`).
 */
export function createCalendar(prodid: string): CalendarBuilder {
  return new CalendarBuilder().prodid(prodid);
}

/**
 * Start building an event.
 */
export function createEvent(): EventBuilder {
  return new EventBuilder();
}

/**
 * Start building a to-do.
 */
export function createTodo(): TodoBuilder {
  return new TodoBuilder();
}
