import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOrganizerSubmission, ORGANIZER_IMAGE_PERMISSION_VERSION } from '../lib/organizerSubmissions.js';

const valid = () => ({ organizer: 'Example Events', legalBusinessName: 'Example Events Inc.', businessAddress: '123 Main St, Hamilton, ON', businessPhone: '905-555-0100', registrationNumber: '', contactName: 'Jordan Lee', websiteUrl: 'https://example.org', eventUrl: 'https://example.org/events/dance', title: 'Dance night', description: 'An evening of dancing.', city: 'Hamilton', province: 'Ontario', venue: 'Example Hall', address: '123 Main St', eventDate: '2026-12-10', eventTime: '19:00', price: 'CAD $20', imageUrls: ['https://example.org/dance.jpg'], authorized: true, imagePermission: true, imagePermissionVersion: ORGANIZER_IMAGE_PERMISSION_VERSION, promotionInterest: 'later', marketingConsent: false });
const now = new Date('2026-11-12T12:00:00Z');
test('accepts a source-linked event and records scoped image permission', () => {
  const parsed = parseOrganizerSubmission(valid(), now);
  assert.equal(parsed.eventUrl, 'https://example.org/events/dance');
  assert.equal(parsed.imagePermissionVersion, ORGANIZER_IMAGE_PERMISSION_VERSION);
  assert.equal(parsed.promotionInterest, 'later');
  assert.equal(parsed.marketingConsent, false);
});
test('rejects image links without current permission', () => {
  const data = valid(); data.imagePermission = false;
  assert.throws(() => parseOrganizerSubmission(data, now), /image permission/i);
});
test('rejects unsafe event and image links', () => {
  const data = valid(); data.eventUrl = 'http://example.org/event';
  assert.throws(() => parseOrganizerSubmission(data, now), /HTTPS links/i);
  const image = valid(); image.imageUrls = ['https://example.org/a.jpg', 'http://example.org/b.jpg'];
  assert.throws(() => parseOrganizerSubmission(image, now), /image links/i);
});
test('rejects past events and missing business details', () => {
  const past = valid(); past.eventDate = '2026-11-11';
  assert.throws(() => parseOrganizerSubmission(past, now), /within the next year/i);
  const business = valid(); business.legalBusinessName = '';
  assert.throws(() => parseOrganizerSubmission(business, now), /required event details/i);
});
