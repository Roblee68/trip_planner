import { createPrivateKey, sign } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, getFirestore, type Query } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const appleTeamId = defineSecret('APPLE_SIGN_IN_TEAM_ID');
const appleKeyId = defineSecret('APPLE_SIGN_IN_KEY_ID');
const applePrivateKey = defineSecret('APPLE_SIGN_IN_PRIVATE_KEY');
const appleClientId = 'com.roblee.pbandb';

function appleClientSecret(): string {
  const teamId = appleTeamId.value();
  const keyId = appleKeyId.value();
  const privateKey = applePrivateKey.value().replace(/\\n/g, '\n');
  if (!teamId || !keyId || !privateKey) throw new HttpsError('failed-precondition', 'Apple account deletion is not configured.');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: appleClientId })).toString('base64url');
  const message = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(message), { key: createPrivateKey(privateKey), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${message}.${signature}`;
}

async function revokeAppleAuthorization(code: string, appleUserId: string): Promise<void> {
  const clientSecret = appleClientSecret();
  const exchange = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: appleClientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }),
  });
  const token = await exchange.json() as { access_token?: string; id_token?: string };
  if (!exchange.ok || !token.access_token || !token.id_token) throw new HttpsError('failed-precondition', 'Apple could not confirm the account. Sign in with Apple again and retry.');
  let subject: string;
  try { subject = (JSON.parse(Buffer.from(token.id_token.split('.')[1], 'base64url').toString()) as { sub: string }).sub; }
  catch { throw new HttpsError('failed-precondition', 'Apple returned an invalid identity.'); }
  if (subject !== appleUserId) throw new HttpsError('permission-denied', 'The Apple account does not match this PB&B account.');
  const revoke = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: appleClientId, client_secret: clientSecret, token: token.access_token, token_type_hint: 'access_token' }),
  });
  if (!revoke.ok) throw new HttpsError('unavailable', 'Apple access could not be revoked. Please retry deletion.');
}

async function deleteMatchingDocuments(query: Query): Promise<void> {
  while (true) {
    const page = await query.limit(400).get();
    if (page.empty) return;
    const batch = getFirestore().batch();
    for (const doc of page.docs) batch.delete(doc.ref);
    await batch.commit();
  }
}

export const deleteAccount = onCall({
  region: 'northamerica-northeast2', invoker: 'public', timeoutSeconds: 120,
  secrets: [appleTeamId, appleKeyId, applePrivateKey],
}, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in before deleting your account.');
  const authTime = Number(request.auth?.token.auth_time ?? 0);
  if (!authTime || Date.now() / 1000 - authTime > 300) throw new HttpsError('failed-precondition', 'Sign in again before deleting your account.');
  const user = await getAuth().getUser(uid);
  const appleUser = user.providerData.find(provider => provider.providerId === 'apple.com');
  if (appleUser) {
    const code = request.data?.appleAuthorizationCode;
    if (typeof code !== 'string' || !code || code.length > 4096) throw new HttpsError('invalid-argument', 'Sign in with Apple again before deletion.');
    await revokeAppleAuthorization(code, appleUser.uid);
  }
  const db = getFirestore();
  await db.collection('scoutSubscriptions').doc(uid).delete();
  await deleteMatchingDocuments(db.collection('scoutNotifications').where('uid', '==', uid));
  for (const prefix of [`${uid}_`, `weeklyLocal_${uid}_`]) {
    await deleteMatchingDocuments(db.collection('agentUsage').orderBy(FieldPath.documentId()).startAt(prefix).endAt(`${prefix}\uf8ff`));
  }
  await getAuth().deleteUser(uid);
  return { deleted: true };
});
