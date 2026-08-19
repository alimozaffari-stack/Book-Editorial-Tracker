export interface UserFirebaseProfile {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

const MAX_PROFILE_FIELD_LENGTH = 256;
const ALLOWED_KEYS: Array<keyof UserFirebaseProfile> = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
  'firestoreDatabaseId',
];

const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;

function isBoundedPlainString(value: unknown, maxLength: number): value is string {
  if (typeof value !== 'string') return false;
  if (value.length < 1 || value.length > maxLength) return false;
  if (CONTROL_CHAR_REGEX.test(value)) return false;
  return value === value.trim();
}

function isSafeProfileIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function isSafeAppId(value: string): boolean {
  return /^1:[0-9]+:(web|android|ios):[A-Za-z0-9]+$/i.test(value);
}

function isSafeAuthDomain(value: string): boolean {
  if (!value.startsWith('https://')) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return false;
    if (!parsed.hostname || parsed.hostname.includes(':')) return false;
    return true;
  } catch {
    return false;
  }
}

function isSafeProjectId(value: string): boolean {
  return /^[a-z0-9-]{6,128}$/.test(value);
}

function asUserFirebaseProfile(value: Record<string, unknown>): UserFirebaseProfile {
  const keys = Object.keys(value);
  const unknownKeys = keys.filter((key) => !ALLOWED_KEYS.includes(key as keyof UserFirebaseProfile));
  if (unknownKeys.length > 0) {
    throw new Error('Profile contains unknown field names.');
  }

  const apiKey = value.apiKey;
  const authDomain = value.authDomain;
  const projectId = value.projectId;
  const appId = value.appId;
  const firestoreDatabaseId = value.firestoreDatabaseId;

  if (!isBoundedPlainString(apiKey, MAX_PROFILE_FIELD_LENGTH) || !isSafeProfileIdentifier(apiKey)) {
    throw new Error('Firebase profile apiKey is invalid.');
  }
  if (!isBoundedPlainString(authDomain, MAX_PROFILE_FIELD_LENGTH) || !isSafeAuthDomain(authDomain)) {
    throw new Error('Firebase profile authDomain is invalid.');
  }
  if (!isBoundedPlainString(projectId, MAX_PROFILE_FIELD_LENGTH) || !isSafeProjectId(projectId)) {
    throw new Error('Firebase profile projectId is invalid.');
  }
  if (!isBoundedPlainString(appId, MAX_PROFILE_FIELD_LENGTH) || !isSafeAppId(appId)) {
    throw new Error('Firebase profile appId is invalid.');
  }
  if (firestoreDatabaseId !== undefined) {
    if (!isBoundedPlainString(firestoreDatabaseId, MAX_PROFILE_FIELD_LENGTH) || !isSafeProjectId(firestoreDatabaseId)) {
      throw new Error('Firebase profile firestoreDatabaseId is invalid.');
    }
    return {
      apiKey,
      authDomain,
      projectId,
      appId,
      firestoreDatabaseId,
    };
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
  };
}

export function parseUserFirebaseProfile(rawProfile: unknown): UserFirebaseProfile {
  if (!rawProfile || typeof rawProfile !== 'object' || Array.isArray(rawProfile)) {
    throw new Error('Firebase profile must be an object.');
  }
  const profile = rawProfile as Record<string, unknown>;
  if (!('apiKey' in profile) || !('authDomain' in profile) || !('projectId' in profile) || !('appId' in profile)) {
    throw new Error('Firebase profile missing required fields.');
  }

  return asUserFirebaseProfile(profile);
}

export function parsePublicUserFirebaseProfile(rawProfile: unknown, ownerProjectId: string): UserFirebaseProfile {
  const profile = parseUserFirebaseProfile(rawProfile);
  if (profile.projectId === ownerProjectId) {
    throw new Error('Firebase profile projectId matches the owner project.');
  }
  return profile;
}

export function looksLikeFirebaseProfile(rawProfile: unknown): rawProfile is UserFirebaseProfile {
  try {
    parseUserFirebaseProfile(rawProfile);
    return true;
  } catch {
    return false;
  }
}
