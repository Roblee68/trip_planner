import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  accountErrorMessage, createEmailAccount, deleteCurrentAccount, ensureGuestAccount,
  resetEmailPassword, signInApple, signInEmail, signOutAccount,
} from './account';
import { getScoutAuth } from './remoteScout';

export function AccountScreen({ onClose }: { onClose: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getScoutAuth(), setUser);
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    return unsubscribe;
  }, []);

  const run = async (action: () => Promise<void>, success = '') => {
    setBusy(true);
    setMessage('');
    try { await action(); setPassword(''); setMessage(success); }
    catch (error) { setMessage(accountErrorMessage(error)); }
    finally { setBusy(false); }
  };

  const confirmDeletion = () => Alert.alert(
    'Delete account?',
    'This permanently deletes your account, service records, and saved items on this device. This cannot be undone.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete account', style: 'destructive', onPress: () => { setDeleting(true); setMessage(''); } }],
  );

  const isRegistered = !!user && !user.isAnonymous;
  const hasEmailPassword = !!user?.providerData.some(provider => provider.providerId === 'password');
  const hasApple = !!user?.providerData.some(provider => provider.providerId === 'apple.com');

  return <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.back}>‹ Back to Settings</Text></Pressable>
    <Text style={styles.title}>Your account</Text>
    <Text style={styles.lead}>Keep using PB&B as a guest, or sign in. Saved ideas stay on this device and do not sync across devices.</Text>

    {isRegistered ? <View style={styles.panel}>
      <Text style={styles.heading}>Signed in</Text>
      <Text style={styles.detail}>{user.email || 'Apple account'}</Text>
      {!deleting ? <>
        <Pressable style={styles.button} onPress={() => void run(signOutAccount, 'Signed out. You can continue as a guest.')} disabled={busy} accessibilityRole="button"><Text style={styles.buttonText}>Sign out</Text></Pressable>
        <Pressable style={styles.deleteButton} onPress={confirmDeletion} disabled={busy} accessibilityRole="button"><Text style={styles.deleteText}>Delete account and data</Text></Pressable>
      </> : <>
        <Text style={styles.warning}>Confirm your identity to permanently delete this account and its service records.</Text>
        {hasApple && appleAvailable ? <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={styles.appleButton}
          onPress={() => void run(() => deleteCurrentAccount(user, 'apple'))}
        /> : hasEmailPassword ? <>
          <Text style={styles.fieldLabel}>Account password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Account password" placeholderTextColor="#6B8588" secureTextEntry autoComplete="current-password" accessibilityLabel="Account password" />
          <Pressable style={styles.deleteButton} onPress={() => void run(() => deleteCurrentAccount(user, 'email', password))} disabled={busy || !password} accessibilityRole="button"><Text style={styles.deleteText}>Permanently delete account</Text></Pressable>
        </> : <Text style={styles.warning}>The sign-in method for this account is unavailable on this device.</Text>}
        <Pressable onPress={() => setDeleting(false)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Cancel deletion</Text></Pressable>
      </>}
    </View> : <View style={styles.panel}>
      <Text style={styles.heading}>{mode === 'create' ? 'Create account' : 'Sign in'}</Text>
      <Text style={styles.fieldLabel}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#6B8588" keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Email" />
      <Text style={styles.fieldLabel}>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#6B8588" secureTextEntry autoComplete={mode === 'create' ? 'new-password' : 'current-password'} accessibilityLabel="Password" />
      <Pressable style={styles.button} onPress={() => void run(() => mode === 'create' ? createEmailAccount(email, password) : signInEmail(email, password), mode === 'create' ? 'Account created.' : 'Signed in.')} disabled={busy || !email.trim() || !password} accessibilityRole="button"><Text style={styles.buttonText}>{mode === 'create' ? 'Create account' : 'Sign in'}</Text></Pressable>
      <Pressable onPress={() => { setMode(mode === 'create' ? 'signin' : 'create'); setMessage(''); setPassword(''); }} disabled={busy} accessibilityRole="button"><Text style={styles.link}>{mode === 'create' ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text></Pressable>
      {mode === 'signin' && <Pressable onPress={() => void run(() => resetEmailPassword(email), 'If this email has an account, a reset link has been sent.')} disabled={busy || !email.trim()} accessibilityRole="button"><Text style={styles.link}>Forgot password?</Text></Pressable>}
      {appleAvailable && <>
        <Text style={styles.or}>or</Text>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={styles.appleButton}
          onPress={() => void run(signInApple, 'Signed in with Apple.')}
        />
      </>}
      <Pressable onPress={() => {
        setBusy(true);
        setMessage('');
        void ensureGuestAccount().then(onClose).catch(error => setMessage(accountErrorMessage(error))).finally(() => setBusy(false));
      }} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Continue as guest</Text></Pressable>
    </View>}
    {!!message && <Text style={styles.message} accessibilityRole="alert">{message}</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { padding: 24, paddingBottom: 48, backgroundColor: '#F5F8F7', flexGrow: 1 },
  back: { color: '#103D46', fontWeight: '700', marginBottom: 20 },
  title: { color: '#103D46', fontSize: 34, fontWeight: '800', marginBottom: 10 },
  lead: { color: '#45656B', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  panel: { backgroundColor: '#FFFFFF', padding: 20, borderWidth: 1, borderColor: '#DCE8E4' },
  heading: { color: '#103D46', fontSize: 22, fontWeight: '800', marginBottom: 14 },
  detail: { color: '#45656B', marginBottom: 18 },
  fieldLabel: { color: '#103D46', fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#B8D2CD', borderRadius: 8, padding: 14, marginBottom: 12, color: '#103D46', backgroundColor: '#FFFFFF' },
  button: { backgroundColor: '#B9ED5C', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#103D46', fontWeight: '800' },
  appleButton: { height: 48, width: '100%', marginTop: 10 },
  or: { textAlign: 'center', marginTop: 18, color: '#45656B' },
  link: { color: '#103D46', fontWeight: '700', textAlign: 'center', marginTop: 18 },
  deleteButton: { borderWidth: 1, borderColor: '#AD3939', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 20 },
  deleteText: { color: '#8A2020', fontWeight: '800' },
  warning: { color: '#603E3E', lineHeight: 21, marginBottom: 14 },
  message: { color: '#103D46', marginTop: 18, lineHeight: 21 },
});
