# Shared event catalogue and Luna

Normal Discover, search/refine, Now, Serendipity, saved-idea matching, weekly browsing and daily alerts read shared Firestore events. They do not initiate an OpenAI search. Changing interests or budgets only changes database ranking. The catalogue can be incomplete; an empty result never silently falls back to paid research.

## Collection

`eventCatalogueCities/{cityId}` tracks the selected city/country, venue timezone, last collection, next refresh, and refresh lease. Its `events/{eventId}` subcollection stores source facts for individual dated occurrences. City IDs normalize capitalization, punctuation and accents; the country remains part of the identity. Private imported screenshots and routes are never published to this collection.

When an authenticated account or anonymous session uses a new city, it joins the central queue. Registration is capped at three new cities per account/session per UTC day and thirty globally. A scheduled worker runs every thirty minutes, with a transaction lease preventing overlapping collection for the same city. Inactive cities stop regular refresh after fourteen days without a request. All cities may join; collection coverage and queue latency depend on source availability and the global budget.

Toronto imports the official licensed Festivals & Events JSON feed every twelve hours. This large feed is parsed incrementally, without holding the whole export in memory. Expired occurrences are excluded. Attribution is stored on each event. Other cities collect up to twenty dated events in one shared Luna research job per twenty-four hours, with up to three search-tool calls. The worker admits at most ten paid city refresh attempts per UTC day, within the global fifty-action budget, and processes at most three queued cities per run. Toronto's public feed import does not spend AI allowance. A failed/empty collection retains previous records, retries no sooner than two hours later, and does not display records older than seventy-two hours.

Each event retains the source ID/link, title, summary, categories, local date/time, IANA timezone, UTC start/end instants when known, admission/currency when known, address/coordinates when known, source attribution, last checked time and cancellation status. Stable source/date/time IDs deduplicate repeated imports and preserve separate recurring sessions. Successful imports remove occurrences no longer returned by that source. Dates and times are checked against the IANA timezone; impossible dates and inconsistent UTC offsets are rejected. Unknown price, duration and coordinates remain unknown. The app does not invent a distance or assert a feasible journey; Today excludes listings with unknown closing times. Organizer links remain the authority for availability.

The weekly calendar uses the selected city's timezone, rather than the device's timezone. Dated event cards show their stored timezone.

## AI budget

The selected provider remains OpenAI, using `gpt-6-luna` for route research, screenshot/link reading, shared city collection and weekly featured adventures. No other AI provider is connected.

- Five paid actions per account or guest session per UTC day, shared by route research and imported-find reading/lookup.
- Fifty paid actions globally per UTC day, including centralized city collection and featured-adventure refreshes.
- Ten of those global actions at most may be city refresh attempts.
- Allowances are reserved in Firestore transactions before paid work. Failed attempts retain their reservation to prevent retry storms. These are request/action caps, not a guaranteed dollar billing cap: model tokens and search tool usage are billed separately.
- Repeated identical routes within thirty minutes use a private per-user cache and do not reserve another paid action. The route cache uses a transaction lease. Expired route records are removed by the scheduled worker; account deletion also removes the user's route cache and new-city registration counters.
- Settings shows the server-reported remaining user allowance and the reset in the device's local time. Reset is midnight UTC. Guest-session recreation can reset the guest quota; the global quota remains the spending backstop.

## Release checks

Run `npm run typecheck`, `npm test`, and `npm --prefix functions test`. Tests cover timezone boundaries, DST-invalid timestamps, dates, repeated sessions, cancellation/staleness, prices, known-coordinate filtering, incremental JSON parsing and quota boundaries. Validate the full Toronto export using a streaming read, then verify central record count and source metadata after ingestion. Verify deployed function model/mode, schedule state and real authenticated catalogue responses; compare quota counters before/after routine reads. Test Luna once with a bounded paid request before calling the model migration verified.

Deploy the affected callables, scheduled alerts and `refreshEventCatalogue` explicitly. No Firestore client access is granted; the existing deny-all client rules remain. The backend rollout updates data/cost behavior for existing apps. New Settings allowance text and city-timezone weekly display require rebuilding the iOS/Android apps from this source.
