# Selected export checkpoint — local, not released

Issues #75/#76/#78 are implemented on the preserved selected-task branch. The local card displays correctly but the previous export fetched its temporary Blob URL and raised TypeError during transport before decoding. The corrected renderer uses the existing owner-scoped source resolver and browser image loader used by the card preview, with bounded decoding, crop/aspect preservation, resource cleanup and safe stage-only failures. No attachment or Certification source rewrite is performed. The audited owner image metadata has 25 complete front/back references; no private keys were copied into this evidence.

Licensed SIL OFL 1.1 Noto Sans and Noto Sans JP fonts are embedded for Unicode. Font coverage includes accented Latin, Greek, Cyrillic, Japanese and subscript characters. Unsupported PDF glyphs fail clearly instead of silently dropping text; text fallbacks remain available. Fonts load only for Unicode exports and their TTF files are excluded from the ordinary PWA precache. DOCX runs explicitly select fonts; supported viewers may substitute a host font. Unicode survived the actual LibreOffice rendering.

One shared projection counts each normalised mode/activity once per Dive without rewriting saved tags. All five formats retain selected sections, equipment, exact records and opt-in numbers. Text exports do not load card images. The UI explains that image pixels may contain details excluded from text.

## Evidence

- Focused export/backup secret-boundary tests: 4 files / 32 PASS, including new cases originally failing for stage diagnostics, Blob transport and explicit DOCX font selection. Typecheck PASS. All nine approved frozen hashes match.
- Actual local browser downloads: PDF, DOCX, TXT, CSV and JSON. The fixture title contains accented Latin, Greek, Japanese and Cyrillic. All five contain selected equipment, awards and final Dive #75; the dummy certification number is excluded.
- PDF: four pages rendered with PDFium, all inspected. DOCX: four pages converted/rendered with verified official LibreOffice 26.8.0, all inspected. Card image, wrapping and last Dive retained; no clipped text or image observed. These are isolated local fixtures, not exported real-owner documents published externally.
- Actual five-format empty selection: no unselected award or Dive retained; PDF has one usable page. Unit fixtures cover long records over multiple pages, unavailable images, unsupported glyphs, immutable inputs and CSV formula protection. Private fixtures/artifacts and complete logs remain ignored under work/selected-tasks.
- Production remains Sites141/app1.0.70. No production save, Gmail operation, push or deployment. Full finished-candidate gate and live export acceptance remain outstanding.
