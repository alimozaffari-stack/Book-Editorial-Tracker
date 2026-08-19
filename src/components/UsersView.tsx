import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '../firebase';
import { AppUser, TeamRole } from '../types';
import { rolePolicy } from '../domain/rolePolicy';
import { removeTeamMember, saveTeamMember } from '../domain/teamWrites';
import { Shield, Trash2, UserPlus } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

function teamErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return /Administrator|active session|five members|no longer exists/i.test(message) ? message : 'Nothing was changed. Check your connection and try again.';
}

export function UsersView() {
  const getActiveAuth = () => getFirebaseAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<TeamRole>('editor');
  const [isLoading, setIsLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  const currentUserEmail = getActiveAuth().currentUser?.email;
  const currentRole = users.find(u => u.email === currentUserEmail)?.role;
  const isAdmin = rolePolicy.canManageTeam(currentRole);

  useEffect(() => {
    const db = getFirebaseDb();
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const loadedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      setUsers(loadedUsers);
      setIsLoading(false); setLoadError(false);

    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setIsLoading(false); setLoadError(true);
    });

    return () => unsubscribe();
  }, [currentUserEmail, retry]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    const email = newEmail.toLowerCase().trim();
    if (!users.some(user => user.email === email) && users.length >= 5) { setMessageIsError(true); setMessage('The team already has the supported maximum of five members.'); return; }
    setBusyEmail(email); setMessage('');
    try {
      await saveTeamMember(getFirebaseDb(), email, newRole, currentUserEmail || '', users);
      setNewEmail('');
      setMessageIsError(false); setMessage(`${email} added to the team. This does not create a Firebase Authentication account.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      setMessageIsError(true); setMessage(teamErrorMessage(error));
    } finally {
      setBusyEmail(null);
    }
  };

  const handleDeleteUser = async (member: AppUser) => {
    if (!window.confirm(`Remove ${member.email} from the team?`)) return;
    setBusyEmail(member.email); setMessage('');
    try {
      await removeTeamMember(getFirebaseDb(), member, users, currentUserEmail || '');
      setMessageIsError(false); setMessage(`${member.email} removed from the team.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${member.email}`);
      setMessageIsError(true); setMessage(teamErrorMessage(error));
    } finally {
      setBusyEmail(null);
    }
  };

  const handleRoleChange = async (member: AppUser, role: TeamRole) => {
    setBusyEmail(member.email); setMessage('');
    try { await saveTeamMember(getFirebaseDb(), member.email, role, currentUserEmail || '', users); setMessageIsError(false); setMessage(`${member.email} is now ${role}.`); }
    catch (error) { handleFirestoreError(error, OperationType.UPDATE, `users/${member.email}`); setMessageIsError(true); setMessage(teamErrorMessage(error)); }
    finally { setBusyEmail(null); }
  };

  if (isLoading) return <div className="p-8 text-gray-500">Loading users...</div>;
  if (loadError) return <div className="p-8"><p className="text-red-700" role="alert">Team members could not refresh. Nothing was changed.</p><button onClick={() => { setIsLoading(true); setRetry(value => value + 1); }} className="mt-3 rounded border px-4 py-2 text-sm">Try again</button></div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" />
          Manage Team
        </h2>
        <p className="text-gray-600 mt-1">Administrators manage access; Editors update chapters; Viewers can review progress. Adding a team record does not create a sign-in account.</p>
      </div>

      {isAdmin && (
        <form onSubmit={handleAddUser} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="editor@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as TeamRole)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busyEmail !== null}
            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {busyEmail ? 'Saving…' : 'Add team member'}
          </button>
        </form>
      )}

      {message && <p role={messageIsError ? 'alert' : 'status'} className={`mb-4 text-sm ${messageIsError ? 'text-red-700' : 'text-green-700'}`}>{message}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {isAdmin ? <select value={user.role} onChange={event => handleRoleChange(user, event.target.value as TeamRole)} disabled={busyEmail !== null || (user.email === currentUserEmail && user.role === 'admin')} className="border rounded px-2 py-1 text-xs capitalize"><option value="admin">Administrator</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select> : <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user.role}
                  </span>}
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={busyEmail !== null || user.email === currentUserEmail}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title={user.email === currentUserEmail ? "You cannot remove yourself" : "Remove user"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 3 : 2} className="px-6 py-8 text-center text-gray-500">
                  No users added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
