---
"@thomasfosterau/effect-ical": minor
---

The pipeable setters of `Calendar`, `Event` and `Todo` (`Event.withUid`, `Todo.withDue`, `Calendar.withEvent`, …) now return instances of the Schema class, built with its constructor, instead of prototype-less object spreads typed as the class. `instanceof Event` (and `Todo`, `Calendar`) now holds after a setter, and `Schema.encode` accepts the result. Properties the class does not declare are no longer carried through a setter: a value cast to `Event` with extra fields loses them.
