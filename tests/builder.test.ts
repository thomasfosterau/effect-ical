/**
 * Tests for the builder API
 */

import { describe, it, expect } from "bun:test";
import { createCalendar, createEvent, createTodo, CalendarBuilder } from "../src/builder";
import { parseEither } from "../src/parser";

describe("Builder API", () => {
  describe("CalendarBuilder", () => {
    it("should create a simple calendar", () => {
      const calendar = createCalendar("-//Test//Test//EN")
        .name("My Calendar")
        .description("Test calendar")
        .build();

      expect(calendar.component).toBe("VCALENDAR");
      expect(calendar.version).toBe("2.0");
      expect(calendar.prodid).toBe("-//Test//Test//EN");
      expect(calendar.name).toBe("My Calendar");
      expect(calendar.description).toBe("Test calendar");
    });

    it("should create a calendar with events", () => {
      const calendar = createCalendar("-//Test//Test//EN")
        .event((e) =>
          e
            .uid("event1")
            .dtstart("20240101T120000Z")
            .dtend("20240101T130000Z")
            .summary("Meeting")
        )
        .event((e) =>
          e
            .uid("event2")
            .dtstart("20240102T140000Z")
            .summary("Another Meeting")
        )
        .build();

      expect(calendar.events?.length).toBe(2);
      expect(calendar.events?.[0]?.uid).toBe("event1");
      expect(calendar.events?.[1]?.uid).toBe("event2");
    });

    it("should create a calendar with todos", () => {
      const calendar = createCalendar("-//Test//Test//EN")
        .todo((t) =>
          t
            .uid("todo1")
            .summary("Complete task")
            .status("NEEDS-ACTION")
            .priority(1)
        )
        .build();

      expect(calendar.todos?.length).toBe(1);
      expect(calendar.todos?.[0]?.uid).toBe("todo1");
      expect(calendar.todos?.[0]?.status).toBe("NEEDS-ACTION");
    });

    it("should encode calendar to iCal string", () => {
      const icalString = createCalendar("-//Test//Test//EN")
        .name("My Calendar")
        .event((e) =>
          e
            .uid("test-event")
            .dtstart("20240101T120000Z")
            .summary("Test Event")
        )
        .toICalString();

      expect(icalString).toContain("BEGIN:VCALENDAR");
      expect(icalString).toContain("VERSION:2.0");
      expect(icalString).toContain("PRODID:-//Test//Test//EN");
      expect(icalString).toContain("NAME:My Calendar");
      expect(icalString).toContain("BEGIN:VEVENT");
      expect(icalString).toContain("UID:test-event");
      expect(icalString).toContain("SUMMARY:Test Event");
    });

    it("should throw error if prodid is missing", () => {
      const builder = new CalendarBuilder();
      expect(() => builder.build()).toThrow("Calendar requires prodid");
    });
  });

  describe("EventBuilder", () => {
    it("should create a simple event", () => {
      const event = createEvent()
        .uid("test-event")
        .dtstart("20240101T120000Z")
        .dtend("20240101T130000Z")
        .summary("Test Event")
        .description("Event description")
        .location("Test Location")
        .build();

      expect(event.component).toBe("VEVENT");
      expect(event.uid).toBe("test-event");
      expect(event.dtstart).toBe("20240101T120000Z");
      expect(event.dtend).toBe("20240101T130000Z");
      expect(event.summary).toBe("Test Event");
      expect(event.description).toBe("Event description");
      expect(event.location).toBe("Test Location");
    });

    it("should add attendees to event", () => {
      const event = createEvent()
        .dtstart("20240101T120000Z")
        .addAttendee("mailto:user1@example.com")
        .addAttendee("mailto:user2@example.com")
        .build();

      expect(event.attendee?.length).toBe(2);
      expect(event.attendee?.[0]).toBe("mailto:user1@example.com");
      expect(event.attendee?.[1]).toBe("mailto:user2@example.com");
    });

    it("should set event properties", () => {
      const event = createEvent()
        .dtstart("20240101T120000Z")
        .status("CONFIRMED")
        .priority(5)
        .classification("PRIVATE")
        .categories(["Work", "Meeting"])
        .geo(40.7128, -74.006)
        .url("https://example.com")
        .build();

      expect(event.status).toBe("CONFIRMED");
      expect(event.priority).toBe(5);
      expect(event.class).toBe("PRIVATE");
      expect(event.categories).toEqual(["Work", "Meeting"]);
      expect(event.geo).toEqual({ lat: 40.7128, lon: -74.006 });
      expect(event.url).toBe("https://example.com");
    });

    it("should add alarms to event", () => {
      const event = createEvent()
        .dtstart("20240101T120000Z")
        .addDisplayAlarm("-PT15M", "15 minutes before")
        .addDisplayAlarm("-PT1H", "1 hour before")
        .build();

      expect(event.alarms?.length).toBe(2);
      expect(event.alarms?.[0]?.action).toBe("DISPLAY");
      expect(event.alarms?.[0]?.trigger).toBe("-PT15M");
      expect(event.alarms?.[1]?.trigger).toBe("-PT1H");
    });

    it("should throw error if dtstart is missing", () => {
      const builder = createEvent();
      expect(() => builder.build()).toThrow("Event requires dtstart");
    });
  });

  describe("TodoBuilder", () => {
    it("should create a simple todo", () => {
      const todo = createTodo()
        .uid("test-todo")
        .summary("Complete task")
        .description("Task description")
        .status("NEEDS-ACTION")
        .priority(1)
        .build();

      expect(todo.component).toBe("VTODO");
      expect(todo.uid).toBe("test-todo");
      expect(todo.summary).toBe("Complete task");
      expect(todo.description).toBe("Task description");
      expect(todo.status).toBe("NEEDS-ACTION");
      expect(todo.priority).toBe(1);
    });

    it("should set percent complete", () => {
      const todo = createTodo()
        .summary("Task")
        .percentComplete(50)
        .build();

      expect(todo.percent).toBe(50);
    });

    it("should clamp percent complete to 0-100", () => {
      const todo1 = createTodo().percentComplete(-10).build();
      const todo2 = createTodo().percentComplete(150).build();

      expect(todo1.percent).toBe(0);
      expect(todo2.percent).toBe(100);
    });

    it("should set due date and completed date", () => {
      const todo = createTodo()
        .summary("Task")
        .dtstart("20240101T090000Z")
        .due("20240105T170000Z")
        .completed("20240104T160000Z")
        .build();

      expect(todo.dtstart).toBe("20240101T090000Z");
      expect(todo.due).toBe("20240105T170000Z");
      expect(todo.completed).toBe("20240104T160000Z");
    });
  });

  describe("Integration with parser", () => {
    it("should round-trip calendar built with builder", () => {
      const icalString = createCalendar("-//Test//Test//EN")
        .name("Test Calendar")
        .calscale("GREGORIAN")
        .event((e) =>
          e
            .uid("event-123")
            .dtstart("20240115T100000Z")
            .dtend("20240115T110000Z")
            .summary("Team Meeting")
            .description("Weekly sync")
            .location("Office")
            .status("CONFIRMED")
            .priority(5)
        )
        .todo((t) =>
          t
            .uid("todo-456")
            .summary("Review PR")
            .status("IN-PROCESS")
            .percentComplete(75)
        )
        .toICalString();

      const result = parseEither(icalString);
      expect(result._tag).toBe("Right");

      if (result._tag === "Right") {
        const calendar = result.right;
        expect(calendar.prodid).toBe("-//Test//Test//EN");
        expect(calendar.name).toBe("Test Calendar");
        expect(calendar.calscale).toBe("GREGORIAN");

        expect(calendar.events?.length).toBe(1);
        const event = calendar.events?.[0];
        expect(event?.uid).toBe("event-123");
        expect(event?.summary).toBe("Team Meeting");
        expect(event?.description).toBe("Weekly sync");
        expect(event?.status).toBe("CONFIRMED");

        expect(calendar.todos?.length).toBe(1);
        const todo = calendar.todos?.[0];
        expect(todo?.uid).toBe("todo-456");
        expect(todo?.summary).toBe("Review PR");
        expect(todo?.status).toBe("IN-PROCESS");
        expect(todo?.percent).toBe(75);
      }
    });
  });

  describe("Fluent API chaining", () => {
    it("should support method chaining", () => {
      const calendar = createCalendar("-//Test//Test//EN")
        .name("My Calendar")
        .description("Test")
        .event((e) => e.dtstart("20240101T120000Z").summary("Event 1"))
        .event((e) => e.dtstart("20240102T120000Z").summary("Event 2"))
        .todo((t) => t.summary("Todo 1"))
        .todo((t) => t.summary("Todo 2").priority(1))
        .build();

      expect(calendar.events?.length).toBe(2);
      expect(calendar.todos?.length).toBe(2);
    });
  });
});
