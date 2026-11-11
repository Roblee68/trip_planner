import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import {
  EmailAuthProvider, GoogleAuthProvider, OAuthProvider, createUserWithEmailAndPassword, linkWithCredential,
  reauthenticateWithCredential, sendPasswordResetEmail, signInWithCredential,
  signInWithEmailAndPassword, signOut, type AuthCredential, type User,
} from 'firebase/auth';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ensureScoutGuestAuth, getScoutAuth } from './remoteScout';

export const localStateKey = (uid: string) => `pbb-local-state-v1:${uid}`;
const GOOGLE_WEB_CLIENT_ID = '309339870134-lk67n07knq1jtfl5tvedhuft7aj1ptuk.apps.googleusercontent.com';
let googleConfigured = false;

export async function mergeGuestLocalState(guestUid: string, accountUid: string): Promise<void> {
  if (guestUid === accountUid) return;
  const guestKey = localStateKey(guestUid);
  const guestRaw = await AsyncStorage.getItem(guestKey);
  if (!guestRaw) return;
  const accountKey = localStateKey(accountUid);
  const accountRaw = await AsyncStorage.getItem(accountKey);
  if (!accountRaw) { await AsyncStorage.setItem(accountKey, guestRaw); await AsyncStorage.removeItem(guestKey); return; }
  const guest = JSON.parse(guestRaw) as Record<string, unknown>;
  const account = JSON.parse(accountRaw) as Record<string, unknown>;
  const mergeById = (left: unknown, right: unknown) => {
    const items = [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])];
    return [...new Map(items.filter(item => item && typeof item.id === 'string').map(item => [item.id, item])).values()];
  };
  const merged = {
    ...guest, ...account,
    feedback: { ...(guest.feedback as object ?? {}), ...(account.feedback as object ?? {}) },
    savedIds: [...new Set([...(Array.isArray(account.savedIds) ? account.savedIds : []), ...(Array.isArray(guest.savedIds) ? guest.savedIds : [])])],
    savedItems: mergeById(guest.savedItems, account.savedItems),
    savedWebIdeas: mergeById(guest.savedWebIdeas, account.savedWebIdeas),
    importedFinds: mergeById(guest.importedFinds, account.importedFinds),
    likedExamples: mergeById(guest.likedExamples, account.likedExamples),
  };
  await AsyncStorage.setItem(accountKey, JSON.stringify(merged));
  await AsyncStorage.removeItem(guestKey);
}

export async function createEmailAccount(email: string, password: string): Promise<void> {
  const auth = getScoutAuth();
  await auth.authStateReady();
  const normalizedEmail = email.trim().toLowerCase();
  if (auth.currentUser?.isAnonymous) {
    await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(normalizedEmail, password));
  } else {
    await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  }
}

export async function signInEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getScoutAuth(), email.trim().toLowerCase(), password);
}

export async function resetEmailPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getScoutAuth(), email.trim().toLowerCase());
}

async function appleCredential(): Promise<{ credential: AuthCredential; authorizationCode: string }> {
  if (!(await AppleAuthentication.isAvailableAsync())) throw new Error('Sign in with Apple is unavailable on this device.');
  const rawNonce = Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const result = await AppleAuthentication.signInAsync({
    nonce: hashedNonce,
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!result.identityToken || !result.authorizationCode) throw new Error('Apple did not return the credentials needed to sign in.');
  return {
    credential: new OAuthProvider('apple.com').credential({ idToken: result.identityToken, rawNonce }),
    authorizationCode: result.authorizationCode,
  };
}

export async function signInApple(): Promise<void> {
  const auth = getScoutAuth();
  await auth.authStateReady();
  const { credential } = await appleCredential();
  if (auth.currentUser?.isAnonymous) {
    try { await linkWithCredential(auth.currentUser, credential); return; }
    catch (error) {
      if ((error as { code?: string })?.code !== 'auth/credential-already-in-use') throw error;
    }
  }
  await signInWithCredential(auth, credential);
}

async function googleCredential(): Promise<AuthCredential> {
  if (Platform.OS !== 'android') throw new Error('Google sign-in is available on Android.');
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    googleConfigured = true;
  }
  if (!(await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }))) throw new Error('Google Play services are needed to sign in.');
  const result = await GoogleSignin.signIn();
  if (result.type === 'cancelled') throw Object.assign(new Error('Google sign-in cancelled.'), { code: 'SIGN_IN_CANCELLED' });
  if (!result.data.idToken) throw new Error('Google did not return the credentials needed to sign in.');
  return GoogleAuthProvider.credential(result.data.idToken);
}

export async function signInGoogle(): Promise<void> {
  const auth = getScoutAuth();
  await auth.authStateReady();
  const credential = await googleCredential();
  if (auth.currentUser?.isAnonymous) {
    try { await linkWithCredential(auth.currentUser, credential); return; }
    catch (error) {
      if ((error as { code?: string })?.code !== 'auth/credential-already-in-use') throw error;
    }
  }
  await signInWithCredential(auth, credential);
}

export async function signOutAccount(): Promise<void> {
  await signOut(getScoutAuth());
}

async function removeLocalAccountData(uid: string): Promise<void> {
  const key = localStateKey(uid);
  const raw = await AsyncStorage.getItem(key);
  if (raw) {
    try {
      const state = JSON.parse(raw) as { importedFinds?: { imageUri?: string | null }[] };
      for (const find of state.importedFinds ?? []) {
        if (find.imageUri?.includes('/imported-finds/')) {
          await FileSystem.deleteAsync(find.imageUri, { idempotent: true }).catch(() => {});
        }
      }
    } catch { /* The account record may be from an older app version. */ }
  }
  await AsyncStorage.removeItem(key);
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

export async function deleteCurrentAccount(user: User, method: 'email' | 'apple' | 'google', password = ''): Promise<void> {
  const auth = getScoutAuth();
  if (auth.currentUser?.uid !== user.uid || user.isAnonymous) throw new Error('Sign in to the account you want to delete.');
  let appleAuthorizationCode: string | undefined;
  if (method === 'email') {
    if (!user.email || !password) throw new Error('Enter your password to confirm deletion.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else if (method === 'apple') {
    const apple = await appleCredential();
    await reauthenticateWithCredential(user, apple.credential);
    appleAuthorizationCode = apple.authorizationCode;
  } else {
    await reauthenticateWithCredential(user, await googleCredential());
  }
  await user.getIdToken(true);
  const call = httpsCallable<{ appleAuthorizationCode?: string }, { deleted: boolean }>(
    getFunctions(getApp(), 'northamerica-northeast2'), 'deleteAccount', { timeout: 120_000 },
  );
  const result = await call({ appleAuthorizationCode });
  if (!result.data.deleted) throw new Error('Account deletion could not be confirmed. Please try again.');
  await removeLocalAccountData(user.uid);
  await signOut(auth).catch(() => {});
  if (method === 'google') await GoogleSignin.signOut().catch(() => {});
}

export async function ensureGuestAccount(): Promise<void> {
  await ensureScoutGuestAuth(getScoutAuth());
}

export function accountErrorMessage(error: unknown, method: 'email' | 'apple' | 'google' | 'other' = 'other'): string {
  const code = (error as { code?: string })?.code;
  if (code === 'ERR_REQUEST_CANCELED' || code === 'SIGN_IN_CANCELLED' || code === '12501') return '';
  if (code === 'auth/email-already-in-use') return 'An account already uses this email. Choose Sign in instead.';
  if (code === 'auth/weak-password') return 'Choose a longer password.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/invalid-credential') return method === 'apple' ? 'Apple sign-in could not be verified. Please try again. If it keeps failing, contact PB&B support.' : method === 'google' ? 'Google sign-in could not be verified. Please try again.' : 'The email or password did not match. If you are new, choose Create account.';
  if (code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'The email or password did not match. If you are new, choose Create account.';
  if (code === 'auth/operation-not-allowed') return method === 'apple' ? 'Apple sign-in is not available right now. Please contact PB&B support.' : method === 'google' ? 'Google sign-in is not available right now. Please contact PB&B support.' : 'This sign-in method is not available right now. Please contact PB&B support.';
  if (code === 'DEVELOPER_ERROR' || code === '10') return 'Google sign-in needs a configuration update. Please contact PB&B support.';
  if (code === 'auth/missing-or-invalid-nonce') return 'Apple sign-in could not be verified. Please contact PB&B support.';
  if (code === 'auth/requires-recent-login') return 'Please sign in again, then retry account deletion.';
  if (code === 'auth/credential-already-in-use') return 'This Apple account is already linked to another account. Sign in with Apple instead.';
  if (code === 'auth/account-exists-with-different-credential') return 'An account already uses this email. Sign in with its existing method.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
