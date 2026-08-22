import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
} from 'firebase/auth';

// Firebase configuration - same project as Portfolio Management and GPT frontend
const firebaseConfig = {
  apiKey: "AIzaSyCYmWOIuWmuZ0SK_q1SrJRhYIPfx0CyQOk",
  authDomain: "transledgersite.firebaseapp.com",
  databaseURL: "https://transledgersite.firebaseio.com",
  projectId: "transledgersite",
  storageBucket: "transledgersite.firebasestorage.app",
  messagingSenderId: "809533058456",
  appId: "1:809533058456:web:7cc07b837befbf28a04fed",
  measurementId: "G-FH0NFVW4KQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Auth providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

export interface FirebaseUserData {
  email: string;
  first_name: string;
  last_name: string;
  firebase_uid: string;
  provider: 'google' | 'facebook';
  photoURL?: string;
}

export async function signInWithGoogle(): Promise<{ idToken: string; userData: FirebaseUserData }> {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();

  const displayName = result.user.displayName || '';
  const nameParts = displayName.split(' ');

  return {
    idToken,
    userData: {
      email: result.user.email || '',
      first_name: nameParts[0] || '',
      last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
      firebase_uid: result.user.uid,
      provider: 'google',
      photoURL: result.user.photoURL || undefined,
    },
  };
}

export async function signInWithFacebook(): Promise<{ idToken: string; userData: FirebaseUserData }> {
  const result = await signInWithPopup(auth, facebookProvider);
  const idToken = await result.user.getIdToken();

  const displayName = result.user.displayName || '';
  const nameParts = displayName.split(' ');

  return {
    idToken,
    userData: {
      email: result.user.email || '',
      first_name: nameParts[0] || '',
      last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
      firebase_uid: result.user.uid,
      provider: 'facebook',
      photoURL: result.user.photoURL || undefined,
    },
  };
}

export { auth };
