import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const CONFIG_ROOT = fileURLToPath(new URL('.', import.meta.url));

interface TeamFirebaseProfileShape {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

function normalizeAuthDomain(value: string) {
  if (value.startsWith('https://')) return value;
  if (value.startsWith('http://')) return value.replace(/^http:\/\//, 'https://');
  return `https://${value}`;
}

function readOwnerTeamProfile(): TeamFirebaseProfileShape | null {
  const ownerConfigPath = path.join(CONFIG_ROOT, 'firebase-applet-config.json');
  try {
    if (!fs.existsSync(ownerConfigPath)) return null;
    const raw = JSON.parse(fs.readFileSync(ownerConfigPath, 'utf8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
    const authDomain = typeof raw.authDomain === 'string' ? normalizeAuthDomain(raw.authDomain.trim()) : '';
    const projectId = typeof raw.projectId === 'string' ? raw.projectId.trim() : '';
    const appId = typeof raw.appId === 'string' ? raw.appId.trim() : '';

    if (!apiKey || !authDomain || !projectId || !appId) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(apiKey)) return null;
    if (!/^[a-z0-9-]{6,128}$/.test(projectId)) return null;
    if (!/^1:[0-9]+:(web|android|ios):[A-Za-z0-9]+$/i.test(appId)) return null;

    try {
      const parsedAuthDomain = new URL(authDomain);
      if (parsedAuthDomain.protocol !== 'https:' || parsedAuthDomain.pathname !== '/' || parsedAuthDomain.search || parsedAuthDomain.hash) return null;
      if (!parsedAuthDomain.hostname || parsedAuthDomain.hostname.includes(':')) return null;
    } catch {
      return null;
    }

    const profile: TeamFirebaseProfileShape = {
      apiKey,
      authDomain,
      projectId,
      appId,
    };

    if (typeof raw.firestoreDatabaseId === 'string') {
      const firestoreDatabaseId = raw.firestoreDatabaseId.trim();
      if (!/^[a-z0-9-]{6,128}$/.test(firestoreDatabaseId)) return null;
      profile.firestoreDatabaseId = firestoreDatabaseId;
    }

    return profile;
  } catch {
    return null;
  }
}

function readPackageVersion(): string {
  try {
    const packageJsonPath = path.join(CONFIG_ROOT, 'package.json');
    const raw = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = typeof raw.version === 'string' ? raw.version.trim() : '';
    return version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default defineConfig(() => {
  const appVariant = process.env.VITE_APP_VARIANT === 'public' ? 'public' : 'team';
  const teamProfile = appVariant === 'team' ? readOwnerTeamProfile() : null;
  const appVersion = readPackageVersion();

  return {
    plugins: [react(), tailwindcss(), viteSingleFile()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY),
      'import.meta.env.VITE_APP_VARIANT': JSON.stringify(appVariant),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_TEAM_FIREBASE_PROFILE': JSON.stringify(teamProfile),
    },
    resolve: {
      alias: {
        '@': path.resolve(CONFIG_ROOT, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
