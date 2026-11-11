import { getAuth } from 'firebase-admin/auth';
import { FieldPath, getFirestore, type Query } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

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
}, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in before deleting your account.');
  const db = getFirestore();
  await db.collection('scoutSubscriptions').doc(uid).delete();
  await deleteMatchingDocuments(db.collection('scoutNotifications').where('uid', '==', uid));
  await deleteMatchingDocuments(db.collection('routeScoutCache').where('uid', '==', uid));
  await deleteMatchingDocuments(db.collection('catalogueUsage').orderBy(FieldPath.documentId()).startAt(`cities_${uid}_`).endAt(`cities_${uid}_\uf8ff`));
  for (const prefix of [`${uid}_`, `weeklyLocal_${uid}_`]) {
    await deleteMatchingDocuments(db.collection('agentUsage').orderBy(FieldPath.documentId()).startAt(prefix).endAt(`${prefix}\uf8ff`));
  }
  await getAuth().deleteUser(uid);
  return { deleted: true };
});
