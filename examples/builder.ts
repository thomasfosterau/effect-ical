/**
 * The fluent builder API: `createCalendar`, `createEvent` and `createTodo`.
 *
 * `tests/examples.test.ts` runs it (with `vp run test:unit`), so it is proved
 * to run against the current API.
 */

import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { createCalendar, createEvent, createTodo } from "../src/index.js";

/** Runs this example, logging through the `Console` service. */
export const main = Effect.fn("examples/builder")(function* () {
  yield* Console.log("=== Example 1: Creating a calendar with events using builder ===\n");

  const calendar1 = createCalendar("-//My Company//My App//EN")
    .name("Work Calendar")
    .description("My work schedule")
    .calscale("GREGORIAN")
    .event((e) =>
      e
        .uid("meeting-001")
        .dtstart("20240115T100000Z")
        .dtend("20240115T110000Z")
        .summary("Team Standup")
        .description("Daily team sync")
        .location("Conference Room A")
        .status("CONFIRMED")
        .priority(5)
        .addDisplayAlarm("-PT15M", "Meeting starts in 15 minutes"),
    )
    .event((e) =>
      e
        .uid("meeting-002")
        .dtstart("20240115T140000Z")
        .dtend("20240115T150000Z")
        .summary("Code Review")
        .location("Online")
        .status("TENTATIVE")
        .addAttendee("mailto:alice@example.com")
        .addAttendee("mailto:bob@example.com"),
    )
    .build();

  yield* Console.log("Calendar created:");
  yield* Console.log(`- Name: ${calendar1.name}`);
  yield* Console.log(`- Events: ${calendar1.events?.length}`);
  yield* Console.log(
    `- Event 1: ${calendar1.events?.[0]?.summary} at ${calendar1.events?.[0]?.dtstart}`,
  );
  yield* Console.log(
    `- Event 2: ${calendar1.events?.[1]?.summary} at ${calendar1.events?.[1]?.dtstart}`,
  );

  yield* Console.log("\n=== Example 2: Creating a calendar with todos ===\n");

  const calendar2 = createCalendar("-//My Company//My App//EN")
    .name("Task List")
    .todo((t) =>
      t
        .uid("task-001")
        .summary("Complete project proposal")
        .description("Draft Q1 project proposal and get approval")
        .dtstart("20240110T090000Z")
        .due("20240115T170000Z")
        .status("IN-PROCESS")
        .percentComplete(60)
        .priority(1),
    )
    .todo((t) =>
      t
        .uid("task-002")
        .summary("Review pull requests")
        .due("20240112T170000Z")
        .status("NEEDS-ACTION")
        .priority(2),
    )
    .build();

  yield* Console.log("Task list created:");
  yield* Console.log(`- Name: ${calendar2.name}`);
  yield* Console.log(`- Todos: ${calendar2.todos?.length}`);
  yield* Console.log(
    `- Task 1: ${calendar2.todos?.[0]?.summary} (${calendar2.todos?.[0]?.percent}% complete)`,
  );
  yield* Console.log(`- Task 2: ${calendar2.todos?.[1]?.summary}`);

  yield* Console.log("\n=== Example 3: Creating and encoding to iCal format ===\n");

  const icalString = createCalendar("-//My Company//My App//EN")
    .name("My Calendar")
    .event((e) =>
      e
        .uid("event-123")
        .dtstart("20240201T120000Z")
        .dtend("20240201T130000Z")
        .summary("Lunch Meeting")
        .location("Downtown Restaurant")
        .organizer("mailto:organizer@example.com")
        .categories(["Work", "Meeting"]),
    )
    .toICalString();

  yield* Console.log("Generated iCal string:");
  yield* Console.log(icalString);

  yield* Console.log("\n=== Example 4: Complex calendar with multiple components ===\n");

  const complexCalendar = createCalendar("-//Organization//Calendar System//EN")
    .name("Complete Calendar")
    .description("Calendar with events, tasks, and reminders")
    .method("PUBLISH")
    .event((e) =>
      e
        .uid("event-recurring")
        .dtstart("20240115T100000Z")
        .duration("PT1H")
        .summary("Weekly Team Meeting")
        .rrule("FREQ=WEEKLY;BYDAY=MO")
        .status("CONFIRMED")
        .addDisplayAlarm("-PT30M", "Meeting in 30 minutes"),
    )
    .event((e) =>
      e
        .uid("event-conference")
        .dtstart("20240220T090000Z")
        .dtend("20240220T170000Z")
        .summary("Tech Conference")
        .location("Convention Center")
        .classification("PUBLIC")
        .url("https://techconf.example.com")
        .geo(40.7128, -74.006),
    )
    .todo((t) =>
      t
        .uid("todo-urgent")
        .summary("Fix critical bug")
        .description("Production issue in payment system")
        .due("20240116T170000Z")
        .status("IN-PROCESS")
        .percentComplete(75)
        .priority(1)
        .addAlarm({
          component: "VALARM",
          action: "DISPLAY",
          trigger: "-PT2H",
          description: "Bug fix due in 2 hours!",
        }),
    )
    .todo((t) =>
      t.uid("todo-routine").summary("Update documentation").status("NEEDS-ACTION").priority(5),
    )
    .build();

  yield* Console.log("Complex calendar created:");
  yield* Console.log(`- Name: ${complexCalendar.name}`);
  yield* Console.log(`- Description: ${complexCalendar.description}`);
  yield* Console.log(`- Method: ${complexCalendar.method}`);
  yield* Console.log(`- Events: ${complexCalendar.events?.length}`);
  yield* Console.log(`- Todos: ${complexCalendar.todos?.length}`);

  yield* Console.log("\n=== Example 5: Using standalone builders ===\n");

  // Create an event independently
  const standaloneEvent = createEvent()
    .uid("standalone-event")
    .dtstart("20240301T140000Z")
    .dtend("20240301T150000Z")
    .summary("Client Presentation")
    .description("Quarterly review with client")
    .location("Client Office")
    .status("CONFIRMED")
    .organizer("mailto:manager@example.com")
    .attendees([
      "mailto:client@example.com",
      "mailto:team1@example.com",
      "mailto:team2@example.com",
    ])
    .build();

  // Create a todo independently
  const standaloneTodo = createTodo()
    .uid("standalone-todo")
    .summary("Prepare presentation slides")
    .due("20240228T170000Z")
    .status("NEEDS-ACTION")
    .priority(2)
    .build();

  // Add them to a calendar
  const calendar5 = createCalendar("-//My Company//My App//EN")
    .name("Client Meeting Calendar")
    .addEvent(standaloneEvent)
    .addTodo(standaloneTodo)
    .build();

  yield* Console.log("Calendar with standalone components:");
  yield* Console.log(`- Event: ${calendar5.events?.[0]?.summary}`);
  yield* Console.log(`- Todo: ${calendar5.todos?.[0]?.summary}`);

  yield* Console.log("\n=== Example 6: Method chaining for clean code ===\n");

  const chainedCalendar = createCalendar("-//My App//EN")
    .name("My Schedule")
    .event((e) => e.dtstart("20240115T090000Z").summary("Morning Meeting"))
    .event((e) => e.dtstart("20240115T140000Z").summary("Afternoon Session"))
    .event((e) => e.dtstart("20240116T100000Z").summary("Follow-up Call"))
    .todo((t) => t.summary("Prepare agenda").priority(1))
    .todo((t) => t.summary("Send minutes").priority(2))
    .toICalString();

  yield* Console.log("Generated compact calendar with chaining:");
  yield* Console.log(chainedCalendar.substring(0, 300) + "...\n");

  yield* Console.log("✨ Builder API provides a clean, fluent interface for creating calendars!");
});
