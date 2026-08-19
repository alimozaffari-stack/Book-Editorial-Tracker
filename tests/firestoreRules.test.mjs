import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('rules use roster roles and retain immutable activity events', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /\['admin', 'editor', 'viewer'\]/);
  assert.match(rules, /'project-started'/);
assert.doesNotMatch(rules, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  assert.match(rules, /allow update, delete: if false/);
  assert.match(rules, /allow list: if isMember\(\)/);
  assert.match(rules, /isSafeReference\(data\.folderUrl\)/);
  assert.match(rules, /isSafeReference\(data\.feedbackLink\)/);
  assert.match(rules, /isValidProject/);
  assert.match(rules, /data\.keys\(\)\.hasOnly\(\['actorEmail'/);
  assert.match(rules, /data\.members\.size\(\) <= 5/);
  assert.match(rules, /data\.members\.hasAny\(\[request\.auth\.token\.email\]\)/);
  assert.match(rules, /teamState\/roster/);
  assert.match(rules, /stateId == 'project'/);
});

test('rules require admin for project-started activity writes', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /allow create: if canEdit\(\) && isValidActivity\(request\.resource\.data\) &&/);
  assert.match(rules, /request\.resource\.data\.action != 'team-changed' \|\| isAdmin\(\)/);
  assert.match(rules, /request\.resource\.data\.action != 'project-started' \|\| isAdmin\(\)/);
});

test('rules allow admin update of project document state', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/teamState\/\{stateId\}[\s\S]*allow update: if/);
  assert.match(
    rules,
    /stateId == 'roster' && isAdmin\(\) && isValidTeamState\(request\.resource\.data\)/,
  );
  assert.match(
    rules,
    /stateId == 'project' && isAdmin\(\) && isValidProject\(request\.resource\.data\)/,
  );
});
