'use client';
import { ChevronLeft, ChevronRight, ImagePlus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadMediaMetadata } from '../lib/offline/media-metadata';
import { AccessibleDialog } from './accessible-dialog';
type Asset = {
  id: string;
  fileName: string;
  contentType: string;
  caption: string;
};
export function MediaGallery({
  ownerKind,
  ownerId,
  featuredIds,
  onFeaturedChange,
  retainOfflineMetadata = false,
  acceptFiles = false,
  onUploaded,
}: {
  ownerKind: string;
  ownerId: string;
  featuredIds?: string[];
  onFeaturedChange?: (ids: string[]) => void;
  retainOfflineMetadata?: boolean;
  acceptFiles?: boolean;
  onUploaded?: (ids: string[]) => Promise<void>;
}) {
  const [items, setItems] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [mediaUnavailable, setMediaUnavailable] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(() => {
    if (retainOfflineMetadata) {
      void loadMediaMetadata(ownerKind, ownerId).then(result => {
        setItems(result.items); setMediaUnavailable(result.unavailable);
        setLoadError(result.unavailable ? 'Media originals need a connection. Saved attachment references remain available.' : '');
      }).catch(() => { setItems([]); setMediaUnavailable(true); setLoadError('Media is unavailable. Existing references are retained.'); });
      return;
    }
    void fetch(
      `/api/media?kind=${encodeURIComponent(ownerKind)}&ownerId=${encodeURIComponent(ownerId)}`,
      { cache: 'no-store' },
    )
      .then((r) => {
        if (!r.ok) throw new Error('Media could not be loaded. Connect and sign in to retry.');
        return r.json() as Promise<{items?:Asset[]}>;
      })
      .then((r) => { setItems(r.items ?? []); setLoadError(''); })
      .catch(() => setLoadError('Media is unavailable right now. Your originals and saved selections are retained.'));
  }, [ownerKind, ownerId, retainOfflineMetadata]);
  useEffect(refresh, [refresh]);
  async function add(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setUploadError('');
    const uploaded: string[] = [];
    try { for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      form.append('ownerKind', ownerKind);
      form.append('ownerId', ownerId);
      const response = await fetch('/api/media', { method: 'POST', body: form });
      if (!response.ok) throw new Error('Upload failed. Your original file and existing references are retained.');
      const result = await response.json() as {id:string};
      uploaded.push(result.id);
    } } catch(error) { setUploadError(error instanceof Error ? error.message : 'Upload failed.'); }
    finally {
      try { if (uploaded.length && onUploaded) await onUploaded(uploaded); }
      catch { setUploadError('Media uploaded, but linking failed. Use Link uploaded media to activity to retry its existing references.'); }
      setBusy(false);
      if (uploaded.length) refresh();
    }
  }
  async function remove(id: string) {
    await fetch(`/api/media?id=${id}`, { method: 'DELETE' });
    refresh();
  }
  return (
    <section className="media-section">
      <div className="media-head">
        <div>
          <b>{acceptFiles ? 'Photos, videos & evidence files' : 'Photos & videos'}</b>
          <small>Originals stay private in your cloud account.</small>
        </div>
        <button
          className="focus-secondary"
          disabled={mediaUnavailable || busy}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={15} />
          {busy ? 'Uploading…' : 'Add media'}
        </button>
      </div>
      <input
        hidden
        ref={input}
        type="file"
        accept={acceptFiles ? 'image/*,video/*,application/pdf,text/plain' : 'image/*,video/*'}
        multiple
        onChange={(e) => void add(e.target.files)}
      />
      {items.length ? (
        <div className="media-grid">
          {items.map((item, index) => (
            <figure key={item.id} className={(featuredIds ?? []).includes(item.id) ? 'story-featured-media' : undefined}>
              {mediaUnavailable ? <p className="media-empty">Original available when connected</p> : item.contentType.startsWith('video/') ? (
                <video controls src={`/api/media?id=${item.id}`} />
              ) : !item.contentType.startsWith('image/') ? (
                <a className="focus-link" href={`/api/media?id=${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer">Open {item.caption || item.fileName}</a>
              ) : (
                <button className="media-open" onClick={() => setLightboxIndex(index)} aria-label={`Open ${item.caption || item.fileName} full size`}><img src={`/api/media?id=${item.id}`} alt={item.caption || item.fileName} /></button>
              )}
              <figcaption>{item.caption || item.fileName}</figcaption>
              {onFeaturedChange && <label className="story-media-feature"><input type="checkbox" checked={(featuredIds ?? []).includes(item.id)} onChange={event => onFeaturedChange(event.target.checked ? [...new Set([...(featuredIds ?? []), item.id])] : (featuredIds ?? []).filter(id => id !== item.id))} />Feature in Story</label>}
              {!mediaUnavailable && item.contentType.startsWith('image/') && (
                <PhotoEditor
                  asset={item}
                  ownerKind={ownerKind}
                  ownerId={ownerId}
                  done={refresh}
                />
              )}
              <button
                className="media-delete"
                disabled={mediaUnavailable}
                onClick={() => void remove(item.id)}
                aria-label="Delete media"
              >
                <Trash2 size={14} />
              </button>
            </figure>
          ))}
        </div>
      ) : (
        !loadError && <p className="media-empty">No media attached yet.</p>
      )}
      {loadError && <p role="status" className="media-empty">{loadError} <button className="focus-secondary" onClick={refresh}>Retry media</button></p>}
      {uploadError && <p role="alert" className="media-empty">{uploadError}</p>}
      {onFeaturedChange && <p className="story-media-help">{featuredIds?.length ?? 0} featured. Unticking removes a highlight, not the original attachment.</p>}
      {lightboxIndex != null && items[lightboxIndex] && (
        <div className="media-lightbox" role="dialog" aria-modal="true" aria-label="Full resolution media viewer" onClick={() => setLightboxIndex(null)}>
          <button className="media-lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="Close"><X /></button>
          {items.length > 1 && <button className="media-lightbox-prev" onClick={(event) => { event.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + items.length) % items.length); }} aria-label="Previous image"><ChevronLeft /></button>}
          <div onClick={(event) => event.stopPropagation()}>
            <img src={`/api/media?id=${items[lightboxIndex].id}`} alt={items[lightboxIndex].caption || items[lightboxIndex].fileName} />
            <p>{items[lightboxIndex].caption || items[lightboxIndex].fileName} · {lightboxIndex + 1} of {items.length}</p>
          </div>
          {items.length > 1 && <button className="media-lightbox-next" onClick={(event) => { event.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % items.length); }} aria-label="Next image"><ChevronRight /></button>}
        </div>
      )}
    </section>
  );
}
function PhotoEditor({
  asset,
  ownerKind,
  ownerId,
  done,
}: {
  asset: Asset;
  ownerKind: string;
  ownerId: string;
  done: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [brightness, setBrightness] = useState(105);
  const [contrast, setContrast] = useState(110);
  const [saturation, setSaturation] = useState(115);
  async function save() {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = `/api/media?id=${asset.id}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) return;
    const form = new FormData();
    form.append(
      'file',
      new File(
        [blob],
        `corrected-${asset.fileName.replace(/\.[^.]+$/, '.jpg')}`,
        { type: 'image/jpeg' },
      ),
    );
    form.append('ownerKind', ownerKind);
    form.append('ownerId', ownerId);
    form.append('caption', `Colour-corrected copy of ${asset.fileName}`);
    await fetch('/api/media', { method: 'POST', body: form });
    setOpen(false);
    done();
  }
  return (
    <>
      {
        <button
          className="media-edit"
          onClick={() => setOpen(true)}
          aria-label="Colour correct"
        >
          <SlidersHorizontal size={14} />
        </button>
      }
      {open && (
        <div className="focus-modal-bg">
          <AccessibleDialog editable label="Colour correct photo" close={() => setOpen(false)} className="focus-modal photo-editor">
            <header>
              <h2>Colour correct photo</h2>
              <button className="focus-icon" aria-label="Close photo editor" data-dialog-close onClick={() => setOpen(false)}>
                <X />
              </button>
            </header>
            <img
              src={`/api/media?id=${asset.id}`}
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
              }}
              alt="Correction preview"
            />
            <label>
              Brightness{' '}
              <input
                type="range"
                min="50"
                max="160"
                value={brightness}
                onChange={(e) => setBrightness(+e.target.value)}
              />
            </label>
            <label>
              Contrast{' '}
              <input
                type="range"
                min="50"
                max="180"
                value={contrast}
                onChange={(e) => setContrast(+e.target.value)}
              />
            </label>
            <label>
              Colour{' '}
              <input
                type="range"
                min="0"
                max="200"
                value={saturation}
                onChange={(e) => setSaturation(+e.target.value)}
              />
            </label>
            <footer>
              <button
                className="focus-secondary"
                data-dialog-close
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="focus-primary" onClick={() => void save()}>
                Save corrected copy
              </button>
            </footer>
          </AccessibleDialog>
        </div>
      )}
    </>
  );
}
