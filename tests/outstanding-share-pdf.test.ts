import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib';
import { zlibSync } from 'fflate';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import { sanitizeSharePdf } from '../lib/sharing/share-pdf';
export async function dummySharePdf() {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle('PRIVATE-TITLE');
  doc.setAuthor('PRIVATE-AUTHOR');
  doc.setSubject('PRIVATE-SUBJECT');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 2; index++) {
    const page = doc.addPage([420, 594]);
    page.drawText(`Dummy selected document - page ${index + 1}`, {
      x: 35,
      y: 540,
      size: 18,
      font,
    });
    page.drawRectangle({
      x: 35,
      y: 400,
      width: 250,
      height: 90,
      color: rgb(0.05, 0.7, 0.8),
    });
    page.drawText('Final record remains visible', {
      x: 35,
      y: 60,
      font,
      size: 14,
    });
  }
  doc.addJavaScript('PRIVATE-SCRIPT', 'app.alert("PRIVATE-SCRIPT")');
  await doc.attach(
    new TextEncoder().encode('PRIVATE-EMBEDDED'),
    'PRIVATE-FILE.txt',
  );
  return await doc.save({ useObjectStreams: false, addDefaultPage: false });
}
describe('bounded shared PDF derivative', () => {
  it('rejects external reference XObjects and excessive syntax nesting before publishing', async () => {
    const doc = await PDFDocument.create(),
      page = doc.addPage();
    const external = doc.context.stream(new TextEncoder().encode('q Q'), {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 100, 100],
      Ref: { F: PDFString.of('PRIVATE-EXTERNAL.pdf'), Page: 0 },
    });
    page.node.set(
      PDFName.of('Resources'),
      doc.context.obj({
        XObject: { External: doc.context.register(external) },
      }),
    );
    page.node.set(
      PDFName.of('Contents'),
      doc.context.register(
        doc.context.stream(new TextEncoder().encode('/External Do')),
      ),
    );
    await expect(
      sanitizeSharePdf(await doc.save({ useObjectStreams: false })),
    ).rejects.toThrow();
    await expect(
      sanitizeSharePdf(
        new TextEncoder().encode(
          '%PDF-1.7\n1 0 obj\n' +
            '['.repeat(26) +
            '0' +
            ']'.repeat(26) +
            '\nendobj\n%%EOF',
        ),
      ),
    ).rejects.toThrow();
  });
  it('preserves static page content in a fresh document while excluding metadata, active actions and embedded files', async () => {
    const source = await dummySharePdf(),
      before = source.slice(),
      result = await sanitizeSharePdf(source),
      doc = await PDFDocument.load(result.bytes, { updateMetadata: false });
    expect(result.pages).toBe(2);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 420, height: 594 });
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.getTitle()).toBeUndefined();
    const raw = new TextDecoder('latin1').decode(result.bytes);
    expect(raw).not.toMatch(
      /PRIVATE-|\/JavaScript|\/OpenAction|\/EmbeddedFiles|\/Annots|\/Metadata|\/AcroForm/,
    );
    expect(source).toEqual(before);
  });
  it('rejects malformed, encrypted, compressed-object, excessive-page and interactive/signed PDFs rather than guessing their appearance', async () => {
    for (const bytes of [
      new TextEncoder().encode('%PDF-1.7\ntruncated'),
      new Uint8Array(2 * 1024 * 1024 + 1),
      new TextEncoder().encode('%PDF-1.7\n/Encr#79pt true\n%%EOF'),
    ])
      await expect(sanitizeSharePdf(bytes)).rejects.toThrow();
    const compressed = await PDFDocument.create();
    compressed.addPage();
    await expect(sanitizeSharePdf(await compressed.save())).rejects.toThrow();
    const tooMany = await PDFDocument.create();
    for (let i = 0; i < 21; i++) tooMany.addPage();
    await expect(
      sanitizeSharePdf(await tooMany.save({ useObjectStreams: false })),
    ).rejects.toThrow();
    const form = await PDFDocument.create();
    form.addPage();
    form.getForm().createTextField('Private field').addToPage(form.getPage(0));
    await expect(
      sanitizeSharePdf(await form.save({ useObjectStreams: false })),
    ).rejects.toThrow();
  });
  it('bounds deflate streams independently of small compressed inputs and rejects unsupported resource filters', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false }),
      page = doc.addPage();
    page.node.set(
      PDFName.of('Contents'),
      doc.context.register(
        doc.context.stream(zlibSync(new Uint8Array(9 * 1024 * 1024)), {
          Filter: 'FlateDecode',
        }),
      ),
    );
    await expect(
      sanitizeSharePdf(await doc.save({ useObjectStreams: false })),
    ).rejects.toThrow();
    const unsupported = await PDFDocument.create();
    unsupported.addPage().node.set(
      PDFName.of('Contents'),
      unsupported.context.register(
        unsupported.context.stream(new Uint8Array([0]), {
          Filter: 'JBIG2Decode',
        }),
      ),
    );
    await expect(
      sanitizeSharePdf(await unsupported.save({ useObjectStreams: false })),
    ).rejects.toThrow();
  });
  it('rejects crop/rotation/layered appearance that cannot be faithfully represented by the bounded static path', async () => {
    const doc = await PDFDocument.create();
    doc.addPage().setCropBox(5, 5, 100, 100);
    doc.catalog.set(
      PDFName.of('OCProperties'),
      doc.context.obj({ Name: PDFString.of('hidden layer') }),
    );
    await expect(
      sanitizeSharePdf(await doc.save({ useObjectStreams: false })),
    ).rejects.toThrow();
  });
  it('preserves selected multilingual text, page geometry and raster content for actual PDF viewer acceptance', async () => {
    const doc = new jsPDF({ compress: true, putOnlyUsedFonts: true });
    doc.addFileToVFS(
      'NotoSans-Regular.ttf',
      readFileSync('public/fonts/summary/NotoSans-Regular.ttf').toString(
        'base64',
      ),
    );
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.setFont('NotoSans');
    doc.setFontSize(16);
    doc.text('Résumé · Δοκιμή · Übung · Łódź', 20, 30);
    doc.setFontSize(11);
    doc.text(
      'Dummy selected static attachment. Private metadata is removed.',
      20,
      45,
    );
    doc.addImage(
      readFileSync('public/brand/icons/navigation/people.png').toString(
        'base64',
      ),
      'PNG',
      20,
      60,
      32,
      32,
    );
    doc.addPage();
    doc.text('Final record — page 2', 20, 30);
    doc.setProperties({
      title: 'PRIVATE-TITLE',
      author: 'PRIVATE-AUTHOR',
      subject: 'PRIVATE-SUBJECT',
    });
    const source = new Uint8Array(doc.output('arraybuffer')),
      result = await sanitizeSharePdf(source);
    expect(result.pages).toBe(2);
    expect(new TextDecoder('latin1').decode(result.bytes)).not.toMatch(
      /PRIVATE-TITLE|PRIVATE-AUTHOR|PRIVATE-SUBJECT|\/Metadata|\/JavaScript|\/EmbeddedFiles/,
    );
    const folder = process.env.SHARE_PDF_EVIDENCE_DIR;
    if (folder) {
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, 'dummy-source.pdf'), source);
      writeFileSync(join(folder, 'dummy-sanitized.pdf'), result.bytes);
    }
  });
});
