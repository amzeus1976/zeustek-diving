import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  type PDFObject,
} from 'pdf-lib';
import { Unzlib } from 'fflate';
import { sanitizePublicationRaster } from './public-photo';

const MAX_INPUT = 2 * 1024 * 1024,
  MAX_OUTPUT = 4 * 1024 * 1024,
  MAX_STREAM = 8 * 1024 * 1024,
  MAX_DECODED = 24 * 1024 * 1024;
const name = (value: string) => PDFName.of(value);
const invalid = (): never => {
  throw new Error(
    'Use a static PDF up to 2 MB and 20 pages. Encrypted, signed, interactive, layered, rotated/cropped and compressed-object PDFs are unsupported. Export a plain static PDF and review every page.',
  );
};
const stripped = new Set([
  'Metadata',
  'PieceInfo',
  'LastModified',
  'AF',
  'EmbeddedFiles',
  'Names',
  'OpenAction',
  'AA',
  'A',
  'JS',
  'JavaScript',
  'URI',
  'Launch',
  'RichMedia',
  'Filespec',
  'F',
  'FFilter',
  'FDecodeParms',
  'StructParent',
  'StructParents',
  'ActualText',
  'Alt',
  'Author',
  'Subject',
  'Title',
]);
/** This intentionally bounded subset creates a NEW page-only artifact; it never republishes the uploaded original. */
export async function sanitizeSharePdf(bytes: Uint8Array) {
  if (bytes.length < 40 || bytes.length > MAX_INPUT) invalid();
  const raw = new TextDecoder('latin1').decode(bytes);
  if (!/^%PDF-1\.[0-7]/.test(raw) || !raw.trimEnd().endsWith('%%EOF'))
    invalid();
  // Bound syntactic nesting before the parser visits dictionaries/arrays.
  // The supported subset uses ordinary streams; binary stream bytes and literal
  // strings are not interpreted as PDF containers by this conservative scan.
  const syntax = raw.replace(
    /\bstream(?:\r\n|\r|\n)[\s\S]*?endstream/g,
    'stream\nendstream',
  );
  let nesting = 0,
    inString = 0,
    inComment = false,
    escaped = false;
  for (let cursor = 0; cursor < syntax.length; cursor++) {
    const char = syntax[cursor],
      next = syntax[cursor + 1];
    if (inComment) {
      if (char === '\n' || char === '\r') inComment = false;
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '(') {
        if (++inString > 24) invalid();
      } else if (char === ')') inString--;
      continue;
    }
    if (char === '%') {
      inComment = true;
      continue;
    }
    if (char === '(') {
      inString = 1;
      continue;
    }
    if (char === '<' && next !== '<') {
      const end = syntax.indexOf('>', cursor + 1);
      if (end < 0) invalid();
      cursor = end;
      continue;
    }
    if (char === '[' || (char === '<' && next === '<')) {
      if (++nesting > 24) invalid();
      if (char === '<') cursor++;
    } else if (char === ']' || (char === '>' && next === '>')) {
      if (--nesting < 0) invalid();
      if (char === '>') cursor++;
    }
  }
  if (nesting || inString) invalid();
  // Reject object/xref streams BEFORE pdf-lib could inflate them during parsing.
  // PDF names may escape any character, so check their decoded spelling too.
  const names = [...raw.matchAll(/\/([^\s()<>{}[\]%/]+)/g)].map((match) =>
    match[1]!.replace(/#([0-9a-f]{2})/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    ),
  );
  if (
    names.length > 40000 ||
    names.some((value) =>
      [
        'ObjStm',
        'XRef',
        'Encrypt',
        'XFA',
        'Sig',
        'AcroForm',
        'OCProperties',
        'RichMedia',
      ].includes(value),
    ) ||
    (raw.match(/\b\d+\s+\d+\s+obj\b/g)?.length ?? 0) > 6000
  )
    invalid();
  const source = await PDFDocument.load(bytes, {
    updateMetadata: false,
    throwOnInvalidObject: true,
    ignoreEncryption: false,
    capNumbers: false,
  });
  if (
    source.isEncrypted ||
    source.getPageCount() < 1 ||
    source.getPageCount() > 20 ||
    source.context.enumerateIndirectObjects().length > 6000
  )
    invalid();
  let totalDecoded = 0;
  for (const [, object] of source.context.enumerateIndirectObjects())
    if (object instanceof PDFRawStream) {
      const contents = object.getContents(),
        filter = object.dict.lookup(name('Filter'));
      if (filter !== undefined && !(filter instanceof PDFName)) invalid();
      const codec = filter instanceof PDFName ? filter.decodeText() : null;
      if (codec === 'FlateDecode') {
        let decoded = 0,
          a = 1,
          b = 0;
        const stream = new Unzlib((part) => {
          decoded += part.length;
          totalDecoded += part.length;
          if (decoded > MAX_STREAM || totalDecoded > MAX_DECODED) invalid();
          for (const byte of part) {
            a = (a + byte) % 65521;
            b = (b + a) % 65521;
          }
        });
        try {
          for (let cursor = 0; cursor < contents.length; cursor += 256)
            stream.push(
              contents.subarray(cursor, cursor + 256),
              cursor + 256 >= contents.length,
            );
        } catch {
          return invalid();
        }
        if (
          contents.length < 6 ||
          new DataView(
            contents.buffer,
            contents.byteOffset,
            contents.byteLength,
          ).getUint32(contents.length - 4) !==
            ((b << 16) | a) >>> 0
        )
          invalid();
      } else if (codec === 'DCTDecode') {
        const clean = sanitizePublicationRaster(contents, 'image/jpeg');
        source.context.assign(
          source.context.getObjectRef(object)!,
          PDFRawStream.of(object.dict, clean.bytes),
        );
      } else if (codec !== null) invalid();
      else {
        totalDecoded += contents.length;
        if (contents.length > MAX_STREAM || totalDecoded > MAX_DECODED)
          invalid();
      }
      const params = object.dict.lookup(name('DecodeParms'));
      if (params !== undefined) {
        if (!(params instanceof PDFDict)) return invalid();
        for (const [key, value] of params.entries()) {
          const decoded = key.decodeText();
          if (
            !(value instanceof PDFNumber) ||
            !['Predictor', 'Colors', 'BitsPerComponent', 'Columns'].includes(
              decoded,
            )
          )
            return invalid();
          const number = value.asNumber();
          if (
            !Number.isFinite(number) ||
            number < 1 ||
            number > 2048 ||
            (decoded === 'Colors' && number > 4) ||
            (decoded === 'BitsPerComponent' && number !== 8) ||
            (decoded === 'Predictor' &&
              ![1, 2, 10, 11, 12, 13, 14, 15].includes(number))
          )
            invalid();
        }
      }
    }
  const visited = new Set<PDFObject>();
  let visitedCount = 0;
  const scrub = (original: PDFObject, depth = 0, mapping = false): void => {
    if (depth > 24) invalid();
    const object =
      original instanceof PDFRef ? source.context.lookup(original) : original;
    if (!object || visited.has(object)) return;
    visited.add(object);
    if (++visitedCount > 20000) invalid();
    if (object instanceof PDFRawStream) {
      scrub(object.dict, depth + 1);
      return;
    }
    if (object instanceof PDFArray) {
      if (object.size() > 10000) invalid();
      for (let index = 0; index < object.size(); index++)
        scrub(object.get(index), depth + 1);
      return;
    }
    if (object instanceof PDFDict) {
      for (const [key, value] of object.entries()) {
        const decoded = key.decodeText();
        if (!mapping && stripped.has(decoded)) {
          object.delete(key);
          continue;
        }
        if (
          !mapping &&
          [
            'AcroForm',
            'XFA',
            'OCProperties',
            'Ref',
            'OPI',
            'Alternates',
            'Subtype',
          ].includes(decoded) &&
          value instanceof PDFName &&
          ['Type3', 'RichMedia', 'Widget'].includes(value.decodeText())
        )
          invalid();
        if (!mapping && ['Ref', 'OPI', 'Alternates', 'OC'].includes(decoded))
          invalid();
        scrub(
          value,
          depth + 1,
          !mapping &&
            [
              'Font',
              'XObject',
              'ExtGState',
              'ColorSpace',
              'Pattern',
              'Shading',
              'Properties',
            ].includes(decoded),
        );
      }
    }
  };
  const output = await PDFDocument.create({ updateMetadata: false });
  for (const page of source.getPages()) {
    const media = page.getMediaBox(),
      crop = page.getCropBox(),
      rotation = page.getRotation().angle;
    if (
      rotation !== 0 ||
      Object.keys(media).some(
        (key) =>
          media[key as keyof typeof media] !== crop[key as keyof typeof crop],
      ) ||
      ![media.x, media.y, media.width, media.height].every(Number.isFinite) ||
      media.width < 1 ||
      media.height < 1 ||
      media.width > 2000 ||
      media.height > 2000
    )
      invalid();
    const resources = page.node.Resources();
    if (resources) scrub(resources);
    if (resources) page.node.set(name('Resources'), resources);
    page.node.set(
      name('MediaBox'),
      source.context.obj([
        media.x,
        media.y,
        media.x + media.width,
        media.y + media.height,
      ]),
    );
    // pdf-lib's page copier also visits unused dictionary entries. Remove them
    // before embedding, rather than leaving detached private objects in output.
    for (const key of page.node.keys())
      if (
        !['Type', 'Parent', 'MediaBox', 'Resources', 'Contents'].includes(
          key.decodeText(),
        )
      )
        page.node.delete(key);
    // embedPage reads only page content/resources. No source catalog, Info, annotations, actions, attachment tree or private filename is copied.
    const contents = page.node.Contents();
    if (!contents) {
      output.addPage([media.width, media.height]);
      continue;
    }
    const embedded = await output.embedPage(page, {
      left: media.x,
      bottom: media.y,
      right: media.x + media.width,
      top: media.y + media.height,
    });
    const target = output.addPage([media.width, media.height]);
    target.drawPage(embedded, {
      x: 0,
      y: 0,
      width: media.width,
      height: media.height,
    });
    target.node.delete(name('Annots'));
  }
  const derivative = await output.save({
    useObjectStreams: false,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
  if (derivative.length > MAX_OUTPUT) invalid();
  return {
    bytes: derivative,
    contentType: 'application/pdf' as const,
    pages: output.getPageCount(),
  };
}
