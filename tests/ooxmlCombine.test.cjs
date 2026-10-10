'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const JSZip = require('jszip');
const { combineDocx } = require('../electron/ooxml-combine.cjs');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
const pic = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
const sect = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>';
const body = inner => `<?xml version="1.0"?><w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${inner}${sect}</w:body></w:document>`;
const relationship = (id,type,target) => `<Relationship Id="rId${id}" Type="${R}/${type}" Target="${target}"/>`;
const rels = text => `<?xml version="1.0"?><Relationships xmlns="${P}">${text}</Relationships>`;
const styles = label => `<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Custom"><w:name w:val="${label}"/><w:basedOn w:val="Normal"/></w:style></w:styles>`;
const nums = '<w:numbering xmlns:w="'+W+'"><w:abstractNum w:abstractNumId="0"><w:nsid w:val="00000001"/><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num></w:numbering>';
const note = (type,id,text,withImage=false) => `<w:${type} w:id="${id}"><w:p><w:r><w:t>${text}</w:t></w:r>${withImage?'<w:r><w:drawing><a:blip r:embed="rId3"/></w:drawing></w:r>':''}</w:p></w:${type}>`;
const notes = (type,content)=> `<w:${type}s xmlns:w="${W}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${R}">${content}</w:${type}s>`;
const contentTypes = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;
async function source(index, opts={}){
 const z = new JSZip(); z.file('[Content_Types].xml',contentTypes); z.file('_rels/.rels', rels('<Relationship Id="rId1" Type="'+R+'/officeDocument" Target="word/document.xml"/>'));
 const parts = `<w:p><w:pPr><w:pStyle w:val="Custom"/><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>List ${index}</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:endnoteReference w:id="1"/></w:r></w:p>`;
 const bullet = `<w:p><w:pPr><w:numPr><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>Bullet ${index}</w:t></w:r></w:p>`;
 const table = `<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="5000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>Table ${index}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
 const img = `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture"/><a:blip r:embed="rId2"/></wp:inline></w:drawing></w:r></w:p>`;
 const anchor = `<w:p><w:hyperlink r:id="rId3"><w:r><w:t>Link ${index}</w:t></w:r></w:hyperlink></w:p>`;
 z.file('word/document.xml',body(parts+bullet+table+img+anchor+(opts.altChunk?'<w:altChunk r:id="rId99"/>':'')));
 z.file('word/styles.xml',styles('List style '+index)); z.file('word/numbering.xml',nums);
 z.file('word/_rels/document.xml.rels',rels(relationship(1,'styles','styles.xml')+relationship(2,'image','media/image1.png')+`<Relationship Id="rId3" Type="${R}/hyperlink" Target="https://example.org/?a=1&amp;b=2" TargetMode="External"/>`));
 z.file('word/media/image1.png',pic);
 z.file('word/footnotes.xml',notes('footnote',note('footnote',-1,'separator')+note('footnote',0,'continuation')+note('footnote',1,'Foot '+index, true)));
 z.file('word/endnotes.xml',notes('endnote',note('endnote',-1,'separator')+note('endnote',0,'continuation')+note('endnote',1,'End '+index)));
 z.file('word/_rels/footnotes.xml.rels',rels(relationship(3,'image','media/image1.png')));
 if(opts.macro)z.file('word/vbaProject.bin','BAD');
 return z.generateAsync({type:'nodebuffer'});
}
async function template(){const z=new JSZip(); z.file('[Content_Types].xml',contentTypes.replace('wordprocessingml.document.main+xml','wordprocessingml.template.main+xml'));z.file('_rels/.rels', rels(`<Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/>`));z.file('word/document.xml',body('<w:p><w:r><w:t>EXAMPLE TEMPLATE CONTENT</w:t></w:r></w:p>').replace('12240','13000'));z.file('word/styles.xml',styles('Template'));z.file('word/_rels/document.xml.rels',rels(relationship(1,'styles','styles.xml')));z.file('word/settings.xml',`<w:settings xmlns:w="${W}" xmlns:r="${R}"><w:attachedTemplate r:id="rId9"/></w:settings>`);z.file('word/_rels/settings.xml.rels',rels(`<Relationship Id="rId9" Type="${R}/attachedTemplate" Target="file:///Normal.dotm" TargetMode="External"/>`));return z.generateAsync({type:'nodebuffer'});}
const scaffold = body('<w:p><w:r><w:t xml:space="preserve">BET_COMPILE_MARKER_0</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">BET_COMPILE_MARKER_1</w:t></w:r></w:p>');

function count(xml,fragment){return (xml.match(new RegExp(fragment,'g'))||[]).length}

test('preserves chapter tables, images, numbered lists and distinct footnotes/endnotes with template', async()=>{
 const bytes=await combineDocx(await template(),scaffold,[{bytes:await source(1)},{bytes:await source(2)}]);
 const z=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const text=async p=>z.file(p).async('string');
 const doc=await text('word/document.xml'), foot=await text('word/footnotes.xml'), end=await text('word/endnotes.xml');
 const numbering=await text('word/numbering.xml'), styleText=await text('word/styles.xml');
 assert.equal(count(doc,'<w:tbl>'),2);
 assert.equal(count(doc,'<w:footnoteReference'),2);
 assert.match(doc,/<w:footnoteReference w:id="1"/);
 assert.match(doc,/<w:footnoteReference w:id="2"/);
 assert.match(doc,/<w:endnoteReference w:id="1"/);
 assert.match(doc,/<w:endnoteReference w:id="2"/);
 assert.match(foot,/Foot 1/);assert.match(foot,/Foot 2/);
 assert.match(end,/End 1/);assert.match(end,/End 2/);
 assert.match(doc,/w:numId w:val="1"/); assert.match(doc,/w:numId w:val="2"/);
 assert.match(numbering,/w:num w:numId="1"/);assert.match(numbering,/w:num w:numId="2"/);
 assert.match(numbering,/w:num w:numId="3"/);assert.match(numbering,/w:num w:numId="4"/);
 assert.match(doc,/Bullet 1/);assert.match(doc,/Bullet 2/);
 assert.match(styleText,/w:styleId="BET1_Custom"/);assert.match(styleText,/w:styleId="BET2_Custom"/);
 assert.ok(z.file('word/compiled/ch1/media/image1.png'));
 assert.ok(z.file('word/compiled/ch2/media/image1.png'));
 assert.match(await text('word/_rels/document.xml.rels'),/compiled\/ch1\/media\/image1.png/);
 assert.match(await text('word/_rels/document.xml.rels'),/compiled\/ch2\/media\/image1.png/);
 assert.match(await text('word/_rels/footnotes.xml.rels'),/compiled\/ch1\/media\/image1.png/);
 assert.match(await text('word/_rels/footnotes.xml.rels'),/compiled\/ch2\/media\/image1.png/);
 assert.doesNotMatch(doc,/EXAMPLE TEMPLATE CONTENT/);
 assert.match(doc,/w:w="13000"/);
 assert.doesNotMatch(await text('word/settings.xml'),/attachedTemplate/);
 assert.doesNotMatch(await text('word/_rels/settings.xml.rels'),/attachedTemplate/);
 assert.match(await text('[Content_Types].xml'),/wordprocessingml.document.main\+xml/);
});

test('rejects altChunks and macro-bearing source documents',async()=>{
 const base=await template();
 await assert.rejects(()=>source(1,{altChunk:true}).then(bytes=>combineDocx(base,scaffold,[{bytes}])),/altChunk/);
 await assert.rejects(()=>source(1,{macro:true}).then(bytes=>combineDocx(base,scaffold,[{bytes}])),/macro|vbaProject/i);
});

test('public compiler entry point combines sources without flattening them to text', async () => {
  const { buildDocx } = require('../electron/manuscript-compiler.cjs');
  const input = await source(1);
  const docx = await buildDocx('Edited Book', [{
    id: 'CH01', title: 'Source chapter', stageLabel: 'Final manuscript',
    paragraphs: [], abstractText: 'Abstract prose', sourceBytes: input,
  }], { includeAbstracts: true, includeMetadata: false });
  const zip = await JSZip.loadAsync(docx);
  const xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /Edited Book/);
  assert.match(xml, /CH01: Source chapter/);
  assert.match(xml, /Abstract prose/);
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /<w:footnoteReference/);
  assert.ok(zip.file('word/compiled/ch1/media/image1.png'));
});
