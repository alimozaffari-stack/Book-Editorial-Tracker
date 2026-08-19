import { TeamRole } from '../types';
import { rolePolicy } from './rolePolicy';

interface RosterState { members?: unknown; }

/** Returns the role only when the account may use the tracker under the roster policy. */
export function effectiveTrackerRole(role: unknown, email: string, roster: RosterState | undefined): TeamRole | null {
  if (!rolePolicy.isRole(role)) return null;
  if (!roster) return role === 'admin' ? role : null;
  return Array.isArray(roster.members) && roster.members.includes(email) ? role : null;
}
