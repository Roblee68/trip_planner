# PB&B Social terms review — draft

Status: product and legal draft published for review at PB&B’s `/terms` URL. It is not effective or accepted by members. Operator identified in the current PB&B privacy page: Myomesh Technologies Corp. Initial Social launch geography remains to be confirmed.

## Recommendation

Use an unchecked, affirmative **I agree to PB&B Terms of Use and Social rules** control when an adult first enables Social, plus a nearby plain-language acknowledgment that meeting other members and attending independent events has risks. Open the complete terms before acceptance. Record the member ID, terms version, and acceptance time on the server; require a new acceptance after a material change. Do not rely on a drawn signature or a generic “I waive all claims” checkbox. Ask Ontario counsel to decide whether a narrower release is appropriate and enforceable in each launch market before publishing it.

The terms should accurately say PB&B helps members find company but does not organize the third-party event, vet attendees, provide transportation, guarantee a group will form, or guarantee anyone will appear. They should also say what PB&B **does** control: accounts, matching, messaging, notifications, reports, blocks, and moderation. A liability clause must preserve rights and responsibilities that applicable law does not permit PB&B to exclude.

## Benchmarks

- [Bumble For Friends terms](https://bumble.com/bff/terms) put member conduct, reporting, no background or identity checks, member interactions, and risk/release language in their terms. Their [in-person safety guidance](https://support.bumble.com/hc/en-us/articles/28523315919005-Meeting-a-match-in-person) recommends a public venue and sharing plans with a trusted person.
- [Tinder terms](https://tinder.com/terms/intl/en/?lang=en) address no background or identity checks, in-person caution, user conduct, and liability limits in the terms. Its [safety guide](https://policies.tinder.com/web/safety-center/guide/basics/intl/en/) separately covers public meetings, independent transport, telling someone where you are, and reporting harmful behaviour.
- Neither public terms page establishes that PB&B can use the same release language or that a release would be enforceable for PB&B. Their terms are benchmarks for topics and signup presentation, not wording to copy.
- Ontario’s [Electronic Commerce Act](https://www.ontario.ca/laws/statute/00e17) recognizes electronic documents and signatures subject to its conditions. A versioned, affirmative click is more useful evidence of what a member saw and accepted than passive access to a web page. The Act does not decide whether a particular waiver of liability is enforceable.

## PB&B signup and record

1. Keep general discovery available without Social acceptance.
2. After verified sign-in, subscription entitlement, and age confirmation, show a short Social risk summary and links to the complete Terms, Privacy Policy, and community rules. All acceptance boxes start unchecked.
3. Save `uid`, `termsVersion`, `acceptedAt`, and the version of the Social rules in a server-controlled record. Do not accept a client-supplied timestamp as proof. Block Social list, create, join, and messaging actions when the current terms version has not been accepted.
4. On a material change, show the revised text and require a fresh affirmative acceptance before Social resumes. Retain the prior acceptance record according to a counsel-approved retention schedule.
5. Keep notification permission as a separate choice. Terms acceptance must not imply consent to push alerts or marketing.

## Before public launch

Have Ontario counsel review the draft [Terms page](../hosting/terms/index.html), the planned signup screen, jurisdiction and consumer-law rules for the launch markets, subscription and refund terms once pricing exists, and whether insurance is needed for a service that facilitates in-person meetups. Update the privacy page for Social profile, city preferences, messages, reports, blocks, moderation, and retention. Staff the reporting process and test it before enabling Social for real members.
