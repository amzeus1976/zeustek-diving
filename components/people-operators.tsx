'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react';
import { AccessibleDialog } from './accessible-dialog';
import { BuddyDiveWorkspace } from './people/buddy-dive-workspace';
import {PersonEntityRelationships} from './people/person-entity-relationships';
import { RecordEditorWorkspace } from './shared/record-editor-workspace';
import { PersonAvatar, ProfilePicture } from './profile-picture';
import { useRecordRefresh } from './record-status';
import {
  deletePerson,
  listCertifications,
  listPeople,
  listOperators,
  listPersonEntityLinks,
  savePerson,
  type PersonRecord,
} from '@/lib/offline/dive-planning';
import {projectPersonEntityLinks,relationshipStatus} from '@/lib/operators/entity-relationships';
import {reviewPersonDuplicates} from '@/lib/operators/duplicate-review';
import { listDives, type DiveRecord } from '@/lib/offline/dives';
import {resolvePersonDisplayAwards} from '@/lib/people/certification-evidence';
import {
  assertSingleOwnerProfile,
  derivePersonProfileStats,
  findOwnerProfile,
  hasPersonRole,
  personDisplayName,
  refreshPersonDerivedStats,
  sourceLabel,
  type StoredPerson,
} from '@/lib/offline/people-profiles';
import styles from './people-operators.module.css';

type DraftPerson = Omit<PersonRecord, 'createdAt' | 'modifiedAt'> & {
  entityId?: string;
};

const emptyPerson = (ownerProfile = false): DraftPerson => ({
  name: '',
  displayName: '',
  forename: '',
  surname: '',
  membershipId: '',
  role: 'buddy',
  roles: { ownerProfile, buddy: !ownerProfile },
  agency: '',
  highestQualification: '',
  membershipNumber: '',
  email: '',
  phone: '',
  emergencyContact: '',
  emergencyContactName: '',
  emergencyContactNumber: '',
  address: '',
  postcode: '',
  location: '',
  contactVisibility: 'private',
  notes: '',
  profileUrl: '',
  profileImage: null,
  instructorSpecialties: [],
  linkedTripIds: [],
  linkedDivePlanIds: [],
  linkedDiveIds: [],
  manualOverrideFields: [],
  profileValueSources: {},
});

const ROLE_OPTIONS: Array<[keyof NonNullable<PersonRecord['roles']>, string]> =
  [
    ['ownerProfile', 'My Profile'],
    ['buddy', 'Buddy'],
    ['instructor', 'Instructor'],
    ['guide', 'Dive guide'],
    ['emergencyContact', 'Emergency contact'],
    ['other', 'Other'],
  ];

const CERT_FLAGS: Array<
  [keyof NonNullable<PersonRecord['certificationFlags']>, string]
> = [
  ['deep', 'Deep'],
  ['wreck', 'Wreck'],
  ['wreckPenetration', 'Wreck penetration'],
  ['drysuit', 'Drysuit'],
  ['nitrox', 'Nitrox'],
  ['trimix', 'Trimix'],
  ['cavern', 'Cavern'],
  ['cave', 'Cave'],
  ['tec40', 'Tec 40'],
  ['tec45', 'Tec 45'],
  ['tec50', 'Tec 50'],
  ['tec65Plus', 'Tec 65+'],
  ['rescue', 'Rescue'],
  ['divemaster', 'Divemaster'],
  ['instructor', 'Instructor'],
];

const sourceFor = (person: DraftPerson, field: string) =>
  sourceLabel(
    person.profileValueSources?.[field],
    person.manualOverrideFields?.includes(field),
  );
const valueOrUnknown = (
  value: string | number | null | undefined,
  suffix = '',
) => (value === '' || value == null ? 'Unknown' : `${value}${suffix}`);

export function PeopleOperators({go}:{go?:(route:string)=>void}) {
  const [people, setPeople] = useState<StoredPerson[]>([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>(
    [],
  );
  const [certifications, setCertifications] = useState<
    Awaited<ReturnType<typeof listCertifications>>
  >([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editing, setEditing] = useState<DraftPerson | null>(null);
  const [viewing, setViewing] = useState<StoredPerson | null>(null);
  const [buddyView,setBuddyView]=useState<StoredPerson|null>(null);
  const [error, setError] = useState('');
  const [operators,setOperators]=useState<Awaited<ReturnType<typeof listOperators>>>([]);
  const [personLinks,setPersonLinks]=useState<Awaited<ReturnType<typeof listPersonEntityLinks>>>([]);
  const [managing,setManaging]=useState<StoredPerson|null>(null);
  const openedPersonLink=useRef(false);
  const refresh = useCallback(() => {
    void Promise.all([listPeople(), listDives(), listCertifications(),listOperators(),listPersonEntityLinks()]).then(
      ([nextPeople, nextDives, nextCertifications,nextOperators,nextLinks]) => {
        setPeople(nextPeople);
        setDives(nextDives);
        setCertifications(nextCertifications);
        setOperators(nextOperators);
        setPersonLinks(nextLinks);
      },
    );
  }, []);
  useRecordRefresh(refresh);
  useEffect(()=>{
    if(openedPersonLink.current)return;
    const query=new URLSearchParams(window.location.search),id=query.get('personId')??query.get('recordId');
    const person=people.find(row=>row.entityId===id);
    if(person){const frame=requestAnimationFrame(()=>{setViewing(person);openedPersonLink.current=true;});return()=>cancelAnimationFrame(frame);}
  },[people]);
  const owner = findOwnerProfile(people);
  const visible = useMemo(
    () =>
      people.map(person=>refreshPersonDerivedStats(person,derivePersonProfileStats(person,dives,certifications)))
        .filter((person) => {
          const haystack = [
            personDisplayName(person),
            person.name,
            person.agency,
            person.highestKnownQualification,
            Object.keys(person.roles ?? {})
              .filter(
                (key) =>
                  person.roles?.[
                    key as keyof NonNullable<PersonRecord['roles']>
                  ],
              )
              .join(' '),
          ]
            .join(' ')
            .toLowerCase();
          const roleMatch =
            roleFilter === 'all' ||
            hasPersonRole(
              person,
              roleFilter as keyof NonNullable<PersonRecord['roles']>,
            );
          return roleMatch && haystack.includes(query.trim().toLowerCase());
        })
        .sort(
          (a, b) =>
            Number(Boolean(b.roles?.ownerProfile)) -
              Number(Boolean(a.roles?.ownerProfile)) ||
            personDisplayName(a).localeCompare(personDisplayName(b)),
        ),
    [people, dives, certifications, query, roleFilter],
  );

  async function remove(person: StoredPerson) {
    const linked = dives.filter((dive) =>
      [
        ...(dive.buddyIds ?? []),
        ...(dive.diveTeamIds ?? []),
        dive.diveLeaderId,
      ].includes(person.entityId),
    );
    if (linked.length) {
      window.alert(
        `${personDisplayName(person)} is linked to ${linked.length} Dive record(s). Unlink the Person before deleting.`,
      );
      return;
    }
    if (
      !window.confirm(
        `Delete ${personDisplayName(person)}? This does not delete any Dive.`,
      )
    )
      return;
    try {await deletePerson(person.entityId);setViewing(null);refresh();}
    catch(reason){setError(reason instanceof Error?reason.message:'Unlink dependent records before deleting this Person.');}
  }

  async function save(draft: DraftPerson) {
    try {
      setError('');
      assertSingleOwnerProfile(people, draft);
      const displayName =
        draft.displayName?.trim() ||
        [draft.forename, draft.surname].filter(Boolean).join(' ').trim() ||
        draft.name.trim();
      if (!displayName)
        throw new Error('Add a display name, forename or surname.');
      if(!draft.entityId){const matches=reviewPersonDuplicates({...draft,name:displayName},people);if(matches.length&&!window.confirm(`Review existing Person: ${matches.map(row=>personDisplayName(row)).join(', ')}. Create a separate Person anyway?`))return;}
      const legacyRole: PersonRecord['role'] =
        draft.roles?.instructor && draft.roles?.buddy
          ? 'both'
          : draft.roles?.instructor
            ? 'instructor'
            : 'buddy';
      await savePerson({
        ...draft,
        name: displayName,
        displayName,
        role: legacyRole,
      });
      setEditing(null);
      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to save this profile.',
      );
    }
  }

  if (editing) return <ProfileEditor person={editing} people={people} dives={dives}
    certifications={certifications} error={error}
    close={() => { setEditing(null); setError(''); }} save={save}/>;
  if (buddyView) return <BuddyDiveWorkspace person={buddyView} dives={dives} close={()=>setBuddyView(null)} saved={refresh} go={go}/>;
  if (managing) return <PersonEntityRelationships person={managing} operators={operators} links={personLinks} close={()=>setManaging(null)} onSaved={refresh} go={go??(()=>undefined)}/>;

  return (
    <>
      <header className={styles.hero}>
        <div>
          <span>PEOPLE · OWNER PROFILE</span>
          <h1>People</h1>
          <p>
            People profiles for My Profile, buddies, instructors, guides and contacts.
            Organisations and services live in Dive Centres.
          </p>
        </div>
        <button
          className="focus-primary"
          onClick={() => setEditing(emptyPerson(false))}
        >
          <Plus size={17} /> Add profile
        </button>
        {go&&<button className="focus-secondary" onClick={()=>go('Dive Centres')}>Open Dive Centres</button>}
      </header>
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      <section className={`${styles.ownerCard} ${owner ? '' : styles.setup}`}>
        <div>
          <span className="focus-eyebrow">MY PROFILE</span>
          <h2>{owner ? personDisplayName(owner) : 'Create My Profile'}</h2>
          <p>
            {owner
              ? 'Your owner Person record powers Overview and connected planning views.'
              : 'No owner profile exists. Nothing is created until you choose to create it.'}
          </p>
        </div>
        <button
          className="focus-secondary"
          onClick={() =>
            owner ? setViewing(owner) : setEditing(emptyPerson(true))
          }
        >
          {owner ? 'Open My Profile' : 'Create My Profile'}
        </button>
      </section>
      <section className={styles.toolbar} aria-label="People filters">
        <label>
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, role or agency"
          />
        </label>
        <label>
          Role
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="all">All profiles</option>
            {ROLE_OPTIONS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section
        className={styles.grid}
        aria-label="People profiles"
      >
        {visible.map((person) => {
          const awards=resolvePersonDisplayAwards(person,certifications);
          return (
          <article key={person.entityId} className={styles.personCard}>
            <button
              className={styles.cardHit}
              aria-label={`Open ${personDisplayName(person)}`}
              onClick={() => setViewing(person)}
            />
            <div className={styles.avatar}>
              <PersonAvatar image={person.profileImage} legacyId={person.profileImageId} label={`${personDisplayName(person)} profile`} size={48}/>
            </div>
            <div>
              <span className="focus-eyebrow">
                {person.roles?.ownerProfile
                  ? 'MY PROFILE'
                  : ROLE_OPTIONS.filter(([key]) => hasPersonRole(person, key))
                      .map(([, label]) => label)
                      .join(' · ') || person.role}
              </span>
              <h2>{personDisplayName(person)}</h2>
              <p>
                {(awards.pro.record && awards.pro.title) || (awards.tec.record && awards.tec.title) || (awards.rec.record && awards.rec.title) || person.highestKnownQualification ||
                  person.highestQualification ||
                  'Profile details not yet recorded'}
              </p>
            </div>
            <div className={styles.actions}>
              <button
                aria-label={`Edit ${personDisplayName(person)}`}
                onClick={() => setEditing({ ...person })}
              >
                <Pencil size={16} />
              </button>
              <button
                aria-label={`Delete ${personDisplayName(person)}`}
                onClick={() => void remove(person)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
          );
        })}
        {!visible.length && (
          <div className={styles.empty}>
            <Users />
            <h2>No matching profiles</h2>
            <p>Try a different search or role filter.</p>
          </div>
        )}
      </section>
      {viewing && (
        <ProfileDetail
          person={refreshPersonDerivedStats(viewing,derivePersonProfileStats(viewing,dives,certifications))}
          awards={resolvePersonDisplayAwards(viewing,certifications)}
          affiliations={projectPersonEntityLinks([viewing],personLinks)} operators={operators} go={go??(()=>undefined)}
          showDives={()=>{setBuddyView(viewing);setViewing(null);}}
          manage={()=>{setManaging(viewing);setViewing(null);}}
          close={() => setViewing(null)}
          edit={() => {
            setEditing({ ...viewing });
            setViewing(null);
          }}
        />
      )}
    </>
  );
}

function ProfileDetail({
  person,
  awards,
  affiliations,
  operators,
  go,
  close,
  edit,
  showDives,
  manage,
}: {
  person: StoredPerson;
  awards:ReturnType<typeof resolvePersonDisplayAwards>;
  affiliations:ReturnType<typeof projectPersonEntityLinks>;
  operators:Awaited<ReturnType<typeof listOperators>>;
  go:(route:string)=>void;
  close: () => void;
  edit: () => void;
  showDives: () => void;
  manage: () => void;
}) {
  const stats = [
    ['Linked dives', valueOrUnknown(person.totalLinkedDives)],
    ['Maximum depth', valueOrUnknown(person.maxDepthM, ' m')],
    ['Average SAC', valueOrUnknown(person.averageSac)],
    ['Average RMV', valueOrUnknown(person.averageRmv)],
    [
      'Boat / shore dives',
      `${valueOrUnknown(person.boatDives)} / ${valueOrUnknown(person.shoreDives)}`,
    ],
  ];
  return (
    <AccessibleDialog
      label={`${personDisplayName(person)} profile`}
      close={close}
      className={`focus-modal ${styles.dialog}`}
    >
      <header>
        <PersonAvatar image={person.profileImage} legacyId={person.profileImageId} label={`${personDisplayName(person)} profile`} size={72}/>
        <div>
          <span className="focus-eyebrow">
            {person.roles?.ownerProfile ? 'MY PROFILE' : 'PERSON PROFILE'}
          </span>
          <h2>{personDisplayName(person)}</h2>
        </div>
        <button
          className="focus-icon"
          data-dialog-close
          aria-label="Close profile"
          onClick={close}
        >
          <X />
        </button>
      </header>
      <div className={styles.detailGrid}>
        <section>
          <h3>Identity</h3>
          <p>
            {ROLE_OPTIONS.filter(([key]) => hasPersonRole(person, key))
              .map(([, label]) => label)
              .join(' · ') || 'No role recorded'}
          </p>
          <p>
            {person.agency || 'Agency unknown'}
            {person.membershipNumber ? ` · ${person.membershipNumber}` : ''}
          </p>
        </section>
        <section>
          <h3>Certifications &amp; limits</h3>
          <p>
            Recreational award:{' '}
            {valueOrUnknown(awards.rec.title)}
          </p>
          <p>
            Technical award: {valueOrUnknown(awards.tec.title)}
          </p>
          <p>
            Professional award:{' '}
            {valueOrUnknown(awards.pro.title)}
          </p>
          <p>
            Depth limit: {valueOrUnknown(person.maxAllowedDepthM, ' m')} ·{' '}
            {sourceLabel(person.maxAllowedDepthSource)}
          </p>
        </section>
        <section>
          <h3>Derived dive stats</h3>
          {stats.map(([label, value]) => (
            <p key={label}>
              <b>{label}:</b> {value}
            </p>
          ))}
          <small>
            {person.derivedStatsUpdatedAt
              ? `Refreshed ${new Date(person.derivedStatsUpdatedAt).toLocaleString('en-GB')}`
              : 'Not refreshed yet'}
          </small>
        </section>
        <section>
          <h3>Contact &amp; emergency</h3>
          <p>
            {!person.contactVisibility || person.contactVisibility === 'private'
              ? 'Private contact details'
              : person.email || person.phone || 'Contact not recorded'}
          </p>
          <p>
            {person.emergencyContactName ||
              person.emergencyContact ||
              'Emergency contact not recorded'}
          </p>
        </section>
        {hasPersonRole(person, 'instructor') && (
          <section>
            <h3>Instructor profile</h3>
            <p>
              {person.instructorAgency || 'Agency unknown'} ·{' '}
              {person.instructorNumber || 'Number unknown'}
            </p>
            <p>
              {person.instructorActive === false
                ? 'Inactive'
                : 'Active status not restricted'}
            </p>
          </section>
        )}
        <section><h3>Dive Entity affiliations</h3>
          {affiliations.length?<ul>{affiliations.map((link,index)=><li key={link.entityId??`${link.operatorId}-${index}`}>
            <button type="button" className="focus-secondary" onClick={()=>go('Dive Centres&operatorId='+encodeURIComponent(link.operatorId))}>{operators.find(row=>row.entityId===link.operatorId)?.name??'Unavailable entity'}</button> · {link.role} · {relationshipStatus(link)}
          </li>)}</ul>:<p>No Dive Entity affiliations recorded.</p>}
        </section>
        <section>
          <h3>Notes &amp; evidence</h3>
          <p>
            {person.certificationEvidenceNotes ||
              person.notes ||
              'No notes recorded.'}
          </p>
        </section>
      </div>
      <footer>
        <button className="focus-secondary" onClick={showDives}>Dives together / link history</button>
        <button className="focus-secondary" onClick={manage}>Manage Dive Entity links</button>
        <button className="focus-secondary" onClick={edit}>
          Edit profile
        </button>
        <button className="focus-primary" data-dialog-close onClick={close}>
          Close
        </button>
      </footer>
    </AccessibleDialog>
  );
}

function ProfileEditor({
  person,
  people,
  dives,
  certifications,
  error,
  close,
  save,
}: {
  person: DraftPerson;
  people: StoredPerson[];
  dives: Array<DiveRecord & { entityId: string }>;
  certifications: Awaited<ReturnType<typeof listCertifications>>;
  error: string;
  close: () => void;
  save: (person: DraftPerson) => Promise<void>;
}) {
  const [draft, setDraft] = useState(person);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const update = (patch: Partial<DraftPerson>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const setRole = (
    role: keyof NonNullable<PersonRecord['roles']>,
    checked: boolean,
  ) => update({ roles: { ...draft.roles, [role]: checked } });
  const setCertFlag = (
    flag: keyof NonNullable<PersonRecord['certificationFlags']>,
    checked: boolean,
  ) =>
    update({
      certificationFlags: {
        ...draft.certificationFlags,
        [flag]: checked,
      },
    });
  const manual = (field: string, patch: Partial<DraftPerson>) =>
    update({
      ...patch,
      manualOverrideFields: [
        ...new Set([...(draft.manualOverrideFields ?? []), field]),
      ],
      profileValueSources: {
        ...draft.profileValueSources,
        [field]: 'owner-entered',
      },
    });
  const linked = draft.entityId
    ? people.find((row) => row.entityId === draft.entityId)
    : null;
  function refreshDerived() {
    const derived = derivePersonProfileStats(draft, dives, certifications);
    if ((draft.manualOverrideFields?.length ?? 0) && !confirmOverwrite) {
      setDraft(refreshPersonDerivedStats(draft, derived, false));
      return;
    }
    setDraft(refreshPersonDerivedStats(draft, derived, confirmOverwrite));
  }
  function restoreAutomatic(field: Parameters<typeof manual>[0]) {
    const derived = derivePersonProfileStats(draft, dives, certifications);
    const withoutOverride = {
      ...draft,
      manualOverrideFields: (draft.manualOverrideFields ?? []).filter(
        (entry) => entry !== field,
      ),
    };
    setDraft(refreshPersonDerivedStats(withoutOverride, derived, false));
  }
  return (
    <RecordEditorWorkspace
      label={
        draft.entityId
          ? `Edit ${personDisplayName(draft)}`
          : draft.roles?.ownerProfile
            ? 'Create My Profile'
            : 'Add profile'
      }
      close={close}
      value={draft}
      save={() => save(draft)}
      saveLabel="Save profile"
      contentClassName={styles.editorContent}
    >

      <div className={styles.editorSections}>
        <fieldset>
          <legend>Identity</legend>
          <ProfilePicture
            value={draft.profileImage ?? null}
            legacyId={draft.profileImageId ?? ''}
            change={(profileImage) => update({ profileImage })}
            removeLegacy={() => update({ profileImageId: '' })}
          />
          <div className={styles.fields}>
            <label>
              Forename
              <input
                value={draft.forename ?? ''}
                onChange={(event) => update({ forename: event.target.value })}
              />
            </label>
            <label>
              Surname
              <input
                value={draft.surname ?? ''}
                onChange={(event) => update({ surname: event.target.value })}
              />
            </label>
            <label>
              Display name
              <input
                value={draft.displayName ?? ''}
                onChange={(event) =>
                  update({ displayName: event.target.value })
                }
              />
            </label>
            <label>
              Agency
              <input
                value={draft.agency}
                onChange={(event) => update({ agency: event.target.value })}
              />
            </label>
            <label>
              Membership / certification number
              <input
                value={draft.membershipId ?? draft.membershipNumber}
                onChange={(event) =>
                  update({
                    membershipId: event.target.value,
                    membershipNumber: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Profile URL
              <input
                type="url"
                value={draft.profileUrl ?? ''}
                onChange={(event) => update({ profileUrl: event.target.value })}
              />
            </label>
          </div>
          <div className={styles.checkGrid}>
            {ROLE_OPTIONS.map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(draft.roles?.[key])}
                  disabled={
                    key === 'ownerProfile' &&
                    Boolean(linked?.roles?.ownerProfile)
                  }
                  onChange={(event) => setRole(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Certifications &amp; limits</legend>
          <div className={styles.fields}>
            <label>
              Highest known qualification
              <input
                value={
                  draft.highestKnownQualification ?? draft.highestQualification
                }
                onChange={(event) =>
                  manual('highestKnownQualification', {
                    highestKnownQualification: event.target.value,
                    highestQualification: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Highest recreational
              <input
                value={draft.highestRecreationalCertification ?? ''}
                onChange={(event) =>
                  manual('highestRecreationalCertification', {
                    highestRecreationalCertification: event.target.value,
                  })
                }
              />
              <small>
                {sourceFor(draft, 'highestRecreationalCertification')}
              </small>
            </label>
            <label>
              Highest technical
              <input
                value={draft.highestTechnicalCertification ?? ''}
                onChange={(event) =>
                  manual('highestTechnicalCertification', {
                    highestTechnicalCertification: event.target.value,
                  })
                }
              />
              <small>{sourceFor(draft, 'highestTechnicalCertification')}</small>
            </label>
            <label>
              Highest professional
              <input
                value={draft.highestProfessionalCertification ?? ''}
                onChange={(event) =>
                  manual('highestProfessionalCertification', {
                    highestProfessionalCertification: event.target.value,
                  })
                }
              />
              <small>
                {sourceFor(draft, 'highestProfessionalCertification')}
              </small>
            </label>
            <label>
              Maximum allowed depth (m)
              <input
                type="number"
                min="0"
                value={draft.maxAllowedDepthM ?? ''}
                onChange={(event) =>
                  manual('maxAllowedDepthM', {
                    maxAllowedDepthM: event.target.value
                      ? Number(event.target.value)
                      : null,
                    maxAllowedDepthSource: event.target.value
                      ? 'owner-entered'
                      : 'unknown',
                  })
                }
              />
              <small>
                {sourceLabel(
                  draft.maxAllowedDepthSource,
                  draft.manualOverrideFields?.includes('maxAllowedDepthM'),
                )}
              </small>
            </label>
            <label className={styles.wide}>
              Certification evidence / source notes
              <textarea
                value={draft.certificationEvidenceNotes ?? ''}
                onChange={(event) =>
                  update({ certificationEvidenceNotes: event.target.value })
                }
              />
            </label>
          </div>
          <div className={styles.checkGrid}>
            {CERT_FLAGS.map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(draft.certificationFlags?.[key])}
                  onChange={(event) => setCertFlag(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {(draft.roles?.ownerProfile ||
          draft.roles?.buddy ||
          Boolean(draft.entityId)) && (
          <fieldset>
            <legend>Derived dive stats</legend>
            <div className={styles.statGrid}>
              {(
                [
                  ['totalLinkedDives', 'Linked dives', ''],
                  ['maxDepthM', 'Maximum depth', ' m'],
                  ['averageSac', 'Average SAC', ''],
                  ['averageRmv', 'Average RMV', ''],
                  ['boatDives', 'Boat dives', ''],
                  ['shoreDives', 'Shore dives', ''],
                  ['nightDives', 'Night dives', ''],
                  ['wreckDives', 'Wreck dives', ''],
                  ['technicalDives', 'Technical dives', ''],
                ] as const
              ).map(([field, label, suffix]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    step={field === 'averageSac' || field === 'averageRmv' || field === 'maxDepthM' ? '0.1' : '1'}
                    value={draft[field] ?? ''}
                    aria-label={`${label} manual override`}
                    onChange={(event) =>
                      manual(field, {
                        [field]: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                  {suffix && draft[field] != null && <em>{suffix.trim()}</em>}
                  <small>{sourceFor(draft, field)}</small>
                  {draft.manualOverrideFields?.includes(field) && (
                    <button type="button" onClick={() => restoreAutomatic(field)}>
                      Use automatic
                    </button>
                  )}
                </label>
              ))}
            </div>
            <div className={styles.refreshRow}>
              <button
                type="button"
                className="focus-secondary"
                onClick={refreshDerived}
              >
                <RefreshCw size={16} /> Refresh derived stats
              </button>
              {Boolean(draft.manualOverrideFields?.length) && (
                <label>
                  <input
                    type="checkbox"
                    checked={confirmOverwrite}
                    onChange={(event) =>
                      setConfirmOverwrite(event.target.checked)
                    }
                  />{' '}
                  Replace manual overrides on this refresh
                </label>
              )}
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend>Contact &amp; emergency</legend>
          <div className={styles.fields}>
            <label>
              Phone
              <input
                type="tel"
                value={draft.phone}
                onChange={(event) => update({ phone: event.target.value })}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={draft.email}
                onChange={(event) => update({ email: event.target.value })}
              />
            </label>
            <label>
              Emergency contact name
              <input
                value={draft.emergencyContactName ?? ''}
                onChange={(event) =>
                  update({
                    emergencyContactName: event.target.value,
                    emergencyContact: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Emergency contact number
              <input
                type="tel"
                value={draft.emergencyContactNumber ?? ''}
                onChange={(event) =>
                  update({ emergencyContactNumber: event.target.value })
                }
              />
            </label>
            <label className={styles.wide}>
              Address
              <input
                value={draft.address ?? ''}
                onChange={(event) => update({ address: event.target.value })}
              />
            </label>
            <label>
              Postcode
              <input
                value={draft.postcode ?? ''}
                onChange={(event) => update({ postcode: event.target.value })}
              />
            </label>
            <label>
              Location
              <input
                value={draft.location ?? ''}
                onChange={(event) => update({ location: event.target.value })}
              />
            </label>
            <label>
              Visibility
              <select
                value={draft.contactVisibility ?? 'private'}
                onChange={(event) =>
                  update({
                    contactVisibility: event.target.value as NonNullable<
                      DraftPerson['contactVisibility']
                    >,
                  })
                }
              >
                <option value="private">Private</option>
                <option value="household">Household</option>
                <option value="planning">
                  Available to linked planning views
                </option>
              </select>
            </label>
          </div>
        </fieldset>
        {draft.roles?.instructor && (
          <fieldset>
            <legend>Instructor profile</legend>
            <div className={styles.fields}>
              <label>
                Instructor agency
                <input
                  value={draft.instructorAgency ?? ''}
                  onChange={(event) =>
                    update({ instructorAgency: event.target.value })
                  }
                />
              </label>
              <label>
                Instructor number
                <input
                  value={draft.instructorNumber ?? ''}
                  onChange={(event) =>
                    update({ instructorNumber: event.target.value })
                  }
                />
              </label>
              <label>
                Instructor phone
                <input
                  type="tel"
                  value={draft.instructorPhone ?? ''}
                  onChange={(event) =>
                    update({ instructorPhone: event.target.value })
                  }
                />
              </label>
              <label>
                Instructor email
                <input
                  type="email"
                  value={draft.instructorEmail ?? ''}
                  onChange={(event) =>
                    update({ instructorEmail: event.target.value })
                  }
                />
              </label>
              <label>
                Instructor URL
                <input
                  type="url"
                  value={draft.instructorUrl ?? ''}
                  onChange={(event) =>
                    update({ instructorUrl: event.target.value })
                  }
                />
              </label>
              <label>
                Specialties
                <input
                  value={(draft.instructorSpecialties ?? []).join(', ')}
                  onChange={(event) =>
                    update({
                      instructorSpecialties: event.target.value
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(draft.instructorActive)}
                  onChange={(event) =>
                    update({ instructorActive: event.target.checked })
                  }
                />{' '}
                Currently active
              </label>
              <label className={styles.wide}>
                Instructor notes
                <textarea
                  value={draft.instructorNotes ?? ''}
                  onChange={(event) =>
                    update({ instructorNotes: event.target.value })
                  }
                />
              </label>
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend>Notes &amp; evidence</legend>
          <label className={styles.fullLabel}>
            General notes
            <textarea
              value={draft.notes}
              onChange={(event) => update({ notes: event.target.value })}
            />
          </label>
        </fieldset>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

    </RecordEditorWorkspace>
  );
}
