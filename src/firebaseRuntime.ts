import { FirebaseApp, FirebaseOptions, getApps, getApp, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence, signInWithPopup, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { UserFirebaseProfile } from './domain/firebaseProfile';

export interface FirebaseRuntime {
  app: FirebaseApp;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
}

function getRuntimeAppName(profile: UserFirebaseProfile): string {
  return `book-editorial-tracker:${profile.projectId}`;
}

export function createFirebaseRuntime(profile: UserFirebaseProfile): FirebaseRuntime {
  const runtimeName = getRuntimeAppName(profile);
  const apps = getApps();
  const existing = apps.find((app) => app.name === runtimeName);
  const app = existing ?? initializeApp(profile as FirebaseOptions, runtimeName);
  const auth = getAuth(app);
  const db = getFirestore(app, profile.firestoreDatabaseId);
  return { app: existing ? getApp(runtimeName) : app, auth, db };
}

export async function initializeAuthPersistence(runtime: FirebaseRuntime): Promise<void> {
  await setPersistence(runtime.auth, browserLocalPersistence);
}

export function createGoogleAuthProvider(): GoogleAuthProvider {
  return new GoogleAuthProvider();
}

export function loginWithGoogle(runtime: FirebaseRuntime) {
  const provider = createGoogleAuthProvider();
  return signInWithPopup(runtime.auth, provider);
}

export function loginWithPassword(runtime: FirebaseRuntime, email: string, password: string) {
  return signInWithEmailAndPassword(runtime.auth, email, password);
}

export function requestPasswordReset(runtime: FirebaseRuntime, email: string) {
  return sendPasswordResetEmail(runtime.auth, email);
}

export function logout(runtime: FirebaseRuntime) {
  return signOut(runtime.auth);
}
