import JSZip from 'jszip';

export const MAX_DOCX_SIZE = 25 * 1024 * 1024;
export const MAX_XML_SIZE = 10 * 1024 * 1024;

export interface InspectionResult {
  valid: boolean;
  errors: string[];
  hash: string;
  size: number;
  xmlSizes: Record<string, number>;
  calculatedWordCount: number;
  wordCountSource: 'docx-properties' | 'calculated';
  documentCreatedAt?: string;
  documentModifiedAt?: string;
  documentTitle?: string;
  documentCreator?: string;
}

async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function xmlValue(xml: string, tag: string): string | undefined {
  return new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i').exec(xml)?.[1];
}

function boundedEntryBytes(entry: JSZip.JSZipObject, name: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    const stream = (entry as JSZip.JSZipObject & { internalStream(type: 'uint8array'): { on(event: string, callback: (value?: any) => void): any; pause(): void; resume(): void } }).internalStream('uint8array');
    stream.on('data', chunk => {
      total += chunk.byteLength;
      if (total > MAX_XML_SIZE) {
        stream.pause();
        reject(new Error(`XML file ${name} exceeds maximum of ${MAX_XML_SIZE} bytes`));
      } else chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      const result = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
      resolve(result);
    });
    stream.resume();
  });
}

/** Inspects only document content and core metadata from bounded DOCX bytes. */
export async function inspectDocx(bytes: Uint8Array): Promise<InspectionResult> {
  const errors: string[] = [];
  const xmlSizes: Record<string, number> = {};
  const size = bytes.byteLength;
  if (size > MAX_DOCX_SIZE) errors.push(`DOCX file size ${size} exceeds maximum of ${MAX_DOCX_SIZE} bytes`);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const hash = await computeHash(buffer);
  let documentXml = ''; let appXml = ''; let coreXml = '';
  let zipLoaded = false;
  let hasDocumentXml = false;
  try {
    const zip = await JSZip.loadAsync(buffer);
    zipLoaded = true;
    for (const name of ['word/document.xml', 'docProps/app.xml', 'docProps/core.xml']) {
      const entry = zip.file(name);
      if (!entry) continue;
      if (name === 'word/document.xml') hasDocumentXml = true;
      const content = await boundedEntryBytes(entry, name);
      xmlSizes[name] = content.byteLength;
      const xml = new TextDecoder().decode(content);
      if (name === 'word/document.xml') documentXml = xml;
      else if (name === 'docProps/app.xml') appXml = xml;
      else coreXml = xml;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message.startsWith('XML file ') ? message : `Failed to parse DOCX as zip: ${message}`);
  }
  if (zipLoaded && !hasDocumentXml) errors.push('DOCX is missing word/document.xml');
  const propertyWords = Number(xmlValue(appXml, 'Words'));
  const text = (documentXml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) ?? []).map((node) => node.replace(/<[^>]+>/g, ' ')).join(' ');
  const calculatedWordCount = Number.isFinite(propertyWords) && propertyWords > 0 ? propertyWords : text.trim().split(/\s+/).filter(Boolean).length;
  return { valid: errors.length === 0, errors, hash, size, xmlSizes, calculatedWordCount, wordCountSource: Number.isFinite(propertyWords) && propertyWords > 0 ? 'docx-properties' : 'calculated', documentCreatedAt: xmlValue(coreXml, 'dcterms:created'), documentModifiedAt: xmlValue(coreXml, 'dcterms:modified'), documentTitle: xmlValue(coreXml, 'dc:title'), documentCreator: xmlValue(coreXml, 'dc:creator') };
}
