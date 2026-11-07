# PB&B

An iOS and Android experience discovery app. People choose any city and country, a three-letter currency, interests, a budget, and a travel radius. The app offers a discovery feed, a personal scout, saved ideas, spontaneous outings, and timely in-app finds.

The app uses the initial PB&B palette and voice: Ice White, Deep Teal, Fresh Aqua, Adventure Lime, and sparing Spontaneous Coral. The brand guide remains local because it is marked internal. The wordmark, final typeface, accessibility states, and image library are still pending approval before a public release.

## Run locally

```sh
npm install
cp .env.example .env
npm start
```

The Firebase web app's **public** configuration belongs in `.env`. This repository's Firebase project is `tripplanner-910da` and its web app ID is already in `.env.example`. Get the public Firebase API key from that web app's settings. The local `.env` is ignored by Git. The Toronto sample scout stays available while `EXPO_PUBLIC_PBB_REMOTE_SCOUT=0`; switch it to `1` only after the function and authentication are ready. Other cities show an empty state until a live source is connected.

To run the server locally:

```sh
npm --prefix functions install
npm --prefix functions run build
npm --prefix functions test
```

## Private OpenAI key

The OpenAI key belongs in **Firebase Secret Manager**, never in Expo, `.env`, GitHub, or chat. When ready, from this directory run:

```sh
firebase functions:secrets:set OPENAI_API_KEY --project tripplanner-910da
```

The Firebase CLI will prompt for the key without placing it in source code. `suggestExperiences` binds that secret at runtime. A key alone does not turn on the live scout: the Firebase Function still needs to be deployed, Firebase Anonymous Authentication and Firestore need to be enabled, and the app needs Firebase public configuration. These changes are intentionally not deployed by this repository.

## Agent and source rules

The Firebase callable uses the OpenAI Agents SDK with a `search_catalog` tool and a structured response. Server code checks each candidate against city, currency, cost, distance, duration, status, date, and source recency before the agent sees it. It copies factual event details from the catalog into the final response, so generated text cannot create a new event or change its price or URL. Requests require Firebase Authentication and have a 30-call daily cap per user.

The default catalog is **sample Toronto data**, never presented as a verified event. For live events, set `PBB_CATALOG_MODE=firestore` in the function environment and populate the Firestore `events` collection from a trusted feed. Each document needs `placeKey` (lowercase normalized `City, Country`), `place`, `title`, `category`, `summary`, `startsAt` (ISO UTC), `durationHours`, `totalCost`, `currency` (ISO three-letter code), `distanceKm`, `location`, `sourceUrl` (HTTPS), `verifiedAt` (ISO UTC), and `status` (`active`, `full`, or `cancelled`). Coordinates are optional. Live items are excluded if the source URL is missing or the source check is more than 48 hours old. A source adapter should recompute distance from the user's location and refresh status before public launch.

The user-facing disclaimer asks people to check the source and confirm the time, price, availability, weather, and location with the organizer **before leaving**. Events may fill, sell out, close, or change unexpectedly; AI can make mistakes. Live cards link to their source. Sample cards do not pretend to have one.

## Current limits

- No real worldwide event feed is connected yet. Location and currency are worldwide-ready inputs; availability depends on verified feed coverage.
- In-app timely finds are implemented. Push delivery while the app is closed is not yet connected.
- Along the Way shows sample stops; routing is not implemented.
- Firebase Anonymous Authentication, Firestore, App Check, and the function deployment must be configured before a public release.
- No sponsored listing placement or payment system has been added. Recommendations should remain based on relevance and clearly disclose sponsorship if added later.

Run `npm run typecheck` and `npm test` for the app, and `npm --prefix functions test` for server checks.
