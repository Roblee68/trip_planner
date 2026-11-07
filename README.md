# PB&B

A local Expo prototype for finding experiences that fit a person's interests, time, travel radius, and budget. It targets iOS and Android.

## Run

```sh
npm install
npm start
```

Press `i` or `a` in Expo for iOS or Android. Run `npm run typecheck` and `npm test` to verify the recommendation and alert rules.

## Included

- Discover feed with search, budget and distance filters, and feedback that changes ranking
- A plain-language discovery prompt that returns three explained suggestions, with cheaper, closer, and different refinements
- First-run setup for interests, budget, travel radius, and in-app alerts
- Details, saved experiences, and alerts for saved items
- A spontaneous view filtered by available time
- An Along the Way view for sample stops
- Editable interests, radius, budget, alert settings, and local storage
- An in-app opportunity alert inbox for newly listed, relevant, time-sensitive sample events

All listings are **illustrative sample data**, relative to the current date. The app does not verify dates, prices, availability, routes, or booking links. It does not send push notifications. Before real alerts can be delivered, connect the existing API, check each listing against the organizer, persist discovery results in a backend, and add a notification service. The alert-selection logic in `src/logic.ts` is designed to be reused in that service.

## Next implementation stage

1. Replace the sample adapter in `src/catalog.ts` with the existing API integration. Map its listings to `Experience` and include provenance, last checked time, organizer URL, and structured prices and dates. The linked `trip_planner` GitHub repository was empty when this version was built, so the integration code is not included here.
2. Recheck time-sensitive facts before showing or sending an alert. Remove expired or unverified items.
3. Add accounts and server-side matching so new listings can be found while the app is closed.
4. Add opted-in push delivery, quiet hours, frequency caps, and deduplication across devices.

No deployment, account, or external service is configured in this prototype.
