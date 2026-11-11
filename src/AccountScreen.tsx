import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  accountErrorMessage, createEmailAccount, deleteCurrentAccount, ensureGuestAccount,
  resetEmailPassword, signInApple, signInEmail, signInGoogle, signOutAccount,
} from './account';
import { getScoutAuth } from './remoteScout';

export function AccountScreen({ onClose, onDeleted }: { onClose: () => void; onDeleted: (message: string) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'signin' | 'create'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getScoutAuth(), setUser);
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    return unsubscribe;
  }, []);

  const run = async (action: () => Promise<void>, success = '', method: 'email' | 'apple' | 'google' | 'other' = 'other') => {
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try { await action(); setPassword(''); setNotice(success); }
    catch (error) {
      const detail = accountErrorMessage(error, method);
      if (detail) {
        setErrorMessage(detail);
        Alert.alert(method === 'apple' ? 'Apple sign-in failed' : method === 'google' ? 'Google sign-in failed' : 'Account action failed', detail);
      }
    }
    finally { setBusy(false); }
  };

  const confirmDeletion = () => Alert.alert(
    'Delete account?',
    'This permanently deletes your account, service records, and saved items on this device. This cannot be undone.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete account', style: 'destructive', onPress: () => {
      if (user) {
        const usedApple = user.providerData.some(provider => provider.providerId === 'apple.com');
        const success = usedApple
          ? "Your PB&B account and saved data have been deleted. You can also remove PB&B access in your Apple Account's Sign in with Apple settings."
          : 'Your PB&B account and saved data have been deleted.';
        void run(async () => { await deleteCurrentAccount(user); onDeleted(success); });
      }
    } }],
  );

  const isRegistered = !!user && !user.isAnonymous;

  return <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.back}>‹ Back to Settings</Text></Pressable>
    <Text style={styles.title}>Your account</Text>
    <Text style={styles.lead}>Create an account, sign in, or keep using PB&B as a guest. Saved ideas stay on this device and do not sync across devices.</Text>
    {!!errorMessage && <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorTitle}>Something needs attention</Text><Text style={styles.errorText}>{errorMessage}</Text></View>}
    {!!notice && <Text style={styles.notice} accessibilityRole="alert">{notice}</Text>}

    {isRegistered ? <View style={styles.panel}>
      <Text style={styles.heading}>Signed in</Text>
      <Text style={styles.detail}>{user.email || 'Apple account'}</Text>
      <Pressable style={styles.button} onPress={() => void run(signOutAccount, 'Signed out. You can continue as a guest.')} disabled={busy} accessibilityRole="button"><Text style={styles.buttonText}>Sign out</Text></Pressable>
      <Pressable style={styles.deleteButton} onPress={confirmDeletion} disabled={busy} accessibilityRole="button"><Text style={styles.deleteText}>Delete account and data</Text></Pressable>
    </View> : <View style={styles.panel}>
      <View style={styles.modeRow}>
        <Pressable style={[styles.modeButton, mode === 'create' && styles.modeButtonActive]} onPress={() => { setMode('create'); setPassword(''); setErrorMessage(''); setNotice(''); }} disabled={busy} accessibilityRole="tab" accessibilityState={{ selected: mode === 'create' }}><Text style={styles.modeText}>Create account</Text></Pressable>
        <Pressable style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]} onPress={() => { setMode('signin'); setPassword(''); setErrorMessage(''); setNotice(''); }} disabled={busy} accessibilityRole="tab" accessibilityState={{ selected: mode === 'signin' }}><Text style={styles.modeText}>Sign in</Text></Pressable>
      </View>
      <Text style={styles.heading}>{mode === 'create' ? 'Create your account' : 'Welcome back'}</Text>
      <Text style={styles.modeHint}>{mode === 'create' ? 'New to PB&B? Create an account with a phone sign-in option or email.' : 'Already have an account? Use the method you chose when you created it.'}</Text>
      {Platform.OS === 'android' && <>
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Light}
          style={styles.googleButton}
          disabled={busy}
          onPress={() => { if (!busy) void run(signInGoogle, 'Signed in with Google.', 'google'); }}
          accessibilityLabel="Sign in with Google"
        />
        <Text style={styles.appleHint}>Google creates your PB&B account the first time you use it.</Text>
      </>}
      {appleAvailable && <>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={mode === 'create' ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={styles.appleButton}
          onPress={() => { if (!busy) void run(signInApple, 'Signed in with Apple.', 'apple'); }}
        />
        <Text style={styles.appleHint}>Apple creates your PB&B account the first time you use it.</Text>
      </>}
      {(appleAvailable || Platform.OS === 'android') && <Text style={styles.or}>or use email</Text>}
      <Text style={styles.fieldLabel}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#6B8588" keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Email" />
      <Text style={styles.fieldLabel}>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#6B8588" secureTextEntry autoComplete={mode === 'create' ? 'new-password' : 'current-password'} accessibilityLabel="Password" />
      <Pressable style={styles.button} onPress={() => void run(() => mode === 'create' ? createEmailAccount(email, password) : signInEmail(email, password), mode === 'create' ? 'Account created.' : 'Signed in.', 'email')} disabled={busy || !email.trim() || !password} accessibilityRole="button"><Text style={styles.buttonText}>{mode === 'create' ? 'Create account with email' : 'Sign in with email'}</Text></Pressable>
      {mode === 'signin' && <Pressable onPress={() => void run(() => resetEmailPassword(email), 'If this email has an account, a reset link has been sent.', 'email')} disabled={busy || !email.trim()} accessibilityRole="button"><Text style={styles.link}>Forgot password?</Text></Pressable>}
      <Pressable onPress={() => void run(async () => { await ensureGuestAccount(); onClose(); })} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Continue as guest</Text></Pressable>
    </View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { padding: 24, paddingBottom: 48, backgroundColor: '#F5F8F7', flexGrow: 1 },
  back: { color: '#103D46', fontWeight: '700', marginBottom: 20 },
  title: { color: '#103D46', fontSize: 34, fontWeight: '800', marginBottom: 10 },
  lead: { color: '#45656B', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  errorBox: { backgroundColor: '#FFF0EA', borderWidth: 2, borderColor: '#BB4A34', borderRadius: 10, padding: 16, marginBottom: 18 },
  errorTitle: { color: '#8A2020', fontSize: 17, fontWeight: '900', marginBottom: 5 },
  errorText: { color: '#603E3E', fontSize: 15, lineHeight: 22 },
  notice: { backgroundColor: '#E6F7F3', color: '#103D46', fontWeight: '700', padding: 14, borderRadius: 10, marginBottom: 18 },
  panel: { backgroundColor: '#FFFFFF', padding: 20, borderWidth: 1, borderColor: '#DCE8E4' },
  heading: { color: '#103D46', fontSize: 22, fontWeight: '800', marginBottom: 14 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  modeButton: { flex: 1, borderWidth: 1, borderColor: '#B8D2CD', borderRadius: 8, paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: '#B9ED5C', borderColor: '#103D46' },
  modeText: { color: '#103D46', fontWeight: '800', fontSize: 13 },
  modeHint: { color: '#45656B', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  detail: { color: '#45656B', marginBottom: 18 },
  fieldLabel: { color: '#103D46', fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#B8D2CD', borderRadius: 8, padding: 14, marginBottom: 12, color: '#103D46', backgroundColor: '#FFFFFF' },
  button: { backgroundColor: '#B9ED5C', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#103D46', fontWeight: '800' },
  appleButton: { height: 48, width: '100%', marginTop: 10 },
  googleButton: { height: 48, width: '100%', marginTop: 10 },
  appleHint: { color: '#45656B', fontSize: 12, lineHeight: 17, marginTop: 9, textAlign: 'center' },
  or: { textAlign: 'center', marginTop: 18, marginBottom: 16, color: '#45656B' },
  link: { color: '#103D46', fontWeight: '700', textAlign: 'center', marginTop: 18 },
  deleteButton: { borderWidth: 1, borderColor: '#AD3939', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 20 },
  deleteText: { color: '#8A2020', fontWeight: '800' },
  warning: { color: '#603E3E', lineHeight: 21, marginBottom: 14 },
});
