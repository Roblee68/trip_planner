import assert from 'node:assert/strict';
import test from 'node:test';
import { sourcePreviewImage } from '../lib/sourceImage.js';

test('event preview uses only public HTTPS images declared on the source page', () => {
  const source = 'https://organizer.example/events/pottery';
  assert.equal(sourcePreviewImage('<meta property="og:image" content="/images/pottery.jpg">', source), 'https://organizer.example/images/pottery.jpg');
  assert.equal(sourcePreviewImage('<meta property="og:image" content="http://organizer.example/image.jpg">', source), '');
  assert.equal(sourcePreviewImage('<meta name="twitter:image" content="https://127.0.0.1/private.jpg">', source), '');
});
