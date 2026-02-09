/**
 * Example demonstrating the Effect-style API
 */

import { Effect, pipe } from "effect";
import * as Calendar from "../src/Calendar.js";
import * as Event from "../src/Event.js";
import * as Todo from "../src/Todo.js";

console.log("=== Example 1: Creating a calendar with Calendar.make() ===\n");

const simpleCalendar = Calendar.make("-//My Company//My App//EN");
console.log("Simple calendar created:");
console.log(`- Component: ${simpleCalendar.component}`);
console.log(`- Version: ${simpleCalendar.version}`);
console.log(`- PRODID: ${simpleCalendar.prodid}`);

console.log("\n=== Example 2: Building a calendar with pipe ===\n");

const calendar = pipe(
  Calendar.builder(),
  Calendar.withProdid("-//My Company//My App//EN"),
  Calendar.withName("Work Calendar"),
  Calendar.withDescription("My work schedule"),
  Calendar.withCalscale("GREGORIAN"),
  Calendar.build
);

console.log("Built calendar:");
console.log(`- Name: ${calendar.name}`);
console.log(`- Description: ${calendar.description}`);

console.log("\n=== Example 3: Creating events with pipe ===\n");

const event = pipe(
  Event.make("20240115T100000Z"),
  Event.withUid("event-001"),
  Event.withSummary("Team Standup"),
  Event.withDescription("Daily team sync"),
  Event.withDtend("20240115T110000Z"),
  Event.withLocation("Conference Room A"),
  Event.withStatus("CONFIRMED"),
  Event.withPriority(5)
);

console.log("Event created:");
console.log(`- UID: ${event.uid}`);
console.log(`- Summary: ${event.summary}`);
console.log(`- Start: ${event.dtstart}`);
console.log(`- End: ${event.dtend}`);
console.log(`- Status: ${event.status}`);

console.log("\n=== Example 4: Creating todos with pipe ===\n");

const todo = pipe(
  Todo.make(),
  Todo.withUid("todo-001"),
  Todo.withSummary("Complete project proposal"),
  Todo.withDescription("Draft Q1 project proposal and get approval"),
  Todo.withDue("20240120T170000Z"),
  Todo.withStatus("IN-PROCESS"),
  Todo.withPercent(60),
  Todo.withPriority(1)
);

console.log("Todo created:");
console.log(`- UID: ${todo.uid}`);
console.log(`- Summary: ${todo.summary}`);
console.log(`- Due: ${todo.due}`);
console.log(`- Status: ${todo.status}`);
console.log(`- Complete: ${todo.percent}%`);

console.log("\n=== Example 5: Complete calendar with events and todos ===\n");

const event1 = pipe(
  Event.make("20240115T100000Z"),
  Event.withUid("event-001"),
  Event.withSummary("Team Standup"),
  Event.withDtend("20240115T110000Z"),
  Event.withLocation("Office"),
  Event.withStatus("CONFIRMED")
);

const event2 = pipe(
  Event.make("20240115T140000Z"),
  Event.withUid("event-002"),
  Event.withSummary("Client Call"),
  Event.withDtend("20240115T150000Z"),
  Event.withStatus("TENTATIVE"),
  Event.withAttendee("mailto:client@example.com")
);

const todo1 = pipe(
  Todo.make(),
  Todo.withUid("todo-001"),
  Todo.withSummary("Prepare presentation"),
  Todo.withDue("20240116T170000Z"),
  Todo.withStatus("NEEDS-ACTION"),
  Todo.withPriority(1)
);

const completeCalendar = pipe(
  Calendar.builder(),
  Calendar.withProdid("-//My Company//My App//EN"),
  Calendar.withName("Complete Calendar"),
  Calendar.withDescription("Calendar with events and tasks"),
  Calendar.withEvent(event1),
  Calendar.withEvent(event2),
  Calendar.withTodo(todo1),
  Calendar.build
);

console.log("Complete calendar built:");
console.log(`- Name: ${completeCalendar.name}`);
console.log(`- Events: ${completeCalendar.events?.length}`);
console.log(`- Todos: ${completeCalendar.todos?.length}`);

console.log("\n=== Example 6: Encoding calendar to iCal format ===\n");

const program = Calendar.encode(completeCalendar);

Effect.runPromise(program).then((icalString) => {
  console.log("Encoded iCal string:");
  console.log(icalString);
});

console.log("\n=== Example 7: Using Effect for error handling ===\n");

const safeProgram = pipe(
  Calendar.encode(completeCalendar),
  Effect.catchAll((error) =>
    Effect.succeed(`Error encoding calendar: ${(error as Error).message}`)
  )
);

Effect.runPromise(safeProgram).then((result) => {
  console.log("Safe encoding result:");
  console.log(result.substring(0, 200) + "...");
});

console.log("\n✨ Effect-style API provides composable, type-safe calendar operations!");
