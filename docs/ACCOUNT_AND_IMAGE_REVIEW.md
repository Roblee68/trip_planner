# PB&B account and image review preparation

## Deployment and test status — 2026-11-11

- Firebase Anonymous, Email/Password, and Apple authentication are enabled for `tripplanner-910da`. The `com.roblee.pbandb` App ID and the iPhone provisioning profile include Sign in with Apple. The Apple key used for revocation is stored in Firebase Secret Manager.
- `deleteAccount` and the image-suppression update to `getWeeklyLocalEvents` are deployed. The updated privacy and support pages are live. No bundled or marketing image was changed.
- PB&B `0.1.0 (2)` was installed on a Moto G (Android 16) and Rob’s iPhone 16 Pro (iOS 27.2). The Moto G account screen and image-report link were checked visually. The iPhone build launched on the physical device.
- A disposable email account reached the live deletion callable, which returned `deleted: true`. The account was removed. The first request made immediately after deployment received HTTP 401; a repeat with a fresh Firebase token succeeded after the service settled.
- Email registration, sign-in, password reset, and the complete deletion flow have not yet been exercised through the phone UI. Apple sign-in and Apple token revocation have not yet been tested on the iPhone. The build has not been uploaded to App Store Connect or resubmitted to Apple. Do not describe these flows as verified in the submitted build until the exact release candidate is tested.

## Account setup before a release candidate

1. Keep Anonymous Authentication enabled so people can explore as guests. Enable Firebase Email/Password and Apple authentication for the release project. Configure Apple's provider in Firebase, the Sign in with Apple capability for `com.roblee.pbandb`, and a provisioning profile that includes that capability.
2. Create the `APPLE_SIGN_IN_TEAM_ID`, `APPLE_SIGN_IN_KEY_ID`, and `APPLE_SIGN_IN_PRIVATE_KEY` Firebase secrets for `deleteAccount`. The private key must remain in Secret Manager. The deletion callable uses a fresh Apple authorization code to exchange and revoke the user's Apple token before deleting records and the Firebase account.
3. Test registration, sign-in, password reset, sign-out, guest access, and account deletion on a physical iPhone with the release backend. After deletion, verify that Firebase Authentication, `scoutSubscriptions`, `scoutNotifications`, and the user's `agentUsage` documents are gone. Verify local saved ideas and imported screenshots are removed from that device. Test the email and Apple paths separately.
4. Record the tested app version/build and device OS. Provide a working review account or fully featured demo mode in App Store Connect. The requested screen recording must launch the app and show the account creation, sign-in, and deletion flows along with the ordinary discovery flow.

Account sign-in does not synchronize saved ideas across devices. Local state is separated by Firebase user ID on the device. The old single-device state is moved to the first identity that opens the upgraded app. When a guest signs into an existing account on the same device, its saved ideas are merged into that account's local state.

## Image reports and rights

The in-app Settings link and support page route image or listing reports to `hello@myomesh.ca`. A report should identify the image or listing, its source URL, and the reason for removal. Review it promptly, document the decision, and respond to the reporter.

For a weekly event thumbnail, add a document to Firestore collection `blockedImageSources` with ID `SHA-256` of the exact event `sourceUrl`. The deployed weekly-list service suppresses that source's image in cached responses and does not fetch it again. The event link and text can remain if appropriate. Existing offline phone caches may keep the old image until they refresh; for urgent reports, also remove the `imageUrl` from the affected `weeklyLocalEvents` cache document.

For a bundled app image, featured destination image, marketing banner, or App Store screenshot, remove or replace that specific asset or URL and distribute the updated app or metadata as needed. Keep a record of the rights or permission for any third-party imagery that remains. A credit, source link, disclaimer, or removal offer does not by itself establish permission to publish the image.
