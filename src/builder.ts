/**
 * Builder API for creating iCalendar components
 * Provides a fluent interface for constructing calendars, events, todos, etc.
 */

import { Effect } from "effect";
import type * as Types from "./types.js";
import { encode, encodeSync } from "./encoder.js";

/**
 * Builder for creating VEVENT components
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
   * Add a display alarm
   */
  addDisplayAlarm(trigger: string, description?: string): this {
    return this.addAlarm({
      component: "VALARM",
      action: "DISPLAY",
      trigger,
      description,
    });
  }

  /**
   * Build the event
   */
  build(): Types.VEvent {
    if (!this.event.dtstart) {
      throw new Error("Event requires dtstart");
    }
    return this.event as Types.VEvent;
  }
}

/**
 * Builder for creating VTODO components
 */
export class TodoBuilder {
  private todo: Partial<Types.VTodo> = {
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
   * Set the percent complete (0-100)
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
   * Build the todo
   */
  build(): Types.VTodo {
    return this.todo as Types.VTodo;
  }
}

/**
 * Builder for creating VCALENDAR components
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
   * Add an event using a builder function
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
   * Add a todo using a builder function
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
   * Build the calendar
   */
  build(): Types.VCalendar {
    if (!this.calendar.prodid) {
      throw new Error("Calendar requires prodid");
    }
    return this.calendar as Types.VCalendar;
  }

  /**
   * Build and encode the calendar to iCal format
   */
  toICalString(): string {
    return encodeSync(this.build());
  }

  /**
   * Build and encode the calendar to iCal format using Effect
   */
  toICalEffect(): Effect.Effect<string, any> {
    return encode(this.build());
  }
}

/**
 * Create a new calendar builder
 */
export function createCalendar(prodid: string): CalendarBuilder {
  return new CalendarBuilder().prodid(prodid);
}

/**
 * Create a new event builder
 */
export function createEvent(): EventBuilder {
  return new EventBuilder();
}

/**
 * Create a new todo builder
 */
export function createTodo(): TodoBuilder {
  return new TodoBuilder();
}
