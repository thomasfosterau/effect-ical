/**
 * Basic example of parsing and encoding iCalendar files
 */

import { parseEither, encodeSync } from "../src/index.js";
import type { VCalendar, VEvent } from "../src/types.js";

console.log("=== Example 1: Creating a simple event ===\n");

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
console.log("Encoded iCalendar:");
console.log(icalString);

console.log("\n=== Example 2: Parsing an iCalendar string ===\n");

// Parse the iCal string back
const parseResult = parseEither(icalString);

if (parseResult._tag === "Right") {
  const parsed = parseResult.right;
  console.log("Successfully parsed calendar!");
  console.log(`Product ID: ${parsed.prodid}`);
  console.log(`Version: ${parsed.version}`);
  console.log(`Number of events: ${parsed.events?.length || 0}`);
  
  if (parsed.events && parsed.events.length > 0) {
    const event = parsed.events[0];
    console.log(`\nFirst event:`);
    console.log(`  UID: ${event.uid}`);
    console.log(`  Summary: ${event.summary}`);
    console.log(`  Start: ${event.dtstart}`);
    console.log(`  Location: ${event.location}`);
  }
} else {
  console.error("Failed to parse:", parseResult.left.message);
}

console.log("\n=== Example 3: Creating an event with an alarm ===\n");

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
console.log("Event with alarms:");
console.log(icalWithAlarm);

console.log("\n=== Example 4: Creating a todo list ===\n");

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
console.log("Todo list:");
console.log(todoIcal);

console.log("\n=== Example 5: Round-trip conversion ===\n");

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
console.log("Original calendar encoded to:");
console.log(encoded.substring(0, 200) + "...\n");

// Parse back
const decoded = parseEither(encoded);
if (decoded._tag === "Right") {
  console.log("Round-trip successful!");
  console.log("Verification:");
  console.log(`  Name preserved: ${decoded.right.name === originalCal.name}`);
  console.log(`  Description preserved: ${decoded.right.description === originalCal.description}`);
  console.log(`  Event UID preserved: ${decoded.right.events?.[0]?.uid === originalCal.events?.[0]?.uid}`);
  console.log(`  Event summary preserved: ${decoded.right.events?.[0]?.summary === originalCal.events?.[0]?.summary}`);
}
