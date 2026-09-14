import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mediaShowsPreview, operateSelectedMedia } from '../lib/media-selection';
import { captionTripAttachment } from '../lib/offline/trip-attachments';

describe('Media preview privacy and selected-file operations', () => {
  it('keeps unknown and document categories compact while explicitly marked photos can preview', () => {
    const categories = { photo: 'Photo / video', passport: 'Passport / identity', medical: 'Medical', general: 'General document' };
    expect(mediaShowsPreview('photo',true,'Photo / video',categories)).toBe(true);
    for (const id of ['passport','medical','general','unknown']) expect(mediaShowsPreview(id,true,'Photo / video',categories)).toBe(false);
    expect(mediaShowsPreview('photo',true)).toBe(false);
    expect(mediaShowsPreview('photo',false)).toBe(true);
  });
  it('operates once per stable ID and not by duplicate filenames', async () => {
    const operation = vi.fn(async () => {});
    const a = {id:'a',fileName:'same.png'}, b = {id:'b',fileName:'same.png'};
    const result = await operateSelectedMedia([a,b,a],operation);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(result.completedIds).toEqual(['a','b']);
    expect(result.failed).toEqual([]);
  });
  it('continues after a failure and retains the failed ID/name for focused retry', async () => {
    const files = ['a','b','c'].map(id=>({id,fileName:`${id}.png`}));
    const result = await operateSelectedMedia(files,async file=>{if(file.id==='b') throw Error('Reconnect');});
    expect(result.completedIds).toEqual(['a','c']);
    expect(result.failed).toEqual([{id:'b',fileName:'b.png',error:'Reconnect'}]);
    const retry = vi.fn(async () => {});
    await operateSelectedMedia(result.failed,retry);
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it('updates only the selected attachment caption without changing original metadata', () => {
    const first = {id:'a',fileName:'original.png',contentType:'image/png',category:'Photo / video',sizeBytes:20,createdAt:'2026-09-14',futureFact:'keep'};
    const second = {...first,id:'b'};
    const original = [first,second];
    const updated = captionTripAttachment(original,first,'Edited caption');
    expect(updated[0]).toEqual({...first,caption:'Edited caption'});
    expect(updated[1]).toEqual(second);
    expect(original[0]).not.toHaveProperty('caption');
  });
  it('adds legacy caption metadata without inventing unavailable size or capture time', () => {
    const updated = captionTripAttachment([],{id:'legacy',fileName:'old.png',contentType:'image/png'},'Caption')[0]!;
    expect(updated.category).toBe('General document');
    expect(updated).not.toHaveProperty('sizeBytes');
    expect(updated).not.toHaveProperty('createdAt');
  });
  it('reuses contained dialogs and excludes compact documents from image browsing', () => {
    const source = readFileSync('components/media-gallery.tsx','utf8');
    expect(source).toContain("item.contentType.startsWith('image/') && hasPreview(item)");
    expect(source).toContain('Confirm selected attachment deletion');
    expect(source).toContain('This cannot be undone.');
    expect(source).toContain('Edit selected media files');
    expect(source).toContain('removedReferences.map');
    const api = readFileSync('app/api/media/route.ts','utf8').split('export async function PATCH')[1]!;
    expect(api).toContain('if (!user)');
    expect(api).toContain('row.ownerKind !== input.ownerKind || row.ownerId !== input.ownerId');
    expect(api).toContain('householdCanEditGear');
    expect(api).toContain('albumAccess(user, row.ownerId, true)');
    expect(api).toContain('WHERE id=? AND user_id=? AND owner_kind=? AND owner_id=?');
  });
});
