/**
 * Parser for iCalendar format (RFC 5545) using Effect idioms
 */

import { Effect, Either } from "effect";
import type * as Types from "./types.js";

/**
 * Parse errors
 */
export class ParseError {
  readonly _tag = "ParseError";
  constructor(readonly message: string) {}
}

/**
 * Unfold lines according to RFC 5545 (3.1)
 * Long content lines are split into multiple lines with a space or tab continuation
 */
const unfoldLines = (text: string): string[] => {
  const lines = text.split(/\r?\n/);
  const unfolded: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    // Check if next line is a continuation (starts with space or tab)
    if (unfolded.length > 0 && (line[0] === ' ' || line[0] === '\t')) {
      // Continuation line - append to previous (removing the leading whitespace)
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  
  return unfolded;
};

/**
 * Parse a content line into name, parameters, and value
 */
const parseContentLine = (
  line: string
): Either.Either<{ name: string; params: Record<string, string>; value: string }, ParseError> => {
  // Format: name[;param=value]*:value
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    return Either.left(new ParseError(`Invalid content line: ${line}`));
  }

  const nameAndParams = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);

  // Parse name and parameters
  const parts = nameAndParams.split(";");
  const name = parts[0]!.toUpperCase();
  const params: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const param = parts[i]!;
    const eqIndex = param.indexOf("=");
    if (eqIndex !== -1) {
      const paramName = param.slice(0, eqIndex).toUpperCase();
      let paramValue = param.slice(eqIndex + 1);
      // Remove quotes if present
      if (paramValue.startsWith('"') && paramValue.endsWith('"')) {
        paramValue = paramValue.slice(1, -1);
      }
      params[paramName] = paramValue;
    }
  }

  return Either.right({ name, params, value });
};

/**
 * Map RFC property names to camelCase field names
 */
const propertyNameMap: Record<string, string> = {
  "PERCENT-COMPLETE": "percent",
  "LAST-MODIFIED": "lastmod",
  "TZOFFSETFROM": "tzoffsetfrom",
  "TZOFFSETTO": "tzoffsetto",
  "TZNAME": "tzname",
};

/**
 * Properties that should be parsed as numbers
 */
const numericProperties = new Set(["PERCENT", "PERCENT-COMPLETE", "PRIORITY", "REPEAT", "SEQUENCE"]);

/**
 * Normalize property name to field name
 */
const normalizePropertyName = (name: string): string => {
  return propertyNameMap[name] || name.toLowerCase();
};

/**
 * Parse property value based on its type
 */
const parsePropertyValue = (name: string, value: string): any => {
  if (numericProperties.has(name)) {
    const num = parseInt(value, 10);
    return isNaN(num) ? value : num;
  }
  return value;
};

/**
 * Parse properties into a record
 * Throws ParseError if any line is invalid
 */
const parseProperties = (lines: string[]): Either.Either<Record<string, any>, ParseError> => {
  const props: Record<string, any> = {};
  const arrayProps = new Set(["ATTENDEE", "CATEGORIES", "RDATE", "EXDATE"]);

  for (const line of lines) {
    const result = parseContentLine(line);
    
    // Propagate parsing errors instead of silently dropping invalid lines
    if (Either.isLeft(result)) {
      return Either.left(result.left);
    }

    const { name, value } = result.right;
    const fieldName = normalizePropertyName(name);
    const parsedValue = parsePropertyValue(name, value);
    
    if (arrayProps.has(name)) {
      if (!props[fieldName]) {
        props[fieldName] = [];
      }
      props[fieldName].push(parsedValue);
    } else {
      props[fieldName] = parsedValue;
    }
  }

  return Either.right(props);
};

/**
 * Parse a component block
 */
const parseComponent = (
  lines: string[],
  startIndex: number
): Either.Either<{ component: any; endIndex: number }, ParseError> => {
  const beginLine = lines[startIndex];
  if (!beginLine || beginLine.trim() === "") {
    return Either.left(new ParseError(`Cannot parse component: empty or missing line at index ${startIndex}`));
  }

  const beginResult = parseContentLine(beginLine);
  if (Either.isLeft(beginResult)) {
    return Either.left(beginResult.left);
  }

  const { name: beginName, value: componentType } = beginResult.right;
  if (beginName !== "BEGIN") {
    return Either.left(new ParseError(`Expected BEGIN, got ${beginName}`));
  }

  const componentLines: string[] = [];
  const subComponents: any[] = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }

    const lineResult = parseContentLine(line);
    if (Either.isLeft(lineResult)) {
      // Propagate parsing errors instead of silently skipping invalid lines
      return Either.left(
        new ParseError(
          `Error parsing content line at index ${i}: ${lineResult.left.message}`
        )
      );
    }

    const { name, value } = lineResult.right;

    if (name === "END" && value === componentType) {
      // End of component
      const propsResult = parseProperties(componentLines);
      if (Either.isLeft(propsResult)) {
        return Either.left(propsResult.left);
      }
      
      const props = propsResult.right;
      props.component = componentType;

      // Add sub-components based on component type
      if (componentType === "VEVENT" || componentType === "VTODO") {
        const alarms = subComponents.filter((c) => c.component === "VALARM");
        if (alarms.length > 0) {
          props.alarms = alarms;
        }
      } else if (componentType === "VTIMEZONE") {
        // Handle STANDARD and DAYLIGHT sub-components
        const standard = subComponents.filter((c) => c.component === "STANDARD");
        const daylight = subComponents.filter((c) => c.component === "DAYLIGHT");
        if (standard.length > 0) {
          props.standard = standard;
        }
        if (daylight.length > 0) {
          props.daylight = daylight;
        }
      }

      return Either.right({ component: props, endIndex: i });
    } else if (name === "BEGIN") {
      // Start of sub-component
      const subResult = parseComponent(lines, i);
      if (Either.isRight(subResult)) {
        subComponents.push(subResult.right.component);
        i = subResult.right.endIndex;
      }
    } else {
      componentLines.push(line);
    }

    i++;
  }

  return Either.left(new ParseError(`Component ${componentType} not closed`));
};

/**
 * Parse an iCalendar string into a VCalendar object
 * 
 * @param icalString - The iCalendar string to parse
 * @returns Effect that succeeds with VCalendar or fails with ParseError
 */
export const parse = (
  icalString: string
): Effect.Effect<Types.VCalendar, ParseError> => {
  return Effect.gen(function* (_) {
    const lines = unfoldLines(icalString);

    // Find the main VCALENDAR component
    let calendarStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const result = parseContentLine(lines[i]!);
      if (Either.isRight(result)) {
        const { name, value } = result.right;
        if (name === "BEGIN" && value === "VCALENDAR") {
          calendarStart = i;
          break;
        }
      }
    }

    if (calendarStart === -1) {
      return yield* _(Effect.fail(new ParseError("No VCALENDAR component found")));
    }

    const result = parseComponent(lines, calendarStart);
    if (Either.isLeft(result)) {
      return yield* _(Effect.fail(result.left));
    }

    const calendar = result.right.component;

    // Ensure required properties
    if (!calendar.version) {
      return yield* _(Effect.fail(new ParseError("VERSION property is required")));
    }
    if (calendar.version !== "2.0") {
      return yield* _(Effect.fail(new ParseError(`VERSION must be "2.0", got "${calendar.version}"`)));
    }
    if (!calendar.prodid) {
      return yield* _(Effect.fail(new ParseError("PRODID property is required")));
    }

    // Organize components
    const components: {
      events: Types.VEvent[];
      todos: Types.VTodo[];
      journals: Types.VJournal[];
      freebusys: Types.VFreeBusy[];
      timezones: Types.VTimezone[];
    } = {
      events: [],
      todos: [],
      journals: [],
      freebusys: [],
      timezones: [],
    };

    // Parse all components within VCALENDAR
    let i = calendarStart + 1;
    while (i < lines.length) {
      const line = lines[i];
      if (!line) {
        i++;
        continue;
      }

      const lineResult = parseContentLine(line);
      if (Either.isRight(lineResult)) {
        const { name, value } = lineResult.right;

        if (name === "BEGIN") {
          const compResult = parseComponent(lines, i);
          if (Either.isRight(compResult)) {
            const comp = compResult.right.component;
            switch (comp.component) {
              case "VEVENT":
                components.events.push(comp);
                break;
              case "VTODO":
                components.todos.push(comp);
                break;
              case "VJOURNAL":
                components.journals.push(comp);
                break;
              case "VFREEBUSY":
                components.freebusys.push(comp);
                break;
              case "VTIMEZONE":
                components.timezones.push(comp);
                break;
            }
            i = compResult.right.endIndex;
          }
        } else if (name === "END" && value === "VCALENDAR") {
          break;
        }
      }

      i++;
    }

    const vcalendar: Types.VCalendar = {
      component: "VCALENDAR",
      prodid: calendar.prodid,
      version: calendar.version,
      calscale: calendar.calscale,
      method: calendar.method,
      name: calendar.name,
      description: calendar.description,
      timezones: components.timezones.length > 0 ? components.timezones : undefined,
      events: components.events.length > 0 ? components.events : undefined,
      todos: components.todos.length > 0 ? components.todos : undefined,
      journals: components.journals.length > 0 ? components.journals : undefined,
      freebusys: components.freebusys.length > 0 ? components.freebusys : undefined,
    };

    return vcalendar;
  });
};

/**
 * Parse an iCalendar string and return Either
 */
export const parseEither = (
  icalString: string
): Either.Either<Types.VCalendar, ParseError> => {
  return Effect.runSync(Effect.either(parse(icalString)));
};
