/**
 * The property-name table the parser and the encoder share: how an RFC 5545
 * property name maps to its field in the object model, and which properties
 * repeat. Internal: not re-exported from the package index.
 *
 * @module
 */

import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

/** RFC property names whose field name is not simply the lower-cased name. */
const propertyNameMap: R.ReadonlyRecord<string, string> = {
  "PERCENT-COMPLETE": "percent",
  "LAST-MODIFIED": "lastmod",
};

/**
 * The object-model field an (upper-cased) property name reads into: the
 * lower-cased name, except `PERCENT-COMPLETE` (`percent`) and `LAST-MODIFIED`
 * (`lastmod`).
 */
export const fieldName = (name: string): string =>
  Option.getOrElse(R.get(propertyNameMap, name), () => Str.toLowerCase(name));

/** Properties that may repeat, collected into an array in order. */
const arrayProperties = ["ATTENDEE", "CATEGORIES", "RDATE", "EXDATE"] as const;

/** Whether an (upper-cased) property name repeats into an array field. */
export const isArrayProperty = (name: string): boolean => Arr.contains(arrayProperties, name);

/**
 * The properties each component type types (and the encoder writes), by
 * component name. Any other property of that component is untyped. `GEO`
 * and `FREEBUSY` are not in the table: the model types them as structures
 * the parser does not decode.
 */
const typedProperties: R.ReadonlyRecord<string, ReadonlyArray<string>> = {
  VCALENDAR: ["VERSION", "PRODID", "CALSCALE", "METHOD", "NAME", "DESCRIPTION"],
  VEVENT: [
    "UID",
    "DTSTAMP",
    "DTSTART",
    "DTEND",
    "DURATION",
    "SUMMARY",
    "DESCRIPTION",
    "LOCATION",
    "ORGANIZER",
    "ATTENDEE",
    "CATEGORIES",
    "STATUS",
    "RRULE",
    "RDATE",
    "EXDATE",
    "URL",
    "PRIORITY",
    "CLASS",
  ],
  VTODO: [
    "UID",
    "DTSTAMP",
    "DTSTART",
    "DUE",
    "DURATION",
    "SUMMARY",
    "DESCRIPTION",
    "LOCATION",
    "STATUS",
    "PERCENT-COMPLETE",
    "COMPLETED",
    "PRIORITY",
    "RRULE",
  ],
  VJOURNAL: ["UID", "DTSTAMP", "DTSTART", "SUMMARY", "DESCRIPTION", "STATUS", "CLASS"],
  VFREEBUSY: ["UID", "DTSTAMP", "DTSTART", "DTEND", "ORGANIZER", "URL", "ATTENDEE"],
  VTIMEZONE: ["TZID", "LAST-MODIFIED", "TZURL"],
  STANDARD: ["DTSTART", "TZOFFSETFROM", "TZOFFSETTO", "RRULE", "TZNAME"],
  DAYLIGHT: ["DTSTART", "TZOFFSETFROM", "TZOFFSETTO", "RRULE", "TZNAME"],
  VALARM: [
    "ACTION",
    "TRIGGER",
    "DURATION",
    "REPEAT",
    "DESCRIPTION",
    "SUMMARY",
    "ATTENDEE",
    "ATTACH",
  ],
};

/**
 * Whether a component of type `componentType` types the (upper-cased)
 * property `name`. A component type the model does not know types nothing.
 */
export const isTypedProperty =
  (componentType: string) =>
  (name: string): boolean =>
    Option.match(R.get(typedProperties, componentType), {
      onNone: () => false,
      onSome: (names) => Arr.contains(names, name),
    });
