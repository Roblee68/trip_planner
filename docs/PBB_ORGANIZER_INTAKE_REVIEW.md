# PB&B organizer intake review

Status: first version of a private manual-review queue. Free event consideration is available; paid booking, payment, ad serving, and public organizer dashboards are not built.

## Where submissions go

- Public form: `/organizers/` on PB&B Firebase Hosting.
- Callable: `submitOrganizerEvent` in Toronto. Firebase Auth email verification and a non-consumer email domain are required. Maximum three submissions per account and ten per email domain per UTC day.
- Private Firestore collection: `organizerEventSubmissions`. Client rules deny reads and writes; only the backend creates records. `status` starts as `pendingReview`. The function does not publish to the `events` catalogue.
- Admin review for this version is in the Firebase Console under the project `tripplanner-910da`. Keep access limited to operators who review events. Record `reviewedAt`, `reviewedBy`, evidence URLs and decision before any separate catalogue or sponsorship action. Do not treat Firebase Console status edits as publication.

## Manual verification before any placement

1. Check the verified email domain and the business website. `businessDomainMatchesWebsite` is an initial triage hint, not proof. Investigate mismatches and impersonation.
2. Confirm the legal or trading name and status using the [Ontario Business Registry](https://www.ontario.ca/page/ontario-business-registry) or the relevant official provincial/federal registry. A registry match establishes existence, not that the submitter controls the business. If the business is a sole proprietor or informal organizer, request other independent proof of authority.
3. Independently open the submitted official event URL. Check event name, date, local start time, venue, public address, price, and booking destination. Do not accept a social post or screenshot alone. Verify any third-party ticket page from the organizer's own site.
4. Check each image link, image ownership/authorization statement, the event it depicts, and the permission version. Ask for original files or additional proof if the link is unstable or rights are unclear. Do not hotlink an image into the app merely because the organizer pasted a URL.
5. Reject or pause content with personal payment instructions, fake ticket sites, misleading scarcity, materially conflicting facts, or a cancelled event. Record the reason. Recheck accepted event sources before they appear in a time-sensitive feed.
6. A free submission can be considered for the normal catalogue only after editorial review. A sponsorship inquiry is a separate conversation; no payment or slot is reserved by this form. If a future paid campaign is approved, label each placement Sponsored and apply the campaign's city, dates, inventory, and cutoff rules.

## Image and contact requests

Image permission is scoped to the submitted event and PB&B app/website presentation. A linked image cannot be reused for another event. If an organizer withdraws permission, stop new uses and remove current placements after confirming the requester controls the verified account. Handle correction and deletion requests from the verified business email. Optional future sponsorship emails require `marketingConsent: true`; `promotionInterest: later` alone is not permission for a mailing list. A direct `promotionInterest: now` request may be answered about that event.

## Operational limits

The first form collects HTTPS image links rather than files. A separate secure file-upload path can be added after storage and scanning are configured. The first version does not send automatic reviewer notifications or provide a self-service status page, so operators must check the review collection regularly. Never publish a submission directly from the queue without source and rights checks.
