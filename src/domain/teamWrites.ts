import { Firestore } from 'firebase/firestore';
import { AppUser, TeamRole } from '../types';
import { writeActivityEvent } from './activityLog';
import { getActivityEventRef, getTeamRosterStateRef, getUserRef, runTransaction } from '../utils/firestoreWrapper';

interface TeamRosterState { members: string[]; updatedAt?: string; }

function normalizedRosterEmails(roster: AppUser[]): string[] {
  return [...new Set(roster.map(member => member.email.trim().toLowerCase()).filter(Boolean))];
}

export async function saveTeamMember(db: Firestore, email: string, role: TeamRole, actor: string, roster: AppUser[] = []): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase(); const normalizedActor = actor.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
  if (!roster.some(member => member.email.toLowerCase() === normalizedEmail) && roster.length >= 5) throw new Error('The team already has the supported maximum of five members.');
  if (normalizedEmail === normalizedActor && roster.find(member => member.email.toLowerCase() === normalizedEmail)?.role === 'admin' && role !== 'admin') {
    throw new Error('You cannot demote the Administrator in your active session.');
  }
  const existingMember = roster.find(member => member.email.toLowerCase() === normalizedEmail);
  if (existingMember?.role === 'admin' && role !== 'admin' && roster.filter(member => member.role === 'admin').length <= 1) {
    throw new Error('At least one Administrator must remain.');
  }
  await runTransaction(db, async transaction => {
    const stateRef = getTeamRosterStateRef(db);
    const stateSnapshot = await transaction.get(stateRef);
    const savedMembers = stateSnapshot.exists() ? (stateSnapshot.data() as TeamRosterState).members : normalizedRosterEmails(roster);
    const memberEmails = [...new Set([...savedMembers, normalizedEmail])];
    const rosterRefs = memberEmails.map(memberEmail => getUserRef(db, memberEmail));
    const currentSnapshots = await Promise.all(rosterRefs.map(ref => transaction.get(ref)));
    const currentRoster = currentSnapshots.filter(snapshot => snapshot.exists()).map(snapshot => snapshot.data() as AppUser);
    const currentMember = currentRoster.find(member => member.email.toLowerCase() === normalizedEmail);
    const currentMembers = [...new Set([...(stateSnapshot.exists() ? savedMembers : currentRoster.map(member => member.email)), ...(currentMember ? [normalizedEmail] : [])])];
    if (!currentMember && currentMembers.length >= 5) throw new Error('The team already has the supported maximum of five members.');
    if (normalizedEmail === normalizedActor && currentMember?.role === 'admin' && role !== 'admin') throw new Error('You cannot demote the Administrator in your active session.');
    if (currentMember?.role === 'admin' && role !== 'admin' && currentRoster.filter(member => member.role === 'admin').length <= 1) throw new Error('At least one Administrator must remain.');
    const ref = getUserRef(db, normalizedEmail); const existing = currentSnapshots[memberEmails.indexOf(normalizedEmail)];
    const nextMembers = currentMember ? currentMembers : [...currentMembers, normalizedEmail];
    transaction.set(stateRef, { members: nextMembers, updatedAt: new Date().toISOString() });
    transaction.set(ref, { email: normalizedEmail, role });
    writeActivityEvent(transaction, { ref: getActivityEventRef(db), actorEmail: actor, action: 'team-changed', summary: `${existing.exists() ? 'Changed' : 'Added'} team member ${normalizedEmail}`, changedFields: ['role'] });
  });
}

export async function removeTeamMember(db: Firestore, member: AppUser, roster: AppUser[], actor: string): Promise<void> {
  if (member.email.toLowerCase() === actor.toLowerCase()) throw new Error('You cannot remove your own active session.');
  if (member.role === 'admin' && roster.filter(user => user.role === 'admin').length <= 1) throw new Error('At least one Administrator must remain.');
  await runTransaction(db, async transaction => {
    const stateRef = getTeamRosterStateRef(db);
    const stateSnapshot = await transaction.get(stateRef);
    const memberEmails = stateSnapshot.exists() ? (stateSnapshot.data() as TeamRosterState).members : normalizedRosterEmails(roster);
    const snapshots = await Promise.all(memberEmails.map(email => transaction.get(getUserRef(db, email))));
    const currentRoster = snapshots.filter(snapshot => snapshot.exists()).map(snapshot => snapshot.data() as AppUser);
    const currentMember = currentRoster.find(user => user.email.toLowerCase() === member.email.toLowerCase());
    if (!currentMember) throw new Error('The team member no longer exists.');
    if (currentMember.role === 'admin' && currentRoster.filter(user => user.role === 'admin').length <= 1) throw new Error('At least one Administrator must remain.');
    transaction.set(stateRef, { members: memberEmails.filter(email => email.toLowerCase() !== member.email.toLowerCase()), updatedAt: new Date().toISOString() });
    transaction.delete(getUserRef(db, member.email));
    writeActivityEvent(transaction, { ref: getActivityEventRef(db), actorEmail: actor, action: 'team-changed', summary: `Removed team member ${member.email}`, changedFields: ['role'] });
  });
}
