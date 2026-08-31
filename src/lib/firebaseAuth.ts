import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0759268782",
  appId: "1:473262432159:web:1eea1cf6ba54297da9e7aa",
  apiKey: "AIzaSyD0OuPPT8Xz7BwIpkk3NFjVS1KYeB3h4ZE",
  authDomain: "gen-lang-client-0759268782.firebaseapp.com",
  storageBucket: "gen-lang-client-0759268782.firebasestorage.app",
  messagingSenderId: "473262432159",
  measurementId: "",
  oAuthClientId: "473262432159-emgnhdceo12kk1hv63ea859ekg7jtvbh.apps.googleusercontent.com"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export async function requestGoogleWorkspaceToken(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline'
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  
  if (!credential?.accessToken) {
    throw new Error('No access token returned from Google authorization.');
  }

  return credential.accessToken;
}
