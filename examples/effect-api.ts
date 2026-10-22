/**
 * The pipeable `Calendar`, `Event` and `Todo` modules.
 *
 * `tests/examples.test.ts` runs it (with `vp run test:unit`), so it is proved
 * to run against the current API.
 */

import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { Calendar, Event, Todo, parse } from "../src/index.js";

/** Runs this example, logging through the `Console` service. */
export const main = Effect.fn("examples/effect-api")(function* () {
  yield* Console.log("=== Example 1: Creating a calendar with Calendar.make() ===\n");

  const simpleCalendar = Calendar.make("-//My Company//My App//EN");
  yield* Console.log("Simple calendar created:");
  yield* Console.log(`- Component: ${simpleCalendar.component}`);
  yield* Console.log(`- Version: ${simpleCalendar.version}`);
  yield* Console.log(`- PRODID: ${simpleCalendar.prodid}`);

  yield* Console.log("\n=== Example 2: Building a calendar with pipe ===\n");

  const calendar = pipe(
    Calendar.builder(),
    Calendar.withProdid("-//My Company//My App//EN"),
    Calendar.withName("Work Calendar"),
    Calendar.withDescription("My work schedule"),
    Calendar.withCalscale("GREGORIAN"),
    Calendar.build,
  );

  yield* Console.log("Built calendar:");
  yield* Console.log(`- Name: ${calendar.name}`);
  yield* Console.log(`- Description: ${calendar.description}`);

  yield* Console.log("\n=== Example 3: Creating events with pipe ===\n");

  const event = pipe(
    Event.make("20240115T100000Z"),
    Event.withUid("event-001"),
    Event.withSummary("Team Standup"),
    Event.withDescription("Daily team sync"),
    Event.withDtend("20240115T110000Z"),
    Event.withLocation("Conference Room A"),
    Event.withStatus("CONFIRMED"),
    Event.withPriority(5),
  );

  yield* Console.log("Event created:");
  yield* Console.log(`- UID: ${event.uid}`);
  yield* Console.log(`- Summary: ${event.summary}`);
  yield* Console.log(`- Start: ${event.dtstart}`);
  yield* Console.log(`- End: ${event.dtend}`);
  yield* Console.log(`- Status: ${event.status}`);

  yield* Console.log("\n=== Example 4: Creating todos with pipe ===\n");

  const todo = pipe(
    Todo.make(),
    Todo.withUid("todo-001"),
    Todo.withSummary("Complete project proposal"),
    Todo.withDescription("Draft Q1 project proposal and get approval"),
    Todo.withDue("20240120T170000Z"),
    Todo.withStatus("IN-PROCESS"),
    Todo.withPercent(60),
    Todo.withPriority(1),
  );

  yield* Console.log("Todo created:");
  yield* Console.log(`- UID: ${todo.uid}`);
  yield* Console.log(`- Summary: ${todo.summary}`);
  yield* Console.log(`- Due: ${todo.due}`);
  yield* Console.log(`- Status: ${todo.status}`);
  yield* Console.log(`- Complete: ${todo.percent}%`);

  yield* Console.log("\n=== Example 5: Complete calendar with events and todos ===\n");

  const event1 = pipe(
    Event.make("20240115T100000Z"),
    Event.withUid("event-001"),
    Event.withSummary("Team Standup"),
    Event.withDtend("20240115T110000Z"),
    Event.withLocation("Office"),
    Event.withStatus("CONFIRMED"),
  );

  const event2 = pipe(
    Event.make("20240115T140000Z"),
    Event.withUid("event-002"),
    Event.withSummary("Client Call"),
    Event.withDtend("20240115T150000Z"),
    Event.withStatus("TENTATIVE"),
    Event.withAttendee("mailto:client@example.com"),
  );

  const todo1 = pipe(
    Todo.make(),
    Todo.withUid("todo-001"),
    Todo.withSummary("Prepare presentation"),
    Todo.withDue("20240116T170000Z"),
    Todo.withStatus("NEEDS-ACTION"),
    Todo.withPriority(1),
  );

  const completeCalendar = pipe(
    Calendar.builder(),
    Calendar.withProdid("-//My Company//My App//EN"),
    Calendar.withName("Complete Calendar"),
    Calendar.withDescription("Calendar with events and tasks"),
    Calendar.withEvent(event1),
    Calendar.withEvent(event2),
    Calendar.withTodo(todo1),
    Calendar.build,
  );

  yield* Console.log("Complete calendar built:");
  yield* Console.log(`- Name: ${completeCalendar.name}`);
  yield* Console.log(`- Events: ${completeCalendar.events?.length}`);
  yield* Console.log(`- Todos: ${completeCalendar.todos?.length}`);

  yield* Console.log("\n=== Example 6: Encoding calendar to iCal format ===\n");

  const icalString = yield* Calendar.encode(completeCalendar);
  yield* Console.log("Encoded iCal string:");
  yield* Console.log(icalString);

  yield* Console.log("\n=== Example 7: Using Effect for error handling ===\n");

  // `parse` fails with a tagged `ParseError`, which `Effect.catchTag` handles.
  const result = yield* pipe(
    parse("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n"),
    Effect.map((parsed) => `Parsed ${parsed.prodid}`),
    Effect.catchTag("ParseError", (error) => Effect.succeed(`Could not parse: ${error.message}`)),
  );
  yield* Console.log(result);

  yield* Console.log("\n✨ Effect-style API provides composable, type-safe calendar operations!");
});
