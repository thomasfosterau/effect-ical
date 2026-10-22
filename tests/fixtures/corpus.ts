/**
 * Characterisation corpus: inputs covering every documented behaviour of the
 * parser, the encoder, the fluent builders and the pipeable `Calendar` /
 * `Event` / `Todo` modules, including the edge cases (malformed lines,
 * unclosed components, numeric coercion, line folding of multi-byte text).
 *
 * `corpus.golden.json` holds what the implementation produced for every
 * input here before the Effect 4 / lint-plugin migration, generated from the
 * Effect 3 sources; `tests/characterisation.test.ts` asserts the current
 * implementation still produces exactly that. Add a case here only together
 * with its golden output, and never regenerate the golden file to make a
 * behaviour change pass.
 *
 * One deliberate change is recorded in the golden file by hand: the Effect 3
 * `Calendar.decode` failed with a bare `Error` (tag `"Error"`); it now fails
 * with the tagged `ParseError`, with the same messages.
 *
 * The only seam is how an Effect is run (`Run`); the golden file was produced
 * by running this corpus against the Effect 3 sources.
 *
 * @module
 */

import type * as Effect from "effect/Effect";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import {
  BuildError,
  Calendar,
  Event,
  Todo,
  createCalendar,
  createEvent,
  createTodo,
  encode,
  parse,
} from "../../src/index.js";
import type { VCalendar, VEvent, VTodo } from "../../src/index.js";

/** Calendar texts fed to the parser (and to `Calendar.decode`). */
export const parseInputs: Readonly<Record<string, string>> = {
  simple: "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//Test//EN\nEND:VCALENDAR\n",
  crlf: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART:20240101T120000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n",
  folded:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:VEVENT\nUID:e\nDTSTART:20240101T120000Z\nSUMMARY:This is a very long summary that has been folded according to RFC 5\n 545 line folding rules\nDESCRIPTION:tab\n\tcontinued\nEND:VEVENT\nEND:VCALENDAR\n",
  everyComponent: [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Test//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "NAME:Work",
    "DESCRIPTION:Work calendar",
    "X-WR-CALNAME:Custom",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/London",
    "LAST-MODIFIED:20240101T000000Z",
    "TZURL:http://tz.example/london",
    "BEGIN:STANDARD",
    "DTSTART:19701025T020000",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0000",
    "TZNAME:GMT",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700329T010000",
    "TZOFFSETFROM:+0000",
    "TZOFFSETTO:+0100",
    "TZNAME:BST",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    "UID:event1",
    "DTSTAMP:20240101T000000Z",
    "DTSTART;TZID=Europe/London:20240101T120000",
    "DTEND:20240101T130000Z",
    "SUMMARY:Event\\, escaped",
    'ATTENDEE;CN="Doe, John";ROLE=REQ-PARTICIPANT:mailto:john@example.com',
    "ATTENDEE:mailto:jane@example.com",
    "CATEGORIES:WORK,MEETING",
    "CATEGORIES:EXTRA",
    "RDATE:20240201T120000Z",
    "EXDATE:20240301T120000Z",
    "EXDATE:20240401T120000Z",
    "PRIORITY:5",
    "SEQUENCE:2",
    "GEO:37.386013;-122.082932",
    "STATUS:CONFIRMED",
    "CLASS:PRIVATE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT15M",
    "REPEAT:3",
    "DURATION:PT5M",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:AUDIO",
    "TRIGGER:-PT5M",
    "END:VALARM",
    "END:VEVENT",
    "BEGIN:VTODO",
    "UID:todo1",
    "PERCENT-COMPLETE:40",
    "PRIORITY:high",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VTODO",
    "BEGIN:VJOURNAL",
    "UID:journal1",
    "SUMMARY:Notes",
    "END:VJOURNAL",
    "BEGIN:VFREEBUSY",
    "UID:fb1",
    "DTSTART:20240101T000000Z",
    "DTEND:20240102T000000Z",
    "FREEBUSY;FBTYPE=BUSY:20240101T090000Z/20240101T100000Z",
    "END:VFREEBUSY",
    "BEGIN:X-CUSTOM",
    "FOO:bar",
    "END:X-CUSTOM",
    "END:VCALENDAR",
    "",
  ].join("\n"),
  lowercaseNames:
    "begin:VCALENDAR\nversion:2.0\nprodid:-//Test//EN\nbegin:VEVENT\nsummary:lower\ndtstart:20240101\nend:VEVENT\nend:VCALENDAR\n",
  junkAround:
    "garbage line\nX-BEFORE:1\nBEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nEND:VCALENDAR\nmore garbage\n",
  noCalendar: "BEGIN:VEVENT\nDTSTART:20240101\nEND:VEVENT\n",
  empty: "",
  missingVersion: "BEGIN:VCALENDAR\nPRODID:-//Test//EN\nEND:VCALENDAR\n",
  wrongVersion: "BEGIN:VCALENDAR\nVERSION:1.0\nPRODID:-//Test//EN\nEND:VCALENDAR\n",
  missingProdid: "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n",
  invalidLineInCalendar:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nnot a content line\nEND:VCALENDAR\n",
  invalidLineInEvent:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:VEVENT\nDTSTART:20240101\nbroken\nEND:VEVENT\nEND:VCALENDAR\n",
  invalidLineInAlarm:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:VEVENT\nDTSTART:20240101\nBEGIN:VALARM\nACTION:DISPLAY\nbroken\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR\n",
  unclosedEvent:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:VEVENT\nSUMMARY:leaks\nDTSTART:20240101\nEND:VCALENDAR\n",
  unclosedCalendar: "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\n",
  mismatchedEnd:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:VEVENT\nDTSTART:20240101\nEND:VCALENDAR\nEND:VEVENT\nEND:VCALENDAR\n",
  unclosedEventThenInvalid:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:VEVENT\nDTSTART:20240101\nEND:VCALENDAR\nbroken\n",
  leadingContinuation: " orphan\nBEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nEND:VCALENDAR\n",
  whitespaceOnlyLine: "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test\n \n//EN\nEND:VCALENDAR\n",
  duplicateProperty:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//First//EN\nPRODID:-//Second//EN\nBEGIN:VEVENT\nDTSTART:1\nDTSTART:2\nSUMMARY:a\nSUMMARY:b\nEND:VEVENT\nEND:VCALENDAR\n",
  oddParameters:
    'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:VEVENT\nDTSTART;VALUE;X="q";Y="unterminated:20240101\nURL:https://example.com/a:b\nEND:VEVENT\nEND:VCALENDAR\n',
  emptyBegin: "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:\nEND:\nEND:VCALENDAR\n",
  descriptionAfterEvent:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:VEVENT\nDTSTART:20240101\nDESCRIPTION:event description\nEND:VEVENT\nDESCRIPTION:calendar description\nEND:VCALENDAR\n",
  nestedCalendar:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Outer//EN\nBEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Inner//EN\nEND:VCALENDAR\nEND:VCALENDAR\n",
  calendarValuesWithColons:
    "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:urn:example:prodid\nMETHOD:REQUEST\nEND:VCALENDAR\n",
};

/** `calendar` with a required field unset at runtime, as a caller that bypassed the types (plain JS, a JSON payload) could pass it. */
const erase = (calendar: VCalendar, field: "version" | "prodid"): VCalendar =>
  Object.assign({ ...calendar }, { [field]: undefined });

const longText =
  "This is a very long summary that should be folded according to RFC 5545 line folding rules to ensure proper formatting";
const multiByteText = "Café ☕ réunion — 東京 meeting with 🎉 emoji and ümlauts ".repeat(4);

/** Calendar values fed to the encoder. */
export const encodeInputs: Readonly<Record<string, VCalendar>> = {
  minimal: { component: "VCALENDAR", version: "2.0", prodid: "-//Test//EN" },
  // Deliberately invalid input, to exercise the encoder's own required-property
  // checks for callers that bypass the types.
  missingVersion: erase(
    { component: "VCALENDAR", version: "2.0", prodid: "-//Test//EN" },
    "version",
  ),
  missingProdid: erase({ component: "VCALENDAR", version: "2.0", prodid: "-//Test//EN" }, "prodid"),
  emptyProdid: { component: "VCALENDAR", version: "2.0", prodid: "" },
  everything: {
    component: "VCALENDAR",
    version: "2.0",
    prodid: "-//Test//EN",
    calscale: "GREGORIAN",
    method: "PUBLISH",
    name: "Name; with, specials\\",
    description: "Line one\nLine two",
    timezones: [
      {
        component: "VTIMEZONE",
        tzid: "Europe/London",
        lastmod: "20240101T000000Z",
        tzurl: "http://tz.example/london",
        standard: [
          {
            dtstart: "19701025T020000",
            tzoffsetfrom: "+0100",
            tzoffsetto: "+0000",
            rrule: "FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
            tzname: "GMT",
          },
        ],
        daylight: [{ dtstart: "19700329T010000", tzoffsetfrom: "+0000", tzoffsetto: "+0100" }],
      },
      { component: "VTIMEZONE", tzid: "UTC" },
    ],
    events: [
      {
        component: "VEVENT",
        uid: "event1",
        dtstamp: "20240101T000000Z",
        dtstart: "20240101T120000Z",
        dtend: "20240101T130000Z",
        duration: "PT1H",
        summary: "Summary; with, specials",
        description: "Description\nwith newline",
        location: "Room, 1",
        organizer: "mailto:org@example.com",
        attendee: ["mailto:a@example.com", "mailto:b@example.com"],
        categories: ["WORK", "MEETING"],
        status: "CONFIRMED",
        rrule: "FREQ=WEEKLY;COUNT=4",
        rdate: ["20240201T120000Z"],
        exdate: ["20240301T120000Z", "20240401T120000Z"],
        url: "https://example.com/event",
        geo: { lat: 37.386013, lon: -122.082932 },
        priority: 0,
        class: "PUBLIC",
        alarms: [
          {
            component: "VALARM",
            action: "EMAIL",
            trigger: "-PT15M",
            duration: "PT5M",
            repeat: 0,
            description: "Alarm; description",
            summary: "Alarm, summary",
            attendee: ["mailto:a@example.com"],
            attach: "https://example.com/sound.wav",
          },
        ],
      },
      { component: "VEVENT", dtstart: "20240102", summary: "", uid: "" },
      { component: "VEVENT", dtstart: "20240103", summary: longText },
      { component: "VEVENT", dtstart: "20240104", description: multiByteText },
    ],
    todos: [
      {
        component: "VTODO",
        uid: "todo1",
        dtstamp: "20240101T000000Z",
        dtstart: "20240101T090000Z",
        due: "20240105T170000Z",
        duration: "P1D",
        summary: "Todo; summary",
        description: "Todo, description",
        location: "Desk",
        status: "IN-PROCESS",
        percent: 0,
        completed: "20240104T170000Z",
        priority: 9,
        rrule: "FREQ=DAILY",
        alarms: [{ component: "VALARM", action: "DISPLAY", trigger: "-PT1H" }],
      },
      { component: "VTODO" },
    ],
    journals: [
      {
        component: "VJOURNAL",
        uid: "journal1",
        dtstamp: "20240101T000000Z",
        dtstart: "20240101",
        summary: "Journal; summary",
        description: "Journal, description",
        status: "FINAL",
        class: "CONFIDENTIAL",
      },
      { component: "VJOURNAL" },
    ],
    freebusys: [
      {
        component: "VFREEBUSY",
        uid: "fb1",
        dtstamp: "20240101T000000Z",
        dtstart: "20240101T000000Z",
        dtend: "20240102T000000Z",
        organizer: "mailto:org@example.com",
        url: "https://example.com/fb",
        attendee: ["mailto:a@example.com"],
        freebusy: [
          {
            type: "BUSY",
            periods: [
              { start: "20240101T090000Z", end: "20240101T100000Z" },
              { start: "20240101T110000Z", end: "20240101T120000Z" },
            ],
          },
          { periods: [{ start: "20240101T130000Z", end: "PT1H" }] },
        ],
      },
      { component: "VFREEBUSY", dtstart: "20240101", dtend: "20240102" },
    ],
  },
  exactly75: { component: "VCALENDAR", version: "2.0", prodid: "X".repeat(68) },
  exactly76: { component: "VCALENDAR", version: "2.0", prodid: "X".repeat(69) },
  veryLong: { component: "VCALENDAR", version: "2.0", prodid: "Y".repeat(400) },
};

/** A failure as recorded: the error's tag and message. */
export interface Failure {
  readonly tag: string;
  readonly message: string;
}

/** A thrown builder error as recorded: its message. */
interface Thrown {
  readonly thrown: string;
}

/** An Effect's result as recorded: its success value or its failure. */
export type Outcome = { readonly ok: Observed } | { readonly err: Failure };

/** What a scenario yields: a built component, encoded text, an outcome, or a record of those. */
export type Observed =
  | string
  | ReadonlyArray<string>
  | VCalendar
  | VEvent
  | VTodo
  | Calendar.Calendar
  | Event.Event
  | Todo.Todo
  | Thrown
  | Outcome
  | { readonly [field: string]: Observed };

/** Runs an Effect synchronously into its recorded {@link Outcome}. */
export type Run = <
  A extends Observed,
  E extends { readonly _tag: string; readonly message: string },
>(
  effect: Effect.Effect<A, E>,
) => Outcome;

/** Builds a component, recording a thrown builder error as `{ thrown }`. */
const attempt = (build: () => Observed): Observed =>
  Result.merge(
    Result.try({
      try: build,
      catch: (error): Thrown => ({
        thrown: error instanceof BuildError ? error.message : String(error),
      }),
    }),
  );

/** The fluent builders; each scenario returns built components or encoded text. */
const builderScenarios: Readonly<Record<string, () => Observed>> = {
  calendarWithEverything: () =>
    createCalendar("-//Test//EN")
      .calscale("GREGORIAN")
      .method("PUBLISH")
      .name("Name")
      .description("Description")
      .event((e) =>
        e
          .uid("e1")
          .dtstart("20240101T120000Z")
          .dtend("20240101T130000Z")
          .duration("PT1H")
          .summary("Summary")
          .description("Description")
          .location("Location")
          .organizer("mailto:org@example.com")
          .addAttendee("mailto:a@example.com")
          .addAttendee("mailto:b@example.com")
          .categories(["A", "B"])
          .status("TENTATIVE")
          .rrule("FREQ=DAILY")
          .url("https://example.com")
          .geo(1.5, -2.25)
          .priority(3)
          .classification("PRIVATE")
          .dtstamp("20240101T000000Z")
          .addDisplayAlarm("-PT15M", "Reminder")
          .addDisplayAlarm("-PT5M")
          .addAlarm({ component: "VALARM", action: "AUDIO", trigger: "-PT1M" }),
      )
      .todo((t) =>
        t
          .uid("t1")
          .dtstart("20240101")
          .due("20240102")
          .duration("P1D")
          .summary("Todo")
          .description("Todo description")
          .location("Desk")
          .status("COMPLETED")
          .percentComplete(150)
          .completed("20240102")
          .priority(2)
          .dtstamp("20240101T000000Z")
          .rrule("FREQ=WEEKLY")
          .addAlarm({ component: "VALARM", action: "DISPLAY", trigger: "-PT1H" }),
      )
      .addJournal({ component: "VJOURNAL", uid: "j1", summary: "Journal" })
      .addTimezone({ component: "VTIMEZONE", tzid: "UTC" })
      .addEvent({ component: "VEVENT", dtstart: "20240105" })
      .addTodo({ component: "VTODO", uid: "t2" })
      .build(),
  toICalString: () =>
    createCalendar("-//Test//EN")
      .name("Calendar")
      .event((e) => e.uid("e").dtstart("20240101T120000Z").summary("Meeting"))
      .toICalString(),
  attendeesReplace: () =>
    createEvent()
      .addAttendee("mailto:a@example.com")
      .attendees(["mailto:b@example.com"])
      .dtstart("1")
      .build(),
  negativePercent: () => createTodo().percentComplete(-20).build(),
  emptyTodo: () => createTodo().build(),
  eventWithoutStart: () => attempt(() => createEvent().summary("No start").build()),
  calendarWithoutProdid: () => attempt(() => createCalendar("").build()),
  eventBuilderWithoutStartInCalendar: () =>
    attempt(() =>
      createCalendar("-//Test//EN")
        .event((e) => e.summary("x"))
        .build(),
    ),
};

/** The pipeable `Calendar`, `Event` and `Todo` modules. */
const moduleScenarios = (run: Run): Readonly<Record<string, () => Observed>> => ({
  eventEverything: () => {
    const event = Event.withClassification("CONFIDENTIAL")(
      Event.withPriority(0)(
        Event.withUrl("https://example.com")(
          Event.withRrule("FREQ=DAILY")(
            Event.withStatus("CANCELLED")(
              Event.withCategories(["A", "B"])(
                Event.withAttendee("mailto:b@example.com")(
                  Event.withAttendee("mailto:a@example.com")(
                    Event.withOrganizer("mailto:org@example.com")(
                      Event.withLocation("Location")(
                        Event.withDescription("Description")(
                          Event.withSummary("Summary")(
                            Event.withDuration("PT1H")(
                              Event.withDtend("20240101T130000Z")(
                                Event.withUid("e1")(Event.make("20240101T120000Z")),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    return { event: { ...event }, encoded: run(Event.encode(event)) };
  },
  eventMinimal: () => run(Event.encode(Event.make("20240101"))),
  todoEverything: () => {
    const todo = Todo.withRrule("FREQ=WEEKLY")(
      Todo.withPriority(0)(
        Todo.withCompleted("20240102")(
          Todo.withPercent(250)(
            Todo.withStatus("NEEDS-ACTION")(
              Todo.withLocation("Desk")(
                Todo.withDescription("Description")(
                  Todo.withSummary("Todo")(
                    Todo.withDue("20240102")(
                      Todo.withDtstart("20240101")(Todo.withUid("t1")(Todo.make())),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    return { todo: { ...todo }, encoded: run(Todo.encode(todo)) };
  },
  todoNegativePercent: () => ({ ...Todo.withPercent(-5)(Todo.make()) }),
  calendarDefaults: () => ({
    made: { ...Calendar.make("-//Made//EN") },
    built: { ...Calendar.build(Calendar.builder()) },
  }),
  calendarEverything: () => {
    const event = Event.withStatus("CONFIRMED")(
      Event.withLocation("Room")(
        Event.withDescription("Desc")(
          Event.withDtend("20240101T130000Z")(
            Event.withSummary("Summary")(Event.withUid("e1")(Event.make("20240101T120000Z"))),
          ),
        ),
      ),
    );
    const todo = Todo.withPercent(0)(
      Todo.withStatus("IN-PROCESS")(
        Todo.withDue("20240103")(
          Todo.withDtstart("20240102")(Todo.withSummary("Todo")(Todo.withUid("t1")(Todo.make()))),
        ),
      ),
    );
    const calendar = Calendar.build(
      Calendar.withTodo(Todo.make())(
        Calendar.withTodo(todo)(
          Calendar.withEvent(Event.make("20240102"))(
            Calendar.withEvent(event)(
              Calendar.withMethod("REQUEST")(
                Calendar.withCalscale("GREGORIAN")(
                  Calendar.withDescription("Description")(
                    Calendar.withName("Name")(
                      Calendar.withProdid("-//Piped//EN")(Calendar.builder()),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    return run(Calendar.encode(calendar));
  },
});

/** Runs the whole corpus, running each Effect with `run`. */
export const characterise = (run: Run) => ({
  parse: Record.map(parseInputs, (text) => run(parse(text))),
  decode: Record.map(parseInputs, (text) => run(Calendar.decode(text))),
  encode: Record.map(encodeInputs, (calendar) => run(encode(calendar))),
  builder: Record.map(builderScenarios, (scenario) => scenario()),
  modules: Record.map(moduleScenarios(run), (scenario) => scenario()),
});
