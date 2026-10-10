'use strict';

// File-only OOXML merger. Source manuscripts and Word installations are never modified or launched.
const JSZip = require('jszip');
const posix = require('node:path').posix;

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKGREL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const MAX_XML = 10 * 1024 * 1024;
const MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const PART_TYPES = {
  'styles.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
  'numbering.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
  'footnotes.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml',
  'endnotes.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml',
};

const esc = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const unesc = value => String(value).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<');
const attr = (xml, name) => new RegExp(`(?:^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}="([^"]*)"`).exec(xml)?.[1];

async function xml(zip, name, required = true) {
  const entry = zip.file(name);
  if (!entry) {
    if (required) throw new Error(`The Word document is missing ${name}.`);
    return '';
  }
  if (entry._data?.uncompressedSize > MAX_XML) throw new Error(`The Word part ${name} is too large.`);
  const value = await entry.async('string');
  if (Buffer.byteLength(value, 'utf8') > MAX_XML) throw new Error(`The Word part ${name} is too large.`);
  return value;
}

function children(xmlText, local) {
  const expression = new RegExp(`<w:${local}\\b[^>]*>[\\s\\S]*?<\\/w:${local}>`, 'g');
  return [...xmlText.matchAll(expression)].map(m => m[0]);
}

function rootOpen(text, local) {
  const result = new RegExp(`<w:${local}\\b[^>]*>`).exec(text);
  if (!result) throw new Error(`Unsupported Word XML: expected w:${local}.`);
  return result[0];
}

function innerBody(text) {
  const match = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/.exec(text);
  if (!match) throw new Error('The Word document has no supported w:body.');
  return match[1];
}

function trailingSection(body) {
  return /(<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>)(?:\s*)$/.exec(body)?.[1] || '';
}

function mergeNamespaces(destination, incoming, rootName) {
  let opening = rootOpen(destination, rootName);
  const sourceOpening = rootOpen(incoming, rootName);
  const known = new Map([...opening.matchAll(/\bxmlns(?::([\w.-]+))?="([^"]+)"/g)].map(([, key, uri]) => [key || '', uri]));
  for (const [, key, uri] of sourceOpening.matchAll(/\bxmlns(?::([\w.-]+))?="([^"]+)"/g)) {
    const prefix = key || '';
    if (known.has(prefix) && known.get(prefix) !== uri) {
      throw new Error(`Conflicting XML namespace ${prefix || '(default)'} in source document.`);
    }
    if (!known.has(prefix)) {
      opening = opening.replace(/>$/, ` xmlns${prefix ? ':' + prefix : ''}="${uri}">`);
      known.set(prefix, uri);
    }
  }
  const ignorable = /\bmc:Ignorable="([^"]+)"/.exec(sourceOpening)?.[1]?.split(/\s+/) || [];
  if (ignorable.length) {
    const existing = /\bmc:Ignorable="([^"]+)"/.exec(opening)?.[1]?.split(/\s+/) || [];
    const joined = [...new Set([...existing, ...ignorable])].join(' ');
    opening = existing.length
      ? opening.replace(/\bmc:Ignorable="[^"]+"/, `mc:Ignorable="${joined}"`)
      : opening.replace(/>$/, ` mc:Ignorable="${joined}">`);
  }
  return destination.replace(rootOpen(destination, rootName), opening);
}

function replaceBody(destination, content) {
  return destination.replace(/(<w:body\b[^>]*>)[\s\S]*?(<\/w:body>)/, (_, start, end) => `${start}${content}${end}`);
}

function insertChildren(target, local, additions, before = '') {
  if (!additions) return target;
  if (before) {
    const first = new RegExp(`<w:${before}\\b`);
    if (first.test(target)) return target.replace(first, `${additions}<w:${before}`);
  }
  const close = `</w:${local}>`;
  if (!target.includes(close)) throw new Error(`Malformed Word ${local} part.`);
  return target.replace(close, additions + close);
}

function rels(text) {
  const result = new Map();
  for (const [entry] of text.matchAll(/<Relationship\b[^>]*\/?\s*>/g)) {
    const id = attr(entry, 'Id');
    const target = attr(entry, 'Target');
    const type = attr(entry, 'Type');
    if (!id || !target || !type || result.has(id)) throw new Error('Invalid or duplicate Word relationship.');
    result.set(id, { target: unesc(target), type: unesc(type), external: attr(entry, 'TargetMode') === 'External' });
  }
  return result;
}

function relXml(entries) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PKGREL}">${entries.join('')}</Relationships>`;
}

function newRel(state, type, target, external = false) {
  const id = `rId${++state.next}`;
  state.entries.push(`<Relationship Id="${id}" Type="${esc(type)}" Target="${esc(target)}"${external ? ' TargetMode="External"' : ''}/>`);
  return id;
}

function relState(text) {
  const entries = [...text.matchAll(/<Relationship\b[^>]*\/?\s*>/g)].map(m => m[0]);
  const next = Math.max(0, ...entries.map(tag => Number(/^rId(\d+)$/.exec(attr(tag, 'Id') || '')?.[1] || 0)));
  return { entries, next };
}

function ensureCoreRel(state, type, target) {
  const existing = state.entries.find(item => attr(item, 'Type') === REL + '/' + type);
  return existing ? attr(existing, 'Id') : newRel(state, REL + '/' + type, target);
}

function contentTypeState(xmlText) {
  const defaults = new Map();
  const overrides = new Map();
  for (const [tag] of xmlText.matchAll(/<Default\b[^>]*\/?\s*>/g)) defaults.set(attr(tag, 'Extension')?.toLowerCase(), unesc(attr(tag, 'ContentType')));
  for (const [tag] of xmlText.matchAll(/<Override\b[^>]*\/?\s*>/g)) overrides.set(unesc(attr(tag, 'PartName')), unesc(attr(tag, 'ContentType')));
  return { defaults, overrides };
}

function setContentType(ct, path, type) {
  ct.overrides.set('/' + path, type);
}

function writeContentTypes(output, text, ct) {
  const has = contentTypeState(text);
  let additions = '';
  if (!has.defaults.has('rels')) additions += `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`;
  for (const [name, type] of ct.overrides) {
    if (has.overrides.get(name) === type) continue;
    // Replace a template's .dotx main-part override with a .docx override.
    if (has.overrides.has(name)) {
      text = text.replace(new RegExp(`<Override\\b(?=[^>]*\\bPartName="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}")[^>]*/>`),
        `<Override PartName="${esc(name)}" ContentType="${esc(type)}"/>`);
    } else additions += `<Override PartName="${esc(name)}" ContentType="${esc(type)}"/>`;
  }
  output.file('[Content_Types].xml', text.replace('</Types>', additions + '</Types>'));
}

function changeTagAttribute(markup, tag, field, mapping) {
  if (!mapping.size) return markup;
  const expression = new RegExp(`<${tag}\\b[^>]*>`, 'g');
  const fieldExpression = new RegExp(`(\\s${field}=")[^"]+(?=")`);
  return markup.replace(expression, element => element.replace(fieldExpression, capture => {
    const original = capture.slice(field.length + 3);
    return mapping.has(original) ? ` ${field}="${mapping.get(original)}` : capture;
  }));
}

function remapStyles(markup, ids) {
  markup = changeTagAttribute(markup, 'w:style', 'w:styleId', ids);
  for (const tag of ['pStyle', 'rStyle', 'tblStyle', 'basedOn', 'next', 'link', 'styleLink', 'numStyleLink']) {
    markup = changeTagAttribute(markup, `w:${tag}`, 'w:val', ids);
  }
  return markup;
}

function remapNumbers(markup, nums, abstracts) {
  markup = changeTagAttribute(markup, 'w:num', 'w:numId', nums);
  markup = changeTagAttribute(markup, 'w:numId', 'w:val', nums);
  markup = changeTagAttribute(markup, 'w:abstractNum', 'w:abstractNumId', abstracts);
  return changeTagAttribute(markup, 'w:abstractNumId', 'w:val', abstracts);
}

function remapNotes(markup, kind, ids) {
  return changeTagAttribute(changeTagAttribute(markup, `w:${kind}`, 'w:id', ids), `w:${kind}Reference`, 'w:id', ids);
}

function remapRelations(markup, sourceRels, destination, prefix, sourceZip) {
  const mapping = new Map();
  for (const [, id] of markup.matchAll(/\b(?:r:id|r:embed|r:link|o:relid)="([^"]+)"/g)) {
    if (mapping.has(id)) continue;
    const rel = sourceRels.get(id);
    if (!rel) throw new Error(`A Word drawing or hyperlink refers to a missing relationship: ${id}.`);
    if (/(?:\/attachedTemplate|\/vbaProject)$/.test(rel.type)) throw new Error('Attached templates and macros are not supported in the combined export.');
    if (rel.external && !rel.type.endsWith('/hyperlink')) throw new Error('Externally linked media cannot be safely preserved. Embed it in the source document.');
    let target = rel.target;
    if (!rel.external) {
      const resolved = target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join('word', target));
      if (!resolved.startsWith('word/') || resolved.includes('..')) throw new Error('Unsupported relationship target outside the Word package.');
      if (!sourceZip.file(resolved)) throw new Error(`The source document is missing related part ${resolved}.`);
      if (['word/styles.xml', 'word/numbering.xml', 'word/footnotes.xml', 'word/endnotes.xml'].includes(resolved)) {
        throw new Error('Unexpected structural Word part referenced from chapter content.');
      }
      target = `${prefix}/${resolved.slice('word/'.length)}`;
    }
    mapping.set(id, newRel(destination, rel.type, target, rel.external));
  }
  return markup.replace(/\b(r:id|r:embed|r:link|o:relid)="([^"]+)"/g, (whole, name, id) => `${name}="${mapping.get(id) || id}"`);
}

function noteRoot(kind) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${kind}s xmlns:w="${W}"><w:${kind} w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:${kind}><w:${kind} w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:${kind}></w:${kind}s>`;
}

function simpleRoot(local) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${local} xmlns:w="${W}"></w:${local}>`;
}

async function combineDocx(templateOrBaseBytes, scaffoldXml, sourceChapters) {
  const output = await JSZip.loadAsync(templateOrBaseBytes, { checkCRC32: true });
  if (Object.keys(output.files).some(p => /(?:^|\/)vbaProject\.bin$/i.test(p))) {
    throw new Error('Macro-enabled Word templates are not permitted. Choose a .docx or .dotx without macros.');
  }
  let document = await xml(output, 'word/document.xml');
  rootOpen(document, 'document');
  let body = innerBody(scaffoldXml);
  body = body.replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>\s*$/, '');
  const baseSection = trailingSection(innerBody(document));
  let styles = await xml(output, 'word/styles.xml', false) || simpleRoot('styles');
  let numbering = await xml(output, 'word/numbering.xml', false) || simpleRoot('numbering');
  let footnotes = await xml(output, 'word/footnotes.xml', false) || noteRoot('footnote');
  let endnotes = await xml(output, 'word/endnotes.xml', false) || noteRoot('endnote');
  const docRels = relState(await xml(output, 'word/_rels/document.xml.rels', false));
  const footRels = relState(await xml(output, 'word/_rels/footnotes.xml.rels', false));
  const endRels = relState(await xml(output, 'word/_rels/endnotes.xml.rels', false));
  const typesText = await xml(output, '[Content_Types].xml');
  const extraTypes = { overrides: new Map() };
  const usedStyles = new Set([...styles.matchAll(/<w:style\b[^>]*\bw:styleId="([^"]+)"/g)].map(m => m[1]));
  let nextAbs = Math.max(0, ...[...numbering.matchAll(/<w:abstractNum\b[^>]*\bw:abstractNumId="(\d+)"/g)].map(m => Number(m[1]))) + 1;
  let nextNum = Math.max(0, ...[...numbering.matchAll(/<w:num\b[^>]*\bw:numId="(\d+)"/g)].map(m => Number(m[1]))) + 1;
  let nextFoot = Math.max(0, ...children(footnotes, 'footnote').map(part => Number(attr(rootOpen(part, 'footnote'), 'w:id') || 0))) + 1;
  let nextEnd = Math.max(0, ...children(endnotes, 'endnote').map(part => Number(attr(rootOpen(part, 'endnote'), 'w:id') || 0))) + 1;
  const abstractsToAdd = [], numsToAdd = [], stylesToAdd = [], notesToAdd = { footnote: [], endnote: [] };
  let hasFoot = false, hasEnd = false, hasNum = false;
  let nextDrawingId = Math.max(0, ...[...document.matchAll(/<wp:docPr\b[^>]*\bid="(\d+)"/g)].map(m => Number(m[1]))) + 1;

  for (let index = 0; index < sourceChapters.length; index += 1) {
    const sourceZip = await JSZip.loadAsync(sourceChapters[index].bytes, { checkCRC32: true });
    if (Object.keys(sourceZip.files).some(p => /(?:^|\/)vbaProject\.bin$/i.test(p))) {
      throw new Error(`Chapter ${index + 1} contains a macro-enabled Word part.`);
    }
    const sourceDoc = await xml(sourceZip, 'word/document.xml');
    rootOpen(sourceDoc, 'document');
    const sourceBody = innerBody(sourceDoc);
    if (/<w:altChunk\b/.test(sourceBody)) throw new Error(`Chapter ${index + 1} contains a Word altChunk that cannot be combined safely.`);
    const sourceStyles = await xml(sourceZip, 'word/styles.xml', false);
    const sourceNumbers = await xml(sourceZip, 'word/numbering.xml', false);
    const styleIds = new Map();
    for (const style of children(sourceStyles, 'style')) {
      const id = attr(rootOpen(style, 'style'), 'w:styleId');
      if (!id) continue;
      let mapped = `BET${index + 1}_${id}`.slice(0, 240);
      while (usedStyles.has(mapped)) mapped += '_';
      styleIds.set(id, mapped);
      usedStyles.add(mapped);
    }
    const nums = new Map(), abstracts = new Map();
    if (/<w:numPicBullet\b/.test(sourceNumbers)) throw new Error('Picture-bullet lists are not supported by this compiler.');
    for (const item of children(sourceNumbers, 'abstractNum')) {
      const id = attr(rootOpen(item, 'abstractNum'), 'w:abstractNumId');
      if (id != null) abstracts.set(id, String(nextAbs++));
    }
    for (const item of children(sourceNumbers, 'num')) {
      const id = attr(rootOpen(item, 'num'), 'w:numId');
      if (id != null) nums.set(id, String(nextNum++));
    }
    const referencedNumbers = [...(sourceBody + sourceStyles).matchAll(/<w:numId\b[^>]*\bw:val="(\d+)"/g)].map(m => m[1]);
    if (referencedNumbers.some(id => id !== '0' && !nums.has(id))) {
      throw new Error('A numbered list has no matching numbering definition.');
    }
    for (const sourceItem of children(sourceStyles, 'style')) {
      let item = remapStyles(sourceItem, styleIds);
      item = remapNumbers(item, nums, abstracts).replace(/\s+w:default="1"/, '');
      stylesToAdd.push(item);
    }
    for (const sourceItem of children(sourceNumbers, 'abstractNum')) {
      let item = remapNumbers(remapStyles(sourceItem, styleIds), nums, abstracts);
      // Ensure pasted chapters cannot share a list identity accidentally.
      item = item.replace(/<w:nsid\b[^>]*\bw:val="[^"]+"\s*\/>/, `<w:nsid w:val="${String(nextAbs++).padStart(8, '0')}"/>`);
      abstractsToAdd.push(item);
    }
    for (const sourceItem of children(sourceNumbers, 'num')) {
      numsToAdd.push(remapNumbers(remapStyles(sourceItem, styleIds), nums, abstracts));
    }
    hasNum ||= nums.size > 0 || abstracts.size > 0;

    const prefix = `compiled/ch${index + 1}`;
    // Relocated parts keep their original relative paths, including chart rels and embedded media.
    const sourceContentTypes = contentTypeState(await xml(sourceZip, '[Content_Types].xml'));
    for (const [name, entry] of Object.entries(sourceZip.files)) {
      if (entry.dir || !name.startsWith('word/')) continue;
      const relative = name.slice(5);
      if (/^(?:document|styles|numbering|footnotes|endnotes|settings)\.xml$/i.test(relative)
        || /^_rels\/(?:document|styles|numbering|footnotes|endnotes|settings)\.xml\.rels$/i.test(relative)) continue;
      const target = `word/${prefix}/${relative}`;
      output.file(target, await entry.async('nodebuffer'));
      const sourceType = sourceContentTypes.overrides.get('/' + name) || sourceContentTypes.defaults.get(name.split('.').pop().toLowerCase());
      if (!sourceType && !target.endsWith('.rels')) throw new Error(`The Word part ${name} has no declared content type.`);
      if (sourceType && !target.endsWith('.rels')) setContentType(extraTypes, target, sourceType);
    }

    let fragment = remapNumbers(remapStyles(sourceBody.replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>\s*$/, ''), styleIds), nums, abstracts);
    const originalFoot = await xml(sourceZip, 'word/footnotes.xml', false);
    const originalEnd = await xml(sourceZip, 'word/endnotes.xml', false);
    for (const kind of ['footnote', 'endnote']) {
      const original = kind === 'footnote' ? originalFoot : originalEnd;
      const refs = new Set([...fragment.matchAll(new RegExp(`<w:${kind}Reference\\b[^>]*\\bw:id="([^"]+)"`, 'g'))].map(m => m[1]));
      if (!refs.size) continue;
      if (!original) throw new Error(`Chapter ${index + 1} references missing ${kind}s.`);
      const defs = new Map(children(original, kind).map(item => [attr(rootOpen(item, kind), 'w:id'), item]));
      const ids = new Map();
      for (const old of refs) {
        if (!defs.has(old)) throw new Error(`Chapter ${index + 1} has an unresolved ${kind} reference ${old}.`);
        ids.set(old, String(kind === 'footnote' ? nextFoot++ : nextEnd++));
      }
      fragment = remapNotes(fragment, kind, ids);
      const noteRelText = await xml(sourceZip, `word/_rels/${kind}s.xml.rels`, false);
      const noteRelSrc = rels(noteRelText);
      const noteRelTarget = kind === 'footnote' ? footRels : endRels;
      for (const old of refs) {
        let definition = remapNumbers(remapStyles(defs.get(old), styleIds), nums, abstracts);
        definition = remapNotes(definition, kind, ids);
        definition = remapRelations(definition, noteRelSrc, noteRelTarget, prefix, sourceZip);
        notesToAdd[kind].push(definition);
      }
      if (kind === 'footnote') {
        footnotes = mergeNamespaces(footnotes, original, 'footnotes');
        hasFoot = true;
      } else {
        endnotes = mergeNamespaces(endnotes, original, 'endnotes');
        hasEnd = true;
      }
    }
    fragment = remapRelations(fragment, rels(await xml(sourceZip, 'word/_rels/document.xml.rels', false)), docRels, prefix, sourceZip);
    fragment = fragment.replace(/<wp:docPr\b[^>]*>/g, tag => tag.replace(/\bid="\d+"/, `id="${nextDrawingId++}"`));
    document = mergeNamespaces(document, sourceDoc, 'document');
    if (sourceStyles) styles = mergeNamespaces(styles, sourceStyles, 'styles');
    if (sourceNumbers) numbering = mergeNamespaces(numbering, sourceNumbers, 'numbering');
    const marker = `<w:p><w:r><w:t xml:space="preserve">BET_COMPILE_MARKER_${index}</w:t></w:r></w:p>`;
    if (!body.includes(marker)) throw new Error('The compiler chapter placement marker was not found.');
    body = body.replace(marker, fragment);
  }

  styles = insertChildren(styles, 'styles', stylesToAdd.join(''));
  numbering = insertChildren(numbering, 'numbering', abstractsToAdd.join(''), 'num');
  numbering = insertChildren(numbering, 'numbering', numsToAdd.join(''));
  footnotes = insertChildren(footnotes, 'footnotes', notesToAdd.footnote.join(''));
  endnotes = insertChildren(endnotes, 'endnotes', notesToAdd.endnote.join(''));
  // Drop the template's sample text; its styles, page geometry, headers and footers remain.
  document = replaceBody(document, body + baseSection);
  output.file('word/document.xml', document);
  output.file('word/styles.xml', styles);
  ensureCoreRel(docRels, 'styles', 'styles.xml');
  setContentType(extraTypes, 'word/document.xml', MAIN_TYPE);
  setContentType(extraTypes, 'word/styles.xml', PART_TYPES['styles.xml']);
  if (hasNum) {
    output.file('word/numbering.xml', numbering);
    ensureCoreRel(docRels, 'numbering', 'numbering.xml');
    setContentType(extraTypes, 'word/numbering.xml', PART_TYPES['numbering.xml']);
  }
  if (hasFoot) {
    output.file('word/footnotes.xml', footnotes);
    ensureCoreRel(docRels, 'footnotes', 'footnotes.xml');
    setContentType(extraTypes, 'word/footnotes.xml', PART_TYPES['footnotes.xml']);
    output.file('word/_rels/footnotes.xml.rels', relXml(footRels.entries));
  }
  if (hasEnd) {
    output.file('word/endnotes.xml', endnotes);
    ensureCoreRel(docRels, 'endnotes', 'endnotes.xml');
    setContentType(extraTypes, 'word/endnotes.xml', PART_TYPES['endnotes.xml']);
    output.file('word/_rels/endnotes.xml.rels', relXml(endRels.entries));
  }
  output.file('word/_rels/document.xml.rels', relXml(docRels.entries));
  // An attached template must never be followed, copied or regenerated.
  const settings = await xml(output, 'word/settings.xml', false);
  if (settings) output.file('word/settings.xml', settings.replace(/<w:attachedTemplate\b[^>]*\/?\s*>/g, ''));
  const settingRels = await xml(output, 'word/_rels/settings.xml.rels', false);
  if (settingRels) output.file('word/_rels/settings.xml.rels', settingRels.replace(/<Relationship\b(?=[^>]*\bType="[^"]*\/attachedTemplate")[^>]*\/?\s*>/g, ''));
  writeContentTypes(output, typesText, extraTypes);
  return output.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}


module.exports = { combineDocx };