import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js';

const $ = id => document.getElementById(id);
const authStatus = $('auth-status');
const formStatus = $('form-status');
const show = (element, message, error = false) => { element.textContent = message; element.classList.toggle('error', error); };
let auth;
let submitEvent;
try {
  const configResponse = await fetch('/__/firebase/init.json', { cache: 'no-store' });
  if (!configResponse.ok) throw new Error('The organizer service is unavailable. Please try again later.');
  const app = initializeApp(await configResponse.json());
  auth = getAuth(app);
  submitEvent = httpsCallable(getFunctions(app, 'northamerica-northeast2'), 'submitOrganizerEvent');
  onAuthStateChanged(auth, user => {
    $('signed-out').hidden = !!user;
    $('signed-in').hidden = !user;
    $('event-fields').disabled = !user?.emailVerified;
    if (user) {
      $('account-state').textContent = `${user.email} · ${user.emailVerified ? 'email verified' : 'email verification required'}`;
      $('send-verification').hidden = user.emailVerified;
      $('refresh-verification').hidden = user.emailVerified;
      show(authStatus, user.emailVerified ? 'Your email is verified. Complete the event form below.' : 'Open the verification link in your email, then return and select “I’ve verified my email.”');
    } else show(authStatus, 'Create an account or sign in to unlock the form.');
  });
} catch (error) { show(authStatus, error.message || 'The organizer service is unavailable.', true); }
const personalDomains = new Set(['gmail.com','googlemail.com','yahoo.com','yahoo.ca','outlook.com','hotmail.com','hotmail.ca','live.com','icloud.com','me.com','aol.com','proton.me','protonmail.com']);
const authInput = () => ({ email: $('account-email').value.trim(), password: $('account-password').value });
const authError = error => error?.code === 'auth/email-already-in-use' ? 'An account already uses that email. Sign in instead.' : error?.code === 'auth/invalid-credential' ? 'Check your email and password.' : error?.message || 'The account action failed.';
$('register').addEventListener('click', async () => {
  if (!auth) return;
  const { email, password } = authInput();
  if (!email || password.length < 10) return show(authStatus, 'Enter a business email and a password of at least 10 characters.', true);
  if (personalDomains.has(email.split('@')[1]?.toLowerCase())) return show(authStatus, 'Use your business-domain email address, not a personal email provider.', true);
  try { const result = await createUserWithEmailAndPassword(auth, email, password); await sendEmailVerification(result.user); show(authStatus, 'Verification email sent. Open the link, then return here.'); }
  catch (error) { show(authStatus, authError(error), true); }
});
$('sign-in').addEventListener('click', async () => {
  if (!auth) return;
  const { email, password } = authInput();
  try { await signInWithEmailAndPassword(auth, email, password); $('account-password').value = ''; }
  catch (error) { show(authStatus, authError(error), true); }
});
$('send-verification').addEventListener('click', async () => {
  try { await sendEmailVerification(auth.currentUser); show(authStatus, 'Verification email sent.'); }
  catch (error) { show(authStatus, authError(error), true); }
});
$('refresh-verification').addEventListener('click', async () => {
  try { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); $('event-fields').disabled = !auth.currentUser.emailVerified; $('account-state').textContent = `${auth.currentUser.email} · ${auth.currentUser.emailVerified ? 'email verified' : 'email verification required'}`; show(authStatus, auth.currentUser.emailVerified ? 'Verified. You can now submit your event.' : 'This email is not verified yet. Check your inbox.'); }
  catch (error) { show(authStatus, authError(error), true); }
});
$('sign-out').addEventListener('click', () => signOut(auth));
$('event-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!auth?.currentUser || !submitEvent) return show(formStatus, 'Sign in and verify your business email first.', true);
  const imageUrls = [$('image1').value, $('image2').value, $('image3').value].map(value => value.trim()).filter(Boolean);
  if (imageUrls.length && !$('imagePermission').checked) return show(formStatus, 'Confirm image permission before submitting image links.', true);
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  $('submit-button').disabled = true;
  show(formStatus, 'Sending your event privately for review…');
  try {
    await auth.currentUser.reload();
    if (!auth.currentUser.emailVerified) throw new Error('Verify your business email before submitting.');
    await auth.currentUser.getIdToken(true);
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.image1; delete data.image2; delete data.image3;
    data.imageUrls = imageUrls;
    data.authorized = $('authorized').checked;
    data.imagePermission = $('imagePermission').checked;
    data.imagePermissionVersion = '2026-11-12-v1';
    data.marketingConsent = $('marketingConsent').checked;
    const result = await submitEvent(data);
    form.reset();
    show(formStatus, `Received for review. Reference: ${result.data.submissionId}. This is not a published listing or paid booking.`);
  } catch (error) { show(formStatus, error?.message || 'The event could not be sent. Please try again.', true); }
  finally { $('submit-button').disabled = false; }
});
