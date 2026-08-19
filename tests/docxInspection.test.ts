import JSZip from 'jszip';
import { inspectDocx, MAX_DOCX_SIZE, MAX_XML_SIZE } from '../src/utils/docxInspection';
import { test } from 'node:test';
import assert from 'node:assert/strict';

async function docx(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  Object.entries(files).forEach(([name, value]) => zip.file(name, value));
  return zip.generateAsync({ type: 'uint8array' });
}

test('inspects document words and bounded core metadata', async () => {
  const result = await inspectDocx(await docx({ 'word/document.xml': '<w:document><w:t>Hello world</w:t></w:document>', 'docProps/app.xml': '<Properties><Words>7</Words></Properties>', 'docProps/core.xml': '<cp:coreProperties><dc:title>Test</dc:title></cp:coreProperties>' }));
  assert.equal(result.valid, true); assert.equal(result.calculatedWordCount, 7); assert.equal(result.documentTitle, 'Test'); assert.match(result.hash, /^[a-f0-9]{64}$/);
});

test('rejects size and malformed zip failures', async () => {
  const oversized = await inspectDocx(new Uint8Array(MAX_DOCX_SIZE + 1));
  assert.equal(oversized.valid, false); assert.ok(oversized.errors.some((error) => error.includes('DOCX file size')));
  const invalid = await inspectDocx(new TextEncoder().encode('not a zip'));
  assert.equal(invalid.valid, false); assert.ok(invalid.errors.some((error) => error.includes('Failed to parse DOCX')));
});

test('rejects XML entries larger than the limit', async () => {
  const result = await inspectDocx(await docx({ 'word/document.xml': new Uint8Array(MAX_XML_SIZE + 1) }));
  assert.equal(result.valid, false); assert.ok(result.errors.some((error) => error.includes('word/document.xml')));
});

test('rejects a ZIP that is not a Word document package', async () => {
  const result = await inspectDocx(await docx({ 'docProps/core.xml': '<cp:coreProperties />' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('word/document.xml')));
});
