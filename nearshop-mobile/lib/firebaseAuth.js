/**
 * Firebase Auth for React Native
 * Providers: Phone OTP, Google, Apple, Email/Password
 */
import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import client from './api';

// ---------------------------------------------------------------------------
// Google Sign-In setup
// webClientId comes from Firebase Console → Authentication → Google → Web SDK config
// Replace with actual value from: Firebase Console → Project Settings → Web API client
// ---------------------------------------------------------------------------
GoogleSignin.configure({
  webClientId: '880214447785-t6930j38p2asatsa9dka5n69eperthba.apps.googleusercontent.com',
});

// ---------------------------------------------------------------------------
// Phone OTP (module-level _confirmation can't travel through expo-router params)
// ---------------------------------------------------------------------------
let _confirmation = null;

export const getConfirmation = () => _confirmation;
export const clearConfirmation = () => { _confirmation = null; };

export async function sendFirebaseOtp(phoneE164) {
  const confirmation = await auth().signInWithPhoneNumber(phoneE164);
  _confirmation = confirmation;
}

export async function verifyFirebaseOtp(code) {
  if (!_confirmation) throw new Error('No OTP session. Please request a new OTP.');
  const result = await _confirmation.confirm(code);
  const idToken = await result.user.getIdToken();
  _confirmation = null;
  return exchangeToken(idToken);
}

// ---------------------------------------------------------------------------
// Google Sign-In
// ---------------------------------------------------------------------------
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResult = await GoogleSignin.signIn();
  // Support both old and new SDK response shapes
  const idToken = signInResult.data?.idToken ?? signInResult.idToken;
  if (!idToken) throw new Error('Google Sign-In did not return an ID token.');
  const credential = auth.GoogleAuthProvider.credential(idToken);
  const result = await auth().signInWithCredential(credential);
  const firebaseToken = await result.user.getIdToken();
  return exchangeToken(firebaseToken);
}

// ---------------------------------------------------------------------------
// Apple Sign-In (iOS only — no-op on Android)
// ---------------------------------------------------------------------------
export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS devices.');
  }
  const appleAuth = require('@invertase/react-native-apple-authentication').default;
  const appleAuthAndroidRequest = null; // not used on iOS

  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  const { identityToken, nonce } = appleAuthRequestResponse;
  if (!identityToken) throw new Error('Apple Sign-In failed — no identity token.');

  const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
  const result = await auth().signInWithCredential(appleCredential);
  const firebaseToken = await result.user.getIdToken();
  return exchangeToken(firebaseToken);
}

// ---------------------------------------------------------------------------
// Email / Password
// ---------------------------------------------------------------------------
export async function signInWithEmail(email, password) {
  const result = await auth().signInWithEmailAndPassword(email, password);
  const firebaseToken = await result.user.getIdToken();
  return exchangeToken(firebaseToken);
}

export async function registerWithEmail(email, password) {
  const result = await auth().createUserWithEmailAndPassword(email, password);
  const firebaseToken = await result.user.getIdToken();
  return exchangeToken(firebaseToken);
}

// ---------------------------------------------------------------------------
// Shared: exchange Firebase ID token for NearShop JWT
// ---------------------------------------------------------------------------
async function exchangeToken(firebaseToken) {
  const { data } = await client.post('/auth/firebase-signin', { firebase_token: firebaseToken });
  return data; // { user, access_token, refresh_token, is_new_user }
}
