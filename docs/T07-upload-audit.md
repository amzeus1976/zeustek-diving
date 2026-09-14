# T07 existing-upload audit

Current source inspected, not an assumed list. Existing upload collection paths only; no uploader added to an unrelated page.

| Existing picker | Shape / batch decision |
| --- | --- |
| MediaGallery: Dive, Site, RecordDetail, People media, Albums, conservation activity, overhead profile, gas evidence and Trip details | Shared multiple picker; staged per-file review/removal; deterministic independent upload; successful originals kept; filename-specific failures; stable upload IDs; picker reset; retry links without reupload. |
| Trip itinerary item | Same MediaGallery / authenticated API; separate owner `dive-trip-itinerary` and `tripId:itemId`. No second blob store. |
| GearWishlistForm images | Existing multiple picker and cover chooser retained; shared independent batch helper; stable file IDs; failed originals retained; saved item ID reused on retry; successes append. |
| Knowledge Centre question package import | Already multiple JSON/ZIP/RAR importer, not a media attachment store; retained. |
| Equipment-set icon; Settings category icon / agency logo | Deliberate single replaceable identity slot, not an attachment collection. Preserve single selection; do not silently discard all but first of a multi-selection or invent an icon gallery. |
| Certification front/back; Person ProfilePicture; Site map image | Deliberate separate single image slots with crop/local image processing/history. Preserve slots and existing MIME/size/object-URL behaviour; additional media collection uses the existing shared gallery. |
| Skills CSV; backup restore; media recommendations JSON | Structured import/restore, not file attachments. Preserve existing validation/preview and atomic single-package semantics; batch restore would be destructive. |

Original cloud media remains private/account-authorised and connection-dependent, as before. Previously loaded account-scoped metadata remains available offline. New links and attachment metadata use canonical Trip mutation/events/outbox and backup. No claim that unavailable original binaries are cached offline or encrypted by a new subsystem.

Trip-level originals render compact explicit Open links including sensitive image documents, never overview thumbnails. Itinerary originals render grouped Photos/Videos/Documents; links separate. Metadata includes stable ID, original filename, MIME, size, capture time and category; filenames never identity.

Local acceptance passed: batch append (5+3), partial failure, duplicate filenames, private Trip documents, itinerary PDF/link isolation, unsafe-link rejection, keyboard/disclosure/focus and responsive reflow. Owner resolved the native confirmation; rendered deletion postconditions and reopening confirm only the synthetic PDF removed while10 accommodation images and Trip-only originals remain. Ordinary Site batch2 persists without changed Site facts. Wishlist appends selections, removes staged files, persists its selected cover and successful originals across partial failure/retry without a duplicate item. Production acceptance remains pending; candidate app1.0.20 has not been published. T07-B is not CLOSED until production acceptance passes. New assets retain actual size/time; unavailable legacy size/capture metadata is left absent rather than invented.
