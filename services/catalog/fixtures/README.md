# Development fixtures

**Nothing in this directory is real.** Every row is a fictional "Northwind
Trading" product on `example.invalid`, generated to prove the scheduled
pipeline end to end without touching a provider.

A `fixture` source reads a local file. `retrieveFeed` refuses that transport
unless the caller passes `allowFixtures: true`, and `validateFeedSource`
requires the source id to begin with `fixture-`, so a fixture is obvious in a
log line, a dashboard row and a database dump.

Fixtures must never be enabled against production storage.
