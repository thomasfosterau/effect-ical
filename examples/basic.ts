/**
 * The plain object model: encode a `VCalendar` with `encodeSync`, parse text
 * back with `parse`, and round-trip a calendar.
 *
 * `tests/examples.test.ts` runs it (with `vp run test:unit`), so it is proved
 * to run against the current API.
 */

import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { encodeSync, parse } from "../src/index.js";
import type { VCalendar, VEvent } from "../src/index.js";

/** Runs this example, logging through the `Console` service. */
export const main = Effect.fn("examples/basic")(function* () {
  yield* Console.log("=== Example 1: Creating a simple event ===\n");

  // Create a simple calendar with an event
  const calendar: VCalendar = {
    component: "VCALENDAR",
    version: "2.0",
    prodid: "-//Example Corp//Example App//EN",
    calscale: "GREGORIAN",
    events: [
      {
        component: "VEVENT",
        uid: "event-001@example.com",
        dtstamp: "20240101T000000Z",
        dtstart: "20240115T100000Z",
        dtend: "20240115T110000Z",
        summary: "Team Standup",
        description: "Daily team standup meeting",
        location: "Conference Room A",
        status: "CONFIRMED",
      },
    ],
  };

  // Encode to iCal format
  const icalString = encodeSync(calendar);
  yield* Console.log("Encoded iCalendar:");
  yield* Console.log(icalString);

  yield* Console.log("\n=== Example 2: Parsing an iCalendar string ===\n");

  // Parse the iCal string back
  const parsed = yield* parse(icalString);
  yield* Console.log("Successfully parsed calendar!");
  yield* Console.log(`Product ID: ${parsed.prodid}`);
  yield* Console.log(`Version: ${parsed.version}`);
  yield* Console.log(`Number of events: ${parsed.events?.length ?? 0}`);

  const [first] = parsed.events ?? [];
  if (first) {
    yield* Console.log(`\nFirst event:`);
    yield* Console.log(`  UID: ${first.uid}`);
    yield* Console.log(`  Summary: ${first.summary}`);
    yield* Console.log(`  Start: ${first.dtstart}`);
    yield* Console.log(`  Location: ${first.location}`);
  }

  yield* Console.log("\n=== Example 3: Creating an event with an alarm ===\n");

  const eventWithAlarm: VEvent = {
    component: "VEVENT",
    uid: "event-002@example.com",
    dtstamp: "20240101T000000Z",
    dtstart: "20240120T143000Z",
    dtend: "20240120T153000Z",
    summary: "Doctor Appointment",
    location: "City Medical Center",
    description: "Annual checkup",
    status: "CONFIRMED",
    alarms: [
      {
        component: "VALARM",
        action: "DISPLAY",
        trigger: "-PT15M", // 15 minutes before
        description: "Reminder: Doctor appointment in 15 minutes",
      },
      {
        component: "VALARM",
        action: "DISPLAY",
        trigger: "-P1D", // 1 day before
        description: "Reminder: Doctor appointment tomorrow",
      },
    ],
  };

  const calendarWithAlarm: VCalendar = {
    component: "VCALENDAR",
    version: "2.0",
    prodid: "-//Example Corp//Example App//EN",
    events: [eventWithAlarm],
  };

  const icalWithAlarm = encodeSync(calendarWithAlarm);
  yield* Console.log("Event with alarms:");
  yield* Console.log(icalWithAlarm);

  yield* Console.log("\n=== Example 4: Creating a todo list ===\n");

  const todoCalendar: VCalendar = {
    component: "VCALENDAR",
    version: "2.0",
    prodid: "-//Example Corp//Example App//EN",
    todos: [
      {
        component: "VTODO",
        uid: "todo-001@example.com",
        dtstamp: "20240101T000000Z",
        dtstart: "20240110T090000Z",
        due: "20240115T170000Z",
        summary: "Complete project proposal",
        description: "Draft and submit Q1 project proposal",
        status: "IN-PROCESS",
        percent: 60,
        priority: 1,
      },
      {
        component: "VTODO",
        uid: "todo-002@example.com",
        dtstamp: "20240101T000000Z",
        due: "20240112T170000Z",
        summary: "Review pull requests",
        status: "NEEDS-ACTION",
        priority: 2,
      },
    ],
  };

  const todoIcal = encodeSync(todoCalendar);
  yield* Console.log("Todo list:");
  yield* Console.log(todoIcal);

  yield* Console.log("\n=== Example 5: Round-trip conversion ===\n");

  const originalCal: VCalendar = {
    component: "VCALENDAR",
    version: "2.0",
    prodid: "-//Example Corp//Example App//EN",
    name: "My Calendar",
    description: "Personal calendar",
    events: [
      {
        component: "VEVENT",
        uid: "unique-123",
        dtstart: "20240201T120000Z",
        dtend: "20240201T130000Z",
        summary: "Lunch Meeting",
        categories: ["Work", "Meeting"],
        priority: 5,
      },
    ],
  };

  // Encode
  const encoded = encodeSync(originalCal);
  yield* Console.log("Original calendar encoded to:");
  yield* Console.log(encoded.substring(0, 200) + "...\n");

  // Parse back
  const decoded = yield* parse(encoded);
  yield* Console.log("Round-trip successful!");
  yield* Console.log("Verification:");
  yield* Console.log(`  Name preserved: ${decoded.name === originalCal.name}`);
  yield* Console.log(`  Description preserved: ${decoded.description === originalCal.description}`);
  yield* Console.log(
    `  Event UID preserved: ${decoded.events?.[0]?.uid === originalCal.events?.[0]?.uid}`,
  );
  yield* Console.log(
    `  Event summary preserved: ${decoded.events?.[0]?.summary === originalCal.events?.[0]?.summary}`,
  );
});
