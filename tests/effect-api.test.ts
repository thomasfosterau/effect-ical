/**
 * Tests for the Effect-style API
 */

import { describe, it, expect } from "vite-plus/test";
import { pipe } from "effect/Function";
import * as Schema from "effect/Schema";
import { runTest } from "./helpers/effect.ts";
import * as Calendar from "../src/Calendar";
import * as Event from "../src/Event";
import * as Todo from "../src/Todo";

describe("Effect-style API", () => {
  describe("Calendar", () => {
    it("should create a calendar with Calendar.make()", () => {
      const calendar = Calendar.make("-//Test//Test//EN");

      expect(calendar.component).toBe("VCALENDAR");
      expect(calendar.version).toBe("2.0");
      expect(calendar.prodid).toBe("-//Test//Test//EN");
    });

    it("should encode a calendar with Calendar.encode()", async () => {
      const calendar = Calendar.make("-//Test//Test//EN");
      const encoded = await runTest(Calendar.encode(calendar));

      expect(encoded).toContain("BEGIN:VCALENDAR");
      expect(encoded).toContain("VERSION:2.0");
      expect(encoded).toContain("PRODID:-//Test//Test//EN");
      expect(encoded).toContain("END:VCALENDAR");
    });

    it("should build a calendar with pipe", () => {
      const calendar = pipe(
        Calendar.builder(),
        Calendar.withProdid("-//My Company//My App//EN"),
        Calendar.withName("My Calendar"),
        Calendar.withDescription("Test calendar"),
        Calendar.build,
      );

      expect(calendar.prodid).toBe("-//My Company//My App//EN");
      expect(calendar.name).toBe("My Calendar");
      expect(calendar.description).toBe("Test calendar");
    });

    it("should add events to calendar using withEvent", () => {
      const event = Event.make("20240101T120000Z");

      const calendar = pipe(
        Calendar.builder(),
        Calendar.withProdid("-//Test//EN"),
        Calendar.withEvent(event),
        Calendar.build,
      );

      expect(calendar.events?.length).toBe(1);
    });

    it("should add todos to calendar using withTodo", () => {
      const todo = Todo.make();

      const calendar = pipe(
        Calendar.builder(),
        Calendar.withProdid("-//Test//EN"),
        Calendar.withTodo(todo),
        Calendar.build,
      );

      expect(calendar.todos?.length).toBe(1);
    });
  });

  describe("Event", () => {
    it("should create an event with Event.make()", () => {
      const event = Event.make("20240101T120000Z");

      expect(event.component).toBe("VEVENT");
      expect(event.dtstart).toBe("20240101T120000Z");
    });

    it("should build an event with pipe", () => {
      const event = pipe(
        Event.make("20240101T120000Z"),
        Event.withUid("event123"),
        Event.withSummary("Team Meeting"),
        Event.withDescription("Weekly sync"),
        Event.withLocation("Office"),
        Event.withStatus("CONFIRMED"),
      );

      expect(event.uid).toBe("event123");
      expect(event.summary).toBe("Team Meeting");
      expect(event.description).toBe("Weekly sync");
      expect(event.location).toBe("Office");
      expect(event.status).toBe("CONFIRMED");
    });

    it("should encode an event", async () => {
      const event = pipe(
        Event.make("20240101T120000Z"),
        Event.withUid("event123"),
        Event.withSummary("Meeting"),
      );

      const lines = await runTest(Event.encode(event));

      expect(lines).toContain("BEGIN:VEVENT");
      expect(lines).toContain("DTSTART:20240101T120000Z");
      expect(lines).toContain("UID:event123");
      expect(lines).toContain("SUMMARY:Meeting");
      expect(lines).toContain("END:VEVENT");
    });
  });

  describe("Todo", () => {
    it("should create a todo with Todo.make()", () => {
      const todo = Todo.make();

      expect(todo.component).toBe("VTODO");
    });

    it("should build a todo with pipe", () => {
      const todo = pipe(
        Todo.make(),
        Todo.withUid("todo123"),
        Todo.withSummary("Complete task"),
        Todo.withStatus("IN-PROCESS"),
        Todo.withPercent(50),
        Todo.withPriority(1),
      );

      expect(todo.uid).toBe("todo123");
      expect(todo.summary).toBe("Complete task");
      expect(todo.status).toBe("IN-PROCESS");
      expect(todo.percent).toBe(50);
      expect(todo.priority).toBe(1);
    });

    it("should encode a todo", async () => {
      const todo = pipe(
        Todo.make(),
        Todo.withUid("todo123"),
        Todo.withSummary("Task"),
        Todo.withPercent(75),
      );

      const lines = await runTest(Todo.encode(todo));

      expect(lines).toContain("BEGIN:VTODO");
      expect(lines).toContain("UID:todo123");
      expect(lines).toContain("SUMMARY:Task");
      expect(lines).toContain("PERCENT-COMPLETE:75");
      expect(lines).toContain("END:VTODO");
    });
  });

  describe("Integration", () => {
    it("should create and encode a complete calendar", async () => {
      const event = pipe(
        Event.make("20240115T100000Z"),
        Event.withUid("event-001"),
        Event.withSummary("Team Standup"),
        Event.withDtend("20240115T110000Z"),
        Event.withLocation("Conference Room A"),
        Event.withStatus("CONFIRMED"),
      );

      const todo = pipe(
        Todo.make(),
        Todo.withUid("todo-001"),
        Todo.withSummary("Complete proposal"),
        Todo.withDue("20240120T170000Z"),
        Todo.withStatus("IN-PROCESS"),
        Todo.withPercent(60),
      );

      const calendar = pipe(
        Calendar.builder(),
        Calendar.withProdid("-//My Company//My App//EN"),
        Calendar.withName("Work Calendar"),
        Calendar.withEvent(event),
        Calendar.withTodo(todo),
        Calendar.build,
      );

      const encoded = await runTest(Calendar.encode(calendar));

      expect(encoded).toContain("BEGIN:VCALENDAR");
      expect(encoded).toContain("PRODID:-//My Company//My App//EN");
      expect(encoded).toContain("NAME:Work Calendar");
      expect(encoded).toContain("BEGIN:VEVENT");
      expect(encoded).toContain("UID:event-001");
      expect(encoded).toContain("SUMMARY:Team Standup");
      expect(encoded).toContain("BEGIN:VTODO");
      expect(encoded).toContain("UID:todo-001");
      expect(encoded).toContain("SUMMARY:Complete proposal");
      expect(encoded).toContain("PERCENT-COMPLETE:60");
      expect(encoded).toContain("END:VCALENDAR");
    });
  });
});

describe("Event.encode and Todo.encode", () => {
  it("writes every set property of an event, in order", async () => {
    const event = pipe(
      Event.make("20240101T120000Z"),
      Event.withUid("e1"),
      Event.withDtend("20240101T130000Z"),
      Event.withDuration("PT1H"),
      Event.withSummary("Summary"),
      Event.withDescription("Description"),
      Event.withLocation("Room"),
      Event.withOrganizer("mailto:org@example.com"),
      Event.withAttendee("mailto:a@example.com"),
      Event.withCategories(["A", "B"]),
      Event.withStatus("CONFIRMED"),
      Event.withRrule("FREQ=DAILY"),
      Event.withUrl("https://example.com"),
      Event.withPriority(0),
      Event.withClassification("PUBLIC"),
    );
    const lines = await runTest(
      Event.encode(new Event.Event({ ...event, dtstamp: "20240101T000000Z" })),
    );
    expect(lines).toEqual([
      "BEGIN:VEVENT",
      "DTSTART:20240101T120000Z",
      "UID:e1",
      "DTSTAMP:20240101T000000Z",
      "DTEND:20240101T130000Z",
      "DURATION:PT1H",
      "SUMMARY:Summary",
      "DESCRIPTION:Description",
      "LOCATION:Room",
      "ORGANIZER:mailto:org@example.com",
      "ATTENDEE:mailto:a@example.com",
      "CATEGORIES:A,B",
      "STATUS:CONFIRMED",
      "RRULE:FREQ=DAILY",
      "URL:https://example.com",
      "PRIORITY:0",
      "CLASS:PUBLIC",
      "END:VEVENT",
    ]);
  });

  it("writes only DTSTART for a bare event", async () => {
    expect(await runTest(Event.encode(Event.make("20240101")))).toEqual([
      "BEGIN:VEVENT",
      "DTSTART:20240101",
      "END:VEVENT",
    ]);
  });

  it("writes every set property of a to-do, in order", async () => {
    const todo = pipe(
      Todo.make(),
      Todo.withUid("t1"),
      Todo.withDtstart("20240101"),
      Todo.withDue("20240102"),
      Todo.withSummary("Todo"),
      Todo.withDescription("Description"),
      Todo.withLocation("Desk"),
      Todo.withStatus("COMPLETED"),
      Todo.withPercent(100),
      Todo.withCompleted("20240102"),
      Todo.withPriority(1),
      Todo.withRrule("FREQ=WEEKLY"),
    );
    const lines = await runTest(
      Todo.encode(new Todo.Todo({ ...todo, dtstamp: "20240101T000000Z", duration: "P1D" })),
    );
    expect(lines).toEqual([
      "BEGIN:VTODO",
      "UID:t1",
      "DTSTAMP:20240101T000000Z",
      "DTSTART:20240101",
      "DUE:20240102",
      "DURATION:P1D",
      "SUMMARY:Todo",
      "DESCRIPTION:Description",
      "LOCATION:Desk",
      "STATUS:COMPLETED",
      "PERCENT-COMPLETE:100",
      "COMPLETED:20240102",
      "PRIORITY:1",
      "RRULE:FREQ=WEEKLY",
      "END:VTODO",
    ]);
  });

  it("writes nothing but the delimiters for a bare to-do", async () => {
    expect(await runTest(Todo.encode(Todo.make()))).toEqual(["BEGIN:VTODO", "END:VTODO"]);
  });
});

describe("setters return Schema class instances (#5)", () => {
  it("keeps every Event setter's result an Event", () => {
    const original = Event.make("20240101T120000Z");
    const event = pipe(
      original,
      Event.withUid("e1"),
      Event.withDtend("20240101T130000Z"),
      Event.withDuration("PT1H"),
      Event.withSummary("Summary"),
      Event.withDescription("Description"),
      Event.withLocation("Room"),
      Event.withOrganizer("mailto:org@example.com"),
      Event.withAttendee("mailto:a@example.com"),
      Event.withCategories(["A", "B"]),
      Event.withStatus("CONFIRMED"),
      Event.withRrule("FREQ=DAILY"),
      Event.withUrl("https://example.com"),
      Event.withPriority(0),
      Event.withClassification("PUBLIC"),
    );
    expect(event).toBeInstanceOf(Event.Event);
    expect(original).toEqual(Event.make("20240101T120000Z"));
    expect(Schema.encodeSync(Event.Event)(event)).toMatchObject({ uid: "e1", priority: 0 });
  });

  it("keeps every Todo setter's result a Todo", () => {
    const original = Todo.make();
    const todo = pipe(
      original,
      Todo.withUid("t1"),
      Todo.withDtstart("20240101"),
      Todo.withDue("20240102"),
      Todo.withSummary("Todo"),
      Todo.withDescription("Description"),
      Todo.withLocation("Desk"),
      Todo.withStatus("COMPLETED"),
      Todo.withPercent(100),
      Todo.withCompleted("20240102"),
      Todo.withPriority(1),
      Todo.withRrule("FREQ=WEEKLY"),
    );
    expect(todo).toBeInstanceOf(Todo.Todo);
    expect(original).toEqual(Todo.make());
    expect(Schema.encodeSync(Todo.Todo)(todo)).toMatchObject({ uid: "t1", percent: 100 });
  });

  it("keeps the calendar a Calendar through every builder setter", () => {
    const calendar = pipe(
      Calendar.builder(),
      Calendar.withProdid("-//Piped//EN"),
      Calendar.withName("Name"),
      Calendar.withDescription("Description"),
      Calendar.withCalscale("GREGORIAN"),
      Calendar.withMethod("REQUEST"),
      Calendar.withEvent(Event.make("20240101")),
      Calendar.withTodo(Todo.make()),
      Calendar.build,
    );
    expect(calendar).toBeInstanceOf(Calendar.Calendar);
    expect(calendar.events?.[0]).toBeInstanceOf(Event.Event);
    expect(calendar.todos?.[0]).toBeInstanceOf(Todo.Todo);
    expect(Schema.encodeSync(Calendar.Calendar)(calendar)).toMatchObject({
      prodid: "-//Piped//EN",
      events: [{ component: "VEVENT", dtstart: "20240101" }],
    });
  });
});
