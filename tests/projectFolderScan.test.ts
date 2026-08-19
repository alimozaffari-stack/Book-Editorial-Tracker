import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterIdFromFolder, proposalFromStageFolder } from '../src/domain/projectFolderScan';
test('maps chapter folders but flags composite roots', () => { assert.equal(chapterIdFromFolder('C01 Author'), 'CH01'); assert.equal(chapterIdFromFolder('CH00_C01-03'), undefined); });
test('recognises known and misspelled stage folders', () => { assert.deepEqual(proposalFromStageFolder('00_ABSTRACT'), { stage: 'abstract' }); assert.deepEqual(proposalFromStageFolder('01_00_1ST MANUSCRIPT FEEDBACK'), { stage: 'feedback-sent', roundNumber: 0 }); assert.deepEqual(proposalFromStageFolder('06_FINAL MANUSCRUPT SUBMISSION'), { stage: 'final-manuscript' }); });
