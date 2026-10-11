const JSZip = require('jszip');
const { combineDocx } = require('./ooxml-combine.cjs');

const MAX_DOCUMENT_XML_BYTES = 10 * 1024 * 1024;

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

async function extractDocxText(bytes) {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('The Word document has no readable main document content.');
  const uncompressedSize = entry._data?.uncompressedSize;
  if (Number.isFinite(uncompressedSize) && uncompressedSize > MAX_DOCUMENT_XML_BYTES) {
    throw new Error('The Word document content is too large to compile safely.');
  }
  const xml = await entry.async('string');
  if (Buffer.byteLength(xml, 'utf8') > MAX_DOCUMENT_XML_BYTES) {
    throw new Error('The Word document content is too large to compile safely.');
  }
  return [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi)]
    .map(([, paragraph]) => decodeXml(
      paragraph
        .replace(/<w:tab\b[^>]*\/?\s*>/gi, '\t')
        .replace(/<w:(?:br|cr)\b[^>]*\/?\s*>/gi, '\n')
        .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi, '$1')
        .replace(/<[^>]+>/g, ''),
    ).trim())
    .filter(Boolean);
}

function markdownForSections(projectName, sections, options) {
  const lines = [`# ${projectName || 'Compiled manuscript'}`, ''];
  if (options.includeMetadata) lines.push(`_Compiled ${new Date().toISOString()}_`, '');
  for (const section of sections) {
    lines.push(`## ${section.id}: ${section.title}`);
    if (options.includeMetadata) {
      if (section.contributorName) lines.push(`**Contributor:** ${section.contributorName}`);
      if (section.contributorEmail) lines.push(`**Email:** ${section.contributorEmail}`);
      if (section.institutionalAffiliation) lines.push(`**Affiliation:** ${section.institutionalAffiliation}`);
      lines.push(`**Source stage:** ${section.stageLabel}`);
      if (section.effectiveOn) lines.push(`**Effective date:** ${section.effectiveOn}`);
      lines.push('');
    }
    if (options.includeAbstracts && section.abstractText) {
      lines.push('### Abstract', '', section.abstractText.trim(), '');
    }
    lines.push('### Manuscript', '', section.paragraphs.join('\n\n'), '');
  }
  return `${lines.join('\n').trim()}\n`;
}

function paragraph(text, style, pageBreakBefore = false) {
  const properties = style || pageBreakBefore
    ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${pageBreakBefore ? '<w:pageBreakBefore/>' : ''}</w:pPr>`
    : '';
  return `<w:p>${properties}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function paragraphsFromText(text, style) {
  return String(text ?? '').split(/\r?\n/).map(line => paragraph(line, style)).join('');
}

function documentXml(projectName, sections, options) {
  const body = [paragraph(projectName || 'Compiled manuscript', 'Title')];
  sections.forEach((section, index) => {
    body.push(paragraph(`${section.id}: ${section.title}`, 'Heading1', index > 0));
    if (options.includeMetadata) {
      if (section.contributorName) body.push(paragraph(`Contributor: ${section.contributorName}`));
      if (section.contributorEmail) body.push(paragraph(`Email: ${section.contributorEmail}`));
      if (section.institutionalAffiliation) body.push(paragraph(`Affiliation: ${section.institutionalAffiliation}`));
      body.push(paragraph(`Source stage: ${section.stageLabel}`));
      if (section.effectiveOn) body.push(paragraph(`Effective date: ${section.effectiveOn}`));
    }
    if (options.includeAbstracts && section.abstractText) {
      body.push(paragraph('Abstract', 'Heading2'), paragraphsFromText(section.abstractText));
    }
    body.push(paragraph('Manuscript', 'Heading2'));
    section.paragraphs.forEach(text => body.push(paragraph(text)));
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
}

async function buildPlainDocx(projectName, sections, options) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>');
  zip.file('word/document.xml', documentXml(projectName, sections, options));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function buildDocx(projectName, sections, options = {}) {
  if (!sections.some(section => section.sourceBytes)) {
    return buildPlainDocx(projectName, sections, options);
  }
  if (!sections.every(section => section.sourceBytes)) {
    throw new Error('Every combined Word chapter requires its original DOCX bytes.');
  }
  // Keep generated headings, abstracts and metadata, but replace each marker with
  // the original chapter's OOXML body (and its linked parts), not extracted text.
  const scaffold = documentXml(projectName, sections.map((section, index) => ({
    ...section,
    paragraphs: [`BET_COMPILE_MARKER_${index}`],
  })), options);
  const base = options.templateBytes || await buildPlainDocx(projectName, [], options);
  return combineDocx(base, scaffold, sections.map(section => ({ bytes: section.sourceBytes })));
}

function safeFileName(value, fallback) {
  const baseName = String(value ?? '').split(/[\\/]/).pop() ?? '';
  const name = baseName.replace(/[<>:"|?*\x00-\x1F]/g, '_').replace(/^\.+/, '').trim();
  return name || fallback;
}

async function buildSourceArchive(projectName, sources, options) {
  const zip = new JSZip();
  for (const item of sources) {
    zip.file(`${safeFileName(item.section.id, 'chapter')}/${safeFileName(item.sourceFileName, 'source.docx')}`, item.bytes);
  }
  if (options.includeMetadata) {
    zip.file('manuscript-metadata.json', JSON.stringify({
      projectName,
      compiledAt: new Date().toISOString(),
      chapters: sources.map(({ section }) => ({
        id: section.id, title: section.title, contributorName: section.contributorName,
        contributorEmail: section.contributorEmail, institutionalAffiliation: section.institutionalAffiliation,
        stage: section.stage, roundNumber: section.roundNumber, effectiveOn: section.effectiveOn,
      })),
    }, null, 2));
  }
  if (options.includeAbstracts) {
    const abstractSections = sources.filter(({ section }) => section.abstractText).map(({ section }) => section);
    if (abstractSections.length) zip.file('chapter-abstracts.md', markdownForSections(projectName, abstractSections.map(section => ({ ...section, paragraphs: [] })), { includeMetadata: false, includeAbstracts: true }).replace(/### Manuscript\n*/g, ''));
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
  buildDocx,
  buildSourceArchive,
  extractDocxText,
  markdownForSections,
};
