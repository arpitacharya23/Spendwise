import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0759268782",
  appId: "1:473262432159:web:1eea1cf6ba54297da9e7aa",
  apiKey: "AIzaSyD0OuPPT8Xz7BwIpkk3NFjVS1KYeB3h4ZE",
  authDomain: "gen-lang-client-0759268782.firebaseapp.com",
  storageBucket: "gen-lang-client-0759268782.firebasestorage.app",
  messagingSenderId: "473262432159",
  measurementId: "",
  oAuthClientId: "582951335862-ligh4200cq1m4l8rt7u1p4ssg0ilon27.apps.googleusercontent.com"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
