# Phone planning and offline use

Open `/phone` for the opt-in phone interface. The root desktop interface and its layout are retained. Automatic phone selection is disabled until physical iPhone acceptance is complete.

On iPhone, open the phone page in Safari and add it to the Home Screen. Launch that installed app while online, sign in, then choose **More → Download for offline use**. Wait for the complete-download confirmation before leaving coverage. Safari and the installed app have separate local storage. An existing installation can choose **Phone** under **More → Interface & device**.

## Viewing

The phone provides a dated Dive day timeline, Events and Trips, full booking codes, itinerary, Dive Plans, linked Gas Plans, equipment checks, saved conditions, team and Dive Centre contacts. Expand the detail cards to read the complete stored planning information. Advanced plans remain fully viewable. Source documents and external links require their own download; the app does not claim to cache attached PDFs or third-party websites.

Detail cards load when opened. Long saved lists show 20 items at a time; **Previous items** and **Next items** reach every item. No stored list items or planning fields are truncated.

## Writing

Basic recreational Dive Plans and single-cylinder, direct-ascent Gas Plans can be created, updated and duplicated. Gas calculations use the existing desktop engine in a background worker. Unknown inputs remain unknown. Technical and advanced Gas Plans use the full interface for editing.

Person and Dive Centre forms include the full contact, address, emergency, qualification, affiliation, service, photo and notes fields. Actual logged dive measurements are entered separately from planned measurements. Existing logbook numbers are retained.

There are no separate phone and desktop copies. A new phone plan becomes a new canonical record. Editing an existing plan retains its ID; duplication creates a new one. Offline writes remain on that device until **Sync now**. New contacts upload before dependent plans and dives.

Forms keep durable device drafts. Leaving an editor, reopening the app or reconnecting retains them. If the saved record changed, compare the latest version and the draft, then apply the reviewed changes and Save. Both preceding versions remain in the device review archive and its export. Cloud conflicts retain both versions for review.

## Connection and account boundaries

The phone never automatically uploads or downloads records. Reconnection asks for an explicit sync before further changes. Sync checks the current signed-in account before uploading. Sign-out removes offline account access while retaining unsent records and drafts in their original account namespace. Do not clear browser storage or remove the installed app to resolve a sync error.

Only the anonymous offline bootstrap HTML and anonymous component payload are cached. Authenticated HTML, private APIs and credential metadata are not replayed from the service worker. The phone manifest shares the existing PWA identity and data store.

## Release acceptance

Automated regression, protected-calculation hashes, type checking, changed-file lint, privacy scanning, desktop checks and local offline cold-start checks are required before release. Physical iPhone acceptance remains a separate check: installation, full offline viewing, draft recovery, keyboard and safe-area behavior, Gas calculation, and manual sync after returning online. Until that passes, `/phone` remains opt-in.
