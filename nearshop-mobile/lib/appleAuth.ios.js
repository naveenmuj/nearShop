import appleAuth from '@invertase/react-native-apple-authentication';

export async function signInWithAppleNative({ auth, exchangeToken }) {
  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  const { identityToken, nonce } = appleAuthRequestResponse;
  if (!identityToken) {
    throw new Error('Apple Sign-In failed — no identity token.');
  }

  const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
  const result = await auth().signInWithCredential(appleCredential);
  const firebaseToken = await result.user.getIdToken();
  return exchangeToken(firebaseToken);
}
