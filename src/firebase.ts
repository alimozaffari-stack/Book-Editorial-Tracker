import {
  createFirebaseRuntime,
  createGoogleAuthProvider,
  loginWithGoogle as loginWithGoogleWithRuntime,
  loginWithPassword as loginWithPasswordWithRuntime,
  logout as logoutWithRuntime,
  requestPasswordReset as requestPasswordResetWithRuntime,
  initializeAuthPersistence as initializeAuthPersistenceWithFirebaseRuntime,
  FirebaseRuntime,
} from './firebaseRuntime';
import { UserFirebaseProfile } from './domain/firebaseProfile';

let runtime: FirebaseRuntime | null = null;

function requireRuntime(): FirebaseRuntime {
  if (!runtime) {
    throw new Error('Firebase runtime has not been configured.');
  }
  return runtime;
}

export function setFirebaseRuntime(profile: UserFirebaseProfile): void {
  runtime = createFirebaseRuntime(profile);
}

export function clearFirebaseRuntime(): void {
  runtime = null;
}

export function getFirebaseRuntime(): FirebaseRuntime {
  if (!runtime) {
    throw new Error('Firebase runtime has not been configured.');
  }
  return runtime;
}

export function getFirebaseAuth() {
  return requireRuntime().auth;
}

export function getFirebaseDb() {
  return requireRuntime().db;
}

export const selectTeamFirebaseRuntime = (teamProfile: UserFirebaseProfile): void => {
  setFirebaseRuntime(teamProfile);
};

export const initializeAuthPersistence = () => initializeAuthPersistenceWithFirebaseRuntime(requireRuntime());

export const createGoogleProvider = () => createGoogleAuthProvider();

export const loginWithGoogle = () => loginWithGoogleWithRuntime(getFirebaseRuntime());

export const loginWithPassword = async (email: string, password: string) => {
  if (!email.trim() || !password) throw { code: 'auth/missing-email' };
  return loginWithPasswordWithRuntime(getFirebaseRuntime(), email.trim().toLowerCase(), password);
};

export const requestPasswordReset = (email: string) => {
  if (!email.trim()) throw { code: 'auth/missing-email' };
  return requestPasswordResetWithRuntime(getFirebaseRuntime(), email.trim().toLowerCase());
};

export const logout = () => logoutWithRuntime(getFirebaseRuntime());
