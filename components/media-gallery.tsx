'use client';
import { ChevronLeft, ChevronRight, ImagePlus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { loadMediaMetadata } from '../lib/offline/media-metadata';
import { AccessibleDialog } from './accessible-dialog';
import { appendMediaSelection, uploadMediaBatch, type PendingMediaFile, type UploadedMediaFile } from '../lib/media-batch';
import { mediaShowsPreview, operateSelectedMedia } from '../lib/media-selection';
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
  onRemoved,
  accessibleViewer = false,
  compact = false,
  previewCategory,
  onUploadedAssets,
  categories,
  categoryById,
  onCategoryChange,
  onPendingChange,
  onCaptionChange,
  showHeading = true,
}: {
  ownerKind: string;
  ownerId: string;
  featuredIds?: string[];
  onFeaturedChange?: (ids: string[]) => void;
  retainOfflineMetadata?: boolean;
  acceptFiles?: boolean;
  onUploaded?: (ids: string[]) => Promise<void>;
  onRemoved?: (id: string) => Promise<void>;
  accessibleViewer?: boolean;
  compact?: boolean;
  previewCategory?: string | undefined;
  onUploadedAssets?: (assets: UploadedMediaFile[]) => Promise<void>;
  categories?: readonly string[];
  categoryById?: Record<string, string>;
  onCategoryChange?: (id: string, category: string, asset: Asset) => Promise<void>;
  onPendingChange?: ((pending: boolean) => void) | undefined;
  onCaptionChange?: (asset: Asset, caption: string) => Promise<void>;
  showHeading?: boolean;
}) {
  const [items, setItems] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [mediaUnavailable, setMediaUnavailable] = useState(false);
  const [pending, setPending] = useState<PendingMediaFile[]>([]);
  const [unlinked, setUnlinked] = useState<UploadedMediaFile[]>([]);
  const [progress, setProgress] = useState('');
  const [removedReferences,setRemovedReferences] = useState<Array<{id:string;fileName:string}>>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [editingSelection, setEditingSelection] = useState(false);
  const [changeCaption, setChangeCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');
  const selectedItems = items.filter(item => selectedIds.includes(item.id));
  const editDirty = editingSelection && Boolean(changeCaption || categoryDraft);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {setSelectedIds([]);setDeleteIds(null);setEditingSelection(false);setRemovedReferences([]);}, [ownerKind,ownerId]);
  useEffect(() => {
    onPendingChange?.(pending.length > 0 || unlinked.length > 0 || busy || editDirty);
    if (!pending.length && !unlinked.length && !busy && !editDirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload',protect);
    return () => window.removeEventListener('beforeunload',protect);
  }, [pending.length,unlinked.length,busy,editDirty,onPendingChange]);
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
  async function add() {
    if (!pending.length || busy) return;
    setBusy(true);
    setUploadError('');
    try {
      const result = await uploadMediaBatch(pending, ownerKind, ownerId, fetch, (done,total) => setProgress(`${done} of ${total} files processed`));
      setPending(result.failed.map(({id,file}) => ({id,file})));
      setUploadError(result.failed.map(item => `${item.file.name}: ${item.error}`).join(' '));
      if (result.uploaded.length) {
        try { await link([...unlinked, ...result.uploaded]); setUnlinked([]); }
        catch { setUnlinked(current => [...current, ...result.uploaded]); setUploadError(current => `${current} Originals uploaded; linking failed. Retry linking existing references without reuploading.`); }
        refresh();
      }
    } finally { setBusy(false); }
  }
  async function link(assets: UploadedMediaFile[]) {
    if (onUploadedAssets) await onUploadedAssets(assets);
    if (onUploaded) await onUploaded(assets.map(asset => asset.id));
  }
  async function removeOriginal(id: string) {
    const response = await fetch(`/api/media?id=${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Attachment could not be deleted. Reconnect and retry.');
    setItems(current => current.filter(item => item.id !== id));
    try { if (onRemoved) await onRemoved(id); }
    catch { setRemovedReferences(current => [...current.filter(item => item.id !== id),{id,fileName:items.find(item=>item.id===id)?.fileName ?? 'Deleted attachment'}]); throw new Error('Original deleted, but reference update failed. Retry removing this reference.'); }
  }
  async function deleteSelected() {
    if (!deleteIds || busy) return;
    setBusy(true); setUploadError('');
    try {
      const result = await operateSelectedMedia(items.filter(item => deleteIds.includes(item.id)), item => removeOriginal(item.id));
      setSelectedIds(result.failed.map(item => item.id));
      setUploadError(result.failed.map(item => `${item.fileName}: ${item.error}`).join(' '));
      setDeleteIds(null); refresh();
    } finally { setBusy(false); }
  }
  async function editSelected() {
    if (busy || (!changeCaption && !categoryDraft)) return;
    setBusy(true); setUploadError('');
    try {
      const result = await operateSelectedMedia(selectedItems, async item => {
        if (changeCaption) {
          const response = await fetch('/api/media', {method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:item.id,ownerKind,ownerId,caption:captionDraft})});
          if (!response.ok) throw new Error('Caption could not be saved. Reconnect and retry.');
          try { await onCaptionChange?.(item,captionDraft); }
          catch { throw new Error('Caption saved online; saved reference needs retry.'); }
        }
        if (categoryDraft && onCategoryChange) {
          try { await onCategoryChange(item.id,categoryDraft,item); }
          catch { throw new Error(changeCaption ? 'Caption saved; category update needs retry.' : 'Category update needs retry.'); }
        }
      });
      setSelectedIds(result.failed.map(item => item.id));
      setUploadError(result.failed.map(item => `${item.fileName}: ${item.error}`).join(' '));
      if (!result.failed.length) { setEditingSelection(false); setChangeCaption(false); setCategoryDraft(''); }
      refresh();
    } finally { setBusy(false); }
  }
  const hasPreview = (item: Asset) => mediaShowsPreview(item.id,compact,previewCategory,categoryById);
  const imageIndices = items.flatMap((item,index) => item.contentType.startsWith('image/') && hasPreview(item) ? [index] : []);
  const imagePosition = lightboxIndex == null ? -1 : imageIndices.indexOf(lightboxIndex);
  const groupName = (item: Asset) => !hasPreview(item) ? 'Documents' : item.contentType.startsWith('image/') ? 'Photos' : item.contentType.startsWith('video/') ? 'Videos' : 'Documents';
  const grouped = items.map((item,index)=>({item,index})).sort((a,b)=>groupName(a.item).localeCompare(groupName(b.item)));
  const viewerContents = lightboxIndex != null && items[lightboxIndex] ? <>
    <button className="media-lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="Close full-size media"><X /></button>
    {imageIndices.length > 1 && <button className="media-lightbox-prev" onClick={() => setLightboxIndex(imageIndices[(imagePosition - 1 + imageIndices.length) % imageIndices.length]!)} aria-label="Previous image"><ChevronLeft /></button>}
    <div onClick={(event) => event.stopPropagation()}>
      <img src={`/api/media?id=${items[lightboxIndex].id}`} alt={items[lightboxIndex].caption || items[lightboxIndex].fileName} />
      <p>{items[lightboxIndex].caption || items[lightboxIndex].fileName} · {imagePosition + 1} of {imageIndices.length}</p>
    </div>
    {imageIndices.length > 1 && <button className="media-lightbox-next" onClick={() => setLightboxIndex(imageIndices[(imagePosition + 1) % imageIndices.length]!)} aria-label="Next image"><ChevronRight /></button>}
  </> : null;
  return (
    <section className="media-section">
      <div className="media-head">
        {showHeading && <div>
          <b>{acceptFiles ? 'Photos, videos & evidence files' : 'Photos & videos'}</b>
          <small>Originals stay private in your cloud account.</small>
        </div>}
        <button
          type="button"
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
        aria-label="Choose multiple media files"
        disabled={busy || mediaUnavailable}
        onChange={(e) => { const selectedFiles = Array.from(e.target.files ?? []); setPending(current => appendMediaSelection(current, selectedFiles)); e.target.value = ''; }}
      />
      <small>Select several files at once. Each batch appends; images/videos and supported files must be under 75 MB each. Upload originals while connected.</small>
      {!!pending.length && <section className="media-batch-pending" aria-label="Selected files before upload"><ul>{pending.map(item => <li key={item.id}><span>{item.file.name} · {(item.file.size / 1024).toFixed(1)} KB</span><button type="button" className="focus-secondary" disabled={busy} aria-label={`Remove selected ${item.file.name}`} onClick={() => setPending(current => current.filter(file => file.id !== item.id))}>Remove</button></li>)}</ul><button className="focus-primary" type="button" disabled={busy || mediaUnavailable} onClick={() => void add()}>{busy ? 'Uploading…' : `Upload ${pending.length} selected files`}</button></section>}
      {progress && <p role="status">{progress}</p>}
      {removedReferences.map(item => <button key={item.id} type="button" className="focus-secondary" onClick={async()=>{try{await onRemoved?.(item.id);setRemovedReferences(current=>current.filter(reference=>reference.id!==item.id));setUploadError('');refresh();}catch{setUploadError(`${item.fileName}: reference cleanup still needs a connection; retry later.`);}}}>Retry removing deleted reference {item.fileName}</button>)}
      {!!unlinked.length && <button className="focus-secondary" type="button" disabled={busy} onClick={async () => { try { await link(unlinked); setUnlinked([]); setUploadError(''); refresh(); } catch { setUploadError('Linking failed; saved originals and IDs are retained.'); } }}>Retry linking uploaded files</button>}
      {items.length ? (
        <>
        <div className="media-selection-toolbar" role="group" aria-label="File selection controls">
          <button type="button" className="focus-secondary" disabled={busy} onClick={() => setSelectedIds(items.map(item => item.id))}>Select all files</button>
          <span role="status">{selectedItems.length} selected files</span>
          {!!selectedItems.length && <>
            <button type="button" className="focus-secondary" disabled={busy} onClick={() => setSelectedIds([])}>Clear selection</button>
            <button type="button" className="focus-secondary" disabled={busy || (mediaUnavailable && !onCategoryChange)} onClick={() => {setChangeCaption(false);setCaptionDraft('');setCategoryDraft('');setEditingSelection(true);}}>Edit selected files</button>
            <button type="button" className="focus-secondary danger" disabled={busy || mediaUnavailable} onClick={() => setDeleteIds(selectedItems.map(item => item.id))}>Delete selected files</button>
          </>}
        </div>
        <div className={compact ? 'media-compact-list' : 'media-grid'}>
          {grouped.map(({item,index},position) => (
            <Fragment key={item.id}>{(position===0 || groupName(grouped[position-1]!.item)!==groupName(item)) && <h4 className="media-group-heading">{groupName(item)}</h4>}<figure className={(featuredIds ?? []).includes(item.id) ? 'story-featured-media' : undefined}>
              <label className="media-select-file"><input type="checkbox" disabled={busy} checked={selectedIds.includes(item.id)} aria-label={`Select ${item.fileName}`} onChange={event => {const checked=event.target.checked;setSelectedIds(current => checked ? [...new Set([...current,item.id])] : current.filter(id => id !== item.id));}}/>Select file</label>
              {mediaUnavailable ? <p className="media-empty">Original available when connected</p> : !hasPreview(item) ? <a className="focus-link" href={`/api/media?id=${encodeURIComponent(item.id)}`} target="_blank" rel="noopener noreferrer">Open {item.fileName}</a> : item.contentType.startsWith('video/') ? (
                <video controls src={`/api/media?id=${item.id}`} />
              ) : !item.contentType.startsWith('image/') ? (
                <a className="focus-link" href={`/api/media?id=${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer">Open {item.caption || item.fileName}</a>
              ) : (
                <button className="media-open" onClick={() => setLightboxIndex(index)} aria-label={`Open ${item.caption || item.fileName} full size`}><img src={`/api/media?id=${item.id}`} alt={item.caption || item.fileName} /></button>
              )}
              <figcaption>{item.caption || item.fileName}</figcaption>
              {categories && onCategoryChange && <label>Attachment category<select value={categoryById?.[item.id] ?? 'General document'} onChange={event => { void onCategoryChange(item.id,event.target.value,item).catch(() => setUploadError('Category update failed. Saved references are retained.')); }}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>}
              {onFeaturedChange && <label className="story-media-feature"><input type="checkbox" checked={(featuredIds ?? []).includes(item.id)} onChange={event => onFeaturedChange(event.target.checked ? [...new Set([...(featuredIds ?? []), item.id])] : (featuredIds ?? []).filter(id => id !== item.id))} />Feature in Story</label>}
              {hasPreview(item) && !mediaUnavailable && item.contentType.startsWith('image/') && (
                <PhotoEditor
                  asset={item}
                  ownerKind={ownerKind}
                  ownerId={ownerId}
                  done={refresh}
                />
              )}
              <button
                className="media-delete"
                disabled={mediaUnavailable || busy}
                onClick={() => setDeleteIds([item.id])}
                aria-label="Delete media"
              >
                <Trash2 size={14} />
              </button>
            </figure></Fragment>
          ))}
        </div>
        </>
      ) : (
        !loadError && <p className="media-empty">No media attached yet.</p>
      )}
      {loadError && <p role="status" className="media-empty">{loadError} <button className="focus-secondary" onClick={refresh}>Retry media</button></p>}
      {uploadError && <p role="alert" className="media-empty">{uploadError}</p>}
      {onFeaturedChange && <p className="story-media-help">{featuredIds?.length ?? 0} featured. Unticking removes a highlight, not the original attachment.</p>}
      {editingSelection && <AccessibleDialog label="Edit selected media files" className="focus-modal media-bulk-dialog" editable dirty={editDirty} containDismiss close={() => setEditingSelection(false)}>
        <h3>Edit {selectedItems.length} selected files</h3>
        <p>Only selected file captions/categories change. Original filenames, files and linked records stay unchanged.</p>
        <label><input type="checkbox" checked={changeCaption} disabled={busy || mediaUnavailable} onChange={event => setChangeCaption(event.target.checked)}/>Change selected captions</label>
        <label>Shared caption<input type="text" maxLength={1000} disabled={!changeCaption || busy} value={captionDraft} onChange={event => setCaptionDraft(event.target.value)}/></label>
        {categories && onCategoryChange && <label>Shared attachment category<select disabled={busy} value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)}><option value="">Keep existing categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>}
        {mediaUnavailable && <p>Categories can save locally. Caption edits need a connection.</p>}
        {!!uploadError && <p role="alert">{uploadError}</p>}
        <div><button type="button" className="focus-secondary" data-dialog-close disabled={busy} onClick={() => setEditingSelection(false)}>Cancel</button><button type="button" className="focus-primary" disabled={busy || !editDirty} onClick={() => void editSelected()}>{busy ? 'Saving…' : 'Save selected changes'}</button></div>
      </AccessibleDialog>}
      {deleteIds && <AccessibleDialog label="Confirm selected attachment deletion" className="focus-modal media-bulk-dialog" editable={busy} containDismiss close={() => setDeleteIds(null)}>
        <h3>Delete {deleteIds.length} selected files?</h3>
        <p>This permanently removes only these originals and their attachment references. Other files and linked Dives, Sites, Plans and Trips stay unchanged. This cannot be undone.</p>
        <ul>{items.filter(item => deleteIds.includes(item.id)).map(item => <li key={item.id}>{item.fileName}</li>)}</ul>
        <div><button type="button" className="focus-secondary" disabled={busy} onClick={() => setDeleteIds(null)}>Cancel</button><button type="button" className="focus-primary danger" disabled={busy} onClick={() => void deleteSelected()}>{busy ? 'Deleting…' : `Delete ${deleteIds.length} selected files`}</button></div>
      </AccessibleDialog>}
      {lightboxIndex != null && items[lightboxIndex] && (accessibleViewer ? <AccessibleDialog label="Full resolution media viewer" className="media-lightbox overhead-media-viewer" containDismiss close={() => setLightboxIndex(null)}>{viewerContents}</AccessibleDialog> : (
        <div className="media-lightbox" role="dialog" aria-modal="true" aria-label="Full resolution media viewer" onClick={() => setLightboxIndex(null)}>
          <button className="media-lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="Close"><X /></button>
          {items.length > 1 && <button className="media-lightbox-prev" onClick={(event) => { event.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + items.length) % items.length); }} aria-label="Previous image"><ChevronLeft /></button>}
          <div onClick={(event) => event.stopPropagation()}>
            <img src={`/api/media?id=${items[lightboxIndex].id}`} alt={items[lightboxIndex].caption || items[lightboxIndex].fileName} />
            <p>{items[lightboxIndex].caption || items[lightboxIndex].fileName} · {lightboxIndex + 1} of {items.length}</p>
          </div>
          {items.length > 1 && <button className="media-lightbox-next" onClick={(event) => { event.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % items.length); }} aria-label="Next image"><ChevronRight /></button>}
        </div>
      ))}
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
