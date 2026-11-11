# PB&B phone build 4 — 11 November 2026

Application version 0.1.0, iOS bundle version 4, Android versionCode 4, package com.roblee.pbandb. App/backend implementation: 2c257eec56871893f3edb7c587a93f19dbe02f2e. Root workspace: /Users/roblee/Projects/PB&B.

## Changes

- gpt-6-luna is the configured AI model. Normal discovery and weekly browsing read the shared event catalogue rather than researching the web per user. Toronto has 2,428 upcoming dated occurrences imported from the official city feed; other used cities enter a bounded shared refresh queue. Event records retain their own timezone.
- Paid AI actions are limited to five/account or guest identity/day and fifty globally/day, with at most ten shared city refreshes. Settings displays remaining allowance and local reset time. The reset boundary is midnight UTC, not each person's midnight. These action limits are not a guaranteed dollar cap.
- Along requires geographic lookup and selection of a confirmed destination. The server rejects missing, altered, expired or another account's confirmations before reserving AI quota. Lookup supports cities, addresses, landmarks and valid coordinates through Photon/OpenStreetMap; coverage and service availability vary.
- Optional foreground GPS requires OS permission. Precise fixes remain in memory; outgoing coordinates are rounded to roughly 100 metres, expire after fifteen minutes and are cleared on manual-place changes, permission denial or failed refresh. Searches check permission again. No background location tracking is enabled. Device timezone is separate from GPS. Route research shares approved approximate origin and selected destination with OpenAI; destination lookup shares the entered query with Photon. See LOCATION_VERIFICATION.md and the updated public privacy page.

## Verified

- TypeScript check passed, 33 app tests and 59 backend tests passed.
- Live New York lookup returned New York, New York, United States; missing/edited confirmations were rejected and AI allowance stayed unchanged. Shared catalogue returned five ideas with America/Toronto event timezone.
- suggestExperiences, deleteAccount and refreshEventCatalogue are ACTIVE. Their source archive matches all nine checked affected backend modules. The scheduled worker has no public IAM principal. An unauthenticated request to private map metadata returned PERMISSION_DENIED.
- Privacy page at https://tripplanner-910da.web.app/privacy includes GPS rounding and Photon disclosures.
- Release iPhone archive and Android AAB/APK builds succeeded. Both phone binaries contain their standalone JavaScript bundles; Metro is not required.
- Rob's iPhone reports PB&B 0.1.0, bundle version 4. Installation and launch commands succeeded. Further interactive review was deferred because the owner was actively using another app.
- Moto G 2025 reports versionCode 4, versionName 0.1.0 and update time 14:32:24. Install succeeded with data preserved; launch succeeded. Android Studio mirroring visibly showed five shared-catalogue ideas and the updated Along geographic lookup controls. No build 4 install was sent to the iPad or a tablet.

## Artifacts and store handoff

Saved in /Users/roblee/Projects/PB&B/releases/2026-11-11-build4/:

- PBB-build4.xcarchive: successful Release archive using existing local Apple signing. Open in Xcode Organizer to validate and distribute. Store upload validation was not performed.
- PBB-build4-unsigned.aab: successfully built store bundle, deliberately unsigned. In Android Studio use Build > Generate Signed App Bundle or APK with PB&B's existing upload key. No PB&B upload keystore was found in this project, the asset workspace or the searched Documents/Desktop/Downloads/Projects paths. The MyoMesh key was not used. Do not upload the phone preview APK as a store release.
- PBB-build4-phone-preview.apk: standalone device-preview build signed with the existing local preview certificate so phone data is preserved on update.

Xcode has ios/PBB.xcworkspace open with Rob's iPhone selected. Android Studio has the android project open; scripts/open-android-studio.command launches it with Node and Java 21 available. A config plugin prevents generated store Release builds from silently using the debug signing key; the explicit pbbPreviewSigning flag is only for local phone previews.

App Store Connect was inspected read-only: its version record is 1.0 and still selects older binary 0.1.0 (2). No upload, submission or store-setting change was made. Select the new binary after uploading and processing. Existing review Notes still contain placeholders and need the final recording/build/testing information before submission.

Fresh paid Luna route quality testing remains incomplete: earlier test usage had already exhausted the new shared daily quota. The quota was not bypassed. Catalogue reads and geographic verification were tested without spending paid AI actions. The shared quota resets at 7 p.m. Toronto time on 11 November (midnight UTC).
