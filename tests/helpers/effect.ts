/**
 * The test harness boundary: the only place the suites run an Effect.
 *
 * @module
 */

import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import type { Run } from "../fixtures/corpus.ts";

/** Runs an Effect to a Promise of its success value. */
export const runTest = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect);

/** Runs an Effect synchronously into `{ ok }` or `{ err: { tag, message } }`. */
export const runOutcome: Run = (effect) =>
  Result.match(Effect.runSync(Effect.result(effect)), {
    onSuccess: (ok) => ({ ok }),
    onFailure: (error) => ({ err: { tag: error._tag, message: error.message } }),
  });
