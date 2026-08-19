import React, { useState } from 'react';
import { UserFirebaseProfile } from '../domain/firebaseProfile';

interface FirebaseSetupViewProps {
  onSubmit: (profile: UserFirebaseProfile) => Promise<void> | void;
  onClear?: () => Promise<void> | void;
  onBack?: () => void;
  error?: string | null;
}

interface FirebaseSetupNavigationState {
  storageKind: 'firebase' | 'local-file' | 'shared-folder' | null;
  runtimeReady: boolean;
  isRuntimeConfiguring: boolean;
  setupMessage: string;
  profileInputError: string | null;
  runtimeError: string | null;
}

const emptyProfile = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
  firestoreDatabaseId: '',
};

export function buildBackToStorageChoicesState(state: FirebaseSetupNavigationState): FirebaseSetupNavigationState {
  return {
    ...state,
    storageKind: null,
    runtimeReady: false,
    isRuntimeConfiguring: false,
    setupMessage: '',
    profileInputError: null,
    runtimeError: null,
  };
}

export function FirebaseSetupView({ onSubmit, onClear, onBack, error }: FirebaseSetupViewProps) {
  const [profile, setProfile] = useState({ ...emptyProfile });

  const updateField = (field: keyof typeof emptyProfile, value: string) => {
    setProfile(previous => ({ ...previous, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload: UserFirebaseProfile = {
      apiKey: profile.apiKey,
      authDomain: profile.authDomain,
      projectId: profile.projectId,
      appId: profile.appId,
    };
    if (profile.firestoreDatabaseId.trim()) {
      payload.firestoreDatabaseId = profile.firestoreDatabaseId;
    }
    await onSubmit(payload);
  };

  return (
    <div className="min-h-screen pt-8 flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-xl w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Set up your Firebase project</h1>
        <p className="text-left text-sm text-gray-600 mb-6">
          Set up your own Firebase project for this tracker.
          Enable Firebase Authentication and Firestore in your project, then deploy the supplied Firestore rules yourself.
        </p>
        <form onSubmit={submit} className="text-left space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">API key</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg" value={profile.apiKey} onChange={event => updateField('apiKey', event.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Auth domain</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg" value={profile.authDomain} onChange={event => updateField('authDomain', event.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Project ID</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg" value={profile.projectId} onChange={event => updateField('projectId', event.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">App ID</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg" value={profile.appId} onChange={event => updateField('appId', event.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Firestore Database ID (optional)</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg" value={profile.firestoreDatabaseId} onChange={event => updateField('firestoreDatabaseId', event.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            Continue
          </button>
          {onClear && (
            <button
              type="button"
              onClick={() => void onClear()}
              className="w-full mt-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear saved profile
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full mt-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to storage choices
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
