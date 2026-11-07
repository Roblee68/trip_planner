# PB&B

An iOS and Android experience discovery app. People choose any city and country, a three-letter currency, interests, a budget, and a travel radius. The app offers a discovery feed, a personal scout, saved ideas, spontaneous outings, and timely in-app finds.

The app uses the initial PB&B palette and voice: Ice White, Deep Teal, Fresh Aqua, Adventure Lime, and sparing Spontaneous Coral. The brand guide remains local because it is marked internal. The wordmark, final typeface, accessibility states, and image library are still pending approval before a public release.

## Run locally

```sh
npm install
cp .env.example .env
npm start
```

The Firebase web app's **public** configuration belongs in `.env`. This repository's Firebase project is `tripplanner-910da` and its web app ID is already in `.env.example`. Get the public Firebase API key from that web app's settings. The local `.env` is ignored by Git. The Toronto sample scout stays available while `EXPO_PUBLIC_PBB_REMOTE_SCOUT=0`; switch it to `1` only after the function and authentication are ready. The opening feed shows Toronto examples when the chosen place is Toronto or Ontario, Canada. Other places show an empty state until a live source is connected.

## Open the native projects

The iOS and Android projects are generated locally from `app.json`, then kept out of Git so the Expo configuration stays the source of truth. On a Mac with Xcode, CocoaPods, and Android Studio installed:

```sh
npm ci
npx expo prebuild --platform all --no-install
cd ios && pod install
```

Open `ios/PBB.xcworkspace` in Xcode and the `android` directory in Android Studio. `npm run ios` or `npm run android` builds and runs a local debug app. The app identifier is `com.roblee.pbandb`; the icon is provisional. The iOS project uses a small config plugin to keep all pods at the app's iOS 16.4 minimum for Xcode 27 and to quote Expo's build script path because this folder contains `&`. The iOS configuration enables Expo's scene lifecycle so a build made with Xcode 27 opens on iOS 27. Local debug builds were verified, and a private development preview was installed on Rob's iPhone. No store submission or Firebase deployment is part of this setup.

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

## Opening feed and Serendipity

The app opens directly to the discovery feed. In the Toronto preview it shows three local sample ideas, followed by two separate sponsored-placement examples, with a button for more ideas. The sample listings and generated photos are explicitly illustrative; no business has paid for placement. Search expands on demand, and Settings lets people change place, currency, interests, budget, radius and alert preferences at any time.

Serendipity draws a random qualifying idea and avoids repeating the previous result when possible. Settings offers walking, transit, trains, cars, planes, ferries, and boats; only selected modes appear in Serendipity. Walking stays within 5 km, and ground or water modes stay within 100 km. All transport routes in the sample are illustrative and must be checked before travel. Plane results require a live activity source, a verified flight source from the chosen place, a flight shorter than two hours, and a route check within 48 hours. There are no qualifying flight ideas in the current catalog. The polar-bear image is inspiration, not a bookable trip.

Settings also offers specific interests, including dancing, classes, crafts, pottery, woodwork, shopping, and handmade goods. Selected interests affect local ranking, in-app opportunities, and eligible local phone reminders. People can tap **Use my current location** to grant foreground access and fill in their nearby city and country; manual entry remains available, and currency stays an explicit choice. Phone reminders require an opt-in and a recently source-checked live listing already found by the app. New finds while the app is closed still require a feed and push delivery service. The native preview strips the push entitlement because it only schedules local notifications.

## Agent and source rules

The Firebase callable uses the OpenAI Agents SDK with a `search_catalog` tool and a structured response. Server code checks each candidate against city, currency, cost, distance, duration, status, date, and source recency before the agent sees it. It copies factual event details from the catalog into the final response, so generated text cannot create a new event or change its price or URL. Requests require Firebase Authentication and have a 30-call daily cap per user.

The default catalog is **sample Toronto data**, never presented as a verified event. For live events, set `PBB_CATALOG_MODE=firestore` in the function environment and populate the Firestore `events` collection from a trusted feed. Each document needs `placeKey` (lowercase normalized `City, Country`), `place`, `title`, `category`, `summary`, `listedAt` and `startsAt` (ISO UTC), `durationHours`, `totalCost`, `currency` (ISO three-letter code), `distanceKm`, `location`, `sourceUrl` (HTTPS), `verifiedAt` (ISO UTC), and `status` (`active`, `full`, or `cancelled`). Coordinates are optional. Live items are excluded if the source URL is missing or the source check is more than 48 hours old. A source adapter should recompute distance from the user's location and refresh status before public launch.

The user-facing disclaimer asks people to check the source and confirm the time, price, availability, weather, and location with the organizer **before leaving**. Events may fill, sell out, close, or change unexpectedly; AI can make mistakes. Live cards link to their source. Sample cards do not pretend to have one.

Saved live cards keep their source link across app restarts and across destinations. Their source-check label changes to “Recheck source” after 48 hours. Their original listing date is preserved so a later source check cannot make an old event appear newly listed in the alert inbox.

## Current limits

- No real worldwide event feed is connected yet. Location and currency are worldwide-ready inputs; availability depends on verified feed coverage.
- In-app timely finds are implemented. Push delivery while the app is closed is not yet connected.
- Along the Way shows sample stops; routing is not implemented.
- Firebase Anonymous Authentication, Firestore, App Check, and the function deployment must be configured before a public release.
- Two sponsored-placement examples are visible in the Toronto preview, but no actual sponsor feed, partner account, or payment system is connected. Paid placement must stay separate from organic recommendations and pass the same source and relevance checks before launch.

Run `npm run typecheck` and `npm test` for the app, and `npm --prefix functions test` for server checks.
