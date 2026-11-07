# PB&B

An iOS and Android experience discovery app. People choose any city and country, a three-letter currency, interests, a budget, and a travel radius. The app offers a discovery feed, a personal scout, saved ideas, spontaneous outings, and timely in-app finds.

The app uses the initial PB&B palette and voice: Ice White, Deep Teal, Fresh Aqua, Adventure Lime, and sparing Spontaneous Coral. The brand guide remains local because it is marked internal. The wordmark, final typeface, accessibility states, and image library are still pending approval before a public release.

## Run locally

```sh
npm install
cp .env.example .env
npm start
```

The Firebase web app's **public** configuration belongs in `.env`. This repository's Firebase project is `tripplanner-910da` and its web app ID is already in `.env.example`. Get the public Firebase API key from that web app's settings. The local `.env` is ignored by Git. The Toronto sample scout stays available while `EXPO_PUBLIC_PBB_REMOTE_SCOUT=0`; switch it to `1` only after the function and authentication are ready. Leave `EXPO_PUBLIC_PBB_AUTO_SCOUT=0` for the manual web-search preview so opening Settings does not repeatedly spend search calls. The opening feed shows Toronto examples when the chosen place is Toronto or Ontario, Canada. Other places show an empty state until a live source is connected.

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

The Firebase CLI will prompt for the key without placing it in source code. `suggestExperiences` binds that secret at runtime. A key alone does not turn on the live scout: the Firebase Function still needs to be deployed, Firebase Anonymous Authentication and Firestore need to be enabled, and the app needs Firebase public configuration. The secret metadata shows an enabled version, but its value has not been read or tested. The project currently has no Firestore database, so the function's per-user daily limit cannot run yet. Always pass `--project tripplanner-910da` when deploying; this Mac's Firebase CLI default points to another project. These changes are intentionally not deployed by this repository.

For an explicit search preview after the services are ready, copy `functions/.env.example` to `functions/.env.tripplanner-910da`, deploy just the callable with `firebase deploy --only functions:pbb:suggestExperiences --project tripplanner-910da`, then set `EXPO_PUBLIC_PBB_REMOTE_SCOUT=1` in the app's private `.env` and rebuild. The web-search path uses the Responses API, returns the model's cited text with clickable HTTPS citations, and does not turn unconfirmed web results into event cards or phone alerts. Search calls can incur API costs. Do not deploy the whole codebase until the scheduled alert prerequisites below are ready; that would create a billed Cloud Scheduler job.

## Opening feed and Serendipity

The app opens directly to the discovery feed. In the Toronto preview it shows three local sample ideas, followed by two separate sponsored-placement examples, with a button for more ideas. The sample listings and generated photos are explicitly illustrative; no business has paid for placement. Search expands on demand, and Settings lets people change place, currency, interests, budget, radius and alert preferences at any time.

Serendipity draws a random qualifying idea and avoids repeating the previous result when possible. Settings offers walking, transit, trains, cars, planes, ferries, and boats; only selected modes appear in Serendipity. Walking stays within 5 km, and ground or water modes stay within 100 km. All transport routes in the sample are illustrative and must be checked before travel. Plane results require a live activity source, a verified flight source from the chosen place, a flight shorter than two hours, and a route check within 48 hours. There are no qualifying flight ideas in the current catalog. The polar-bear image is inspiration, not a bookable trip.

Settings now has 66 specific interests in six collapsible groups. Forests is under Nature and discovery; Art, Metalwork, and Open to new ideas are under Make, learn and browse. The last option broadens discovery ranking, without making unrelated activities eligible for alerts. Selected interests affect local ranking, in-app opportunities, and eligible local phone reminders. People can choose miles or kilometres; distances remain kilometres internally for consistent filtering. They can tap **Use my current location** to grant foreground access and fill in their nearby city and country. The app then selects the current currency associated with that country, using Unicode CLDR 49 data, and a searchable currency selector allows an override. Manual place entry remains available. Unicode's license notice is at `licenses/CLDR-LICENSE`.

The 66-interest starting set was informed by [Ticketmaster's segment, genre and subgenre classification](https://developer.ticketmaster.com/products-and-docs/apis/discovery-manual/v2/) and [Meetup's event topics](https://help.meetup.com/hc/en-us/articles/39790436736525-Creating-an-event). It is a product starting point, not a researched optimum number of choices. Grouping keeps most options collapsed until the person opens a section. Interest keys, currency codes, and kilometre values are stored independently of display language so future UI translations can cover English, French, German, Spanish, Japanese, Korean, and Punjabi without changing saved preferences. No full UI translations are shipped yet; Punjabi script and regional wording need a deliberate choice during translation. Phone reminders require an opt-in and a recently source-checked live listing already found by the app. The native preview strips the push entitlement because it only schedules local notifications.

## Daily opportunity scout

The server code now contains an opt-in daily scout. An authenticated person registers their place, interests, travel modes, budget, radius, local time zone and Expo push token through `setDailyScout`. The [scheduled Firebase function](https://firebase.google.com/docs/functions/schedule-functions) runs hourly and scans each subscriber only at 08:00 in their time zone. It considers sourced, active listings starting within 14 days whose organizer/source check is under 24 hours old. Sign-up deadlines in the next seven days and weekend activities in the next seven days are prioritized. It sends no more than two new matches per scan, records a unique notification per event/date/kind, and checks [Expo push receipts](https://docs.expo.dev/push-notifications/sending-notifications/) afterward. Turning the setting off deletes the subscription. Firestore client access to the scout records is denied; the callable uses Firebase Authentication and the Admin SDK.

This is **code ready for connection, not a live notification service**. To activate it, this Firebase project needs a Firestore database, Anonymous Authentication, deployed Firestore rules/indexes, a genuine event feed with frequently refreshed source status and sign-up deadlines, and the callable plus scheduled function deployed to `tripplanner-910da`. An Expo project and [push credentials](https://docs.expo.dev/push-notifications/push-notifications-setup/) are needed for iPhone and Android; the current iPhone provisioning profile has no push capability. Only then set `EXPO_PUBLIC_EXPO_PROJECT_ID`, build with `PBB_ENABLE_REMOTE_PUSH=1`, set `EXPO_PUBLIC_PBB_DAILY_SCOUT=1`, and install a new app build. Test one opt-in device and its receipt before broader use. The schedule and push service can incur charges. The current phone preview deliberately leaves the daily setting unavailable and sends no new finds while closed.

The first feed adapter must supply accurate coordinates or a user-specific distance, a canonical city and country, a stable event ID, selected topic/travel tags, `signupBy` where relevant, HTTPS organizer links, current availability and a `verifiedAt` timestamp. The current database query is keyed to the selected city, so nearby activities across city boundaries need geospatial feed work before calling coverage complete. A source check timestamp alone is insufficient if the feed cannot actually confirm whether registration remains open.

## Agent and source rules

The Firebase callable uses the OpenAI Agents SDK with a `search_catalog` tool and a structured response. Server code checks each candidate against city, currency, cost, distance, duration, status, date, and source recency before the agent sees it. It copies factual event details from the catalog into the final response, so generated text cannot create a new event or change its price or URL. Requests require Firebase Authentication and have a 30-call daily cap per user.

The default catalog is **sample Toronto data**, never presented as a verified event. For live events, set `PBB_CATALOG_MODE=firestore` in the function environment and populate the Firestore `events` collection from a trusted feed. Each document needs `placeKey` (lowercase normalized `City, Country`), `place`, `title`, `category`, `summary`, `listedAt` and `startsAt` (ISO UTC), `durationHours`, `totalCost`, `currency` (ISO three-letter code), `distanceKm`, `location`, `sourceUrl` (HTTPS), `verifiedAt` (ISO UTC), and `status` (`active`, `full`, or `cancelled`). Coordinates are optional. Live items are excluded if the source URL is missing or the source check is more than 48 hours old. A source adapter should recompute distance from the user's location and refresh status before public launch.

The user-facing disclaimer asks people to check the source and confirm the time, price, availability, weather, and location with the organizer **before leaving**. Events may fill, sell out, close, or change unexpectedly; AI can make mistakes. Live cards link to their source. Sample cards do not pretend to have one.

Saved live cards keep their source link across app restarts and across destinations. Their source-check label changes to “Recheck source” after 48 hours. Their original listing date is preserved so a later source check cannot make an old event appear newly listed in the alert inbox.

## Current limits

- No real worldwide event feed is connected yet. Location and currency are worldwide-ready inputs; availability depends on verified feed coverage.
- In-app timely finds and the daily scan/push code are implemented. The current iPhone app remains in sample-scout mode until the live feed, backend, authentication and push setup are connected and a push-enabled app is installed.
- Along the Way shows sample stops; routing is not implemented.
- Firebase Anonymous Authentication, Firestore, App Check, and the function deployment must be configured before a public release.
- Two sponsored-placement examples are visible in the Toronto preview, but no actual sponsor feed, partner account, or payment system is connected. Paid placement must stay separate from organic recommendations and pass the same source and relevance checks before launch.

Run `npm run typecheck` and `npm test` for the app, and `npm --prefix functions test` for server checks.
