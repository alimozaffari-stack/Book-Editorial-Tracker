import { TeamRole } from '../types';

export const rolePolicy = {
  isRole: (role: unknown): role is TeamRole => role === 'admin' || role === 'editor' || role === 'viewer',
  canRead: (role: TeamRole | undefined) => role === 'admin' || role === 'editor' || role === 'viewer',
  canEdit: (role: TeamRole | undefined) => role === 'admin' || role === 'editor',
  canDelete: (role: TeamRole | undefined) => role === 'admin',
  canManageTeam: (role: TeamRole | undefined) => role === 'admin',
};
