import assert from 'node:assert/strict';
import test from 'node:test';
import { rolePolicy } from '../src/domain/rolePolicy';
import { removeTeamMember, saveTeamMember } from '../src/domain/teamWrites';
import * as wrapper from '../src/utils/firestoreWrapper';
wrapper.setFirestoreReferenceResolversForTest(
  (_db, id) => ({ id } as any),
  () => ({ id: 'event' } as any),
  (_db, email) => ({ id: email } as any),
  () => ({ id: 'roster' } as any),
);

test('role policy keeps viewers read-only', () => {
  assert.equal(rolePolicy.canRead('viewer'), true);
  assert.equal(rolePolicy.canEdit('viewer'), false);
  assert.equal(rolePolicy.canDelete('editor'), false);
  assert.equal(rolePolicy.canManageTeam('admin'), true);
  assert.equal(rolePolicy.isRole('owner'), false);
});

test('refuses removal of the last administrator before writing', async () => {
  await assert.rejects(removeTeamMember({} as any, { id: 'a', email: 'admin@example.com', role: 'admin' }, [{ id: 'a', email: 'admin@example.com', role: 'admin' }], 'other@example.com'), /At least one Administrator/);
});

test('refuses demoting the administrator in the active session', async () => {
  const roster = [{ id: 'a@example.com', email: 'a@example.com', role: 'admin' as const }, { id: 'b@example.com', email: 'b@example.com', role: 'admin' as const }];
  await assert.rejects(() => saveTeamMember({} as any, 'a@example.com', 'editor', 'a@example.com', roster), /active session/i);
});

test('rechecks last-administrator protection inside the transaction', async () => {
  const roster = [{ id: 'a@example.com', email: 'a@example.com', role: 'admin' as const }, { id: 'b@example.com', email: 'b@example.com', role: 'admin' as const }];
  const current: Record<string, any> = { 'a@example.com': { ...roster[0], role: 'editor' }, 'b@example.com': roster[1] };
  wrapper.setRunTransaction(async (_db: any, callback: (transaction: any) => Promise<any>) => callback({ get: async (ref: any) => ({ exists: () => Boolean(current[ref.id]), data: () => current[ref.id] }), set: () => undefined }));
  try { await assert.rejects(() => saveTeamMember({} as any, 'b@example.com', 'editor', 'owner@example.com', roster), /At least one Administrator/); }
  finally { wrapper.setRunTransaction(null); }
});

test('rechecks the five-member cap through one transactional roster state', async () => {
  const roster = Array.from({ length: 4 }, (_, index) => ({ id: `u${index}@example.com`, email: `u${index}@example.com`, role: index === 0 ? 'admin' as const : 'editor' as const }));
  const state = { members: [...roster.map(member => member.email), 'other@example.com'] };
  const current: Record<string, any> = Object.fromEntries(roster.map(member => [member.email, member]));
  current['other@example.com'] = { id: 'other@example.com', email: 'other@example.com', role: 'editor' };
  wrapper.setRunTransaction(async (_db: any, callback: (transaction: any) => Promise<any>) => callback({ get: async (ref: any) => ({ exists: () => ref.id === 'roster' || Boolean(current[ref.id]), data: () => ref.id === 'roster' ? state : current[ref.id] }), set: () => undefined }));
  try { await assert.rejects(() => saveTeamMember({} as any, 'sixth@example.com', 'editor', 'u0@example.com', roster), /five members/i); }
  finally { wrapper.setRunTransaction(null); }
});

test('rechecks active-session self-demotion inside the transaction', async () => {
  const roster = [{ id: 'a@example.com', email: 'a@example.com', role: 'editor' as const }];
  const current = { 'a@example.com': { id: 'a@example.com', email: 'a@example.com', role: 'admin' as const } };
  wrapper.setRunTransaction(async (_db: any, callback: (transaction: any) => Promise<any>) => callback({ get: async (ref: any) => ({ exists: () => Boolean(current[ref.id]) || ref.id === 'roster', data: () => ref.id === 'roster' ? { members: ['a@example.com'] } : current[ref.id] }), set: () => undefined }));
  try { await assert.rejects(() => saveTeamMember({} as any, 'a@example.com', 'editor', 'a@example.com', roster), /active session/i); }
  finally { wrapper.setRunTransaction(null); }
});
