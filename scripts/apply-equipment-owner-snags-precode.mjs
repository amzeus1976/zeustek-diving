import { readFileSync, writeFileSync } from 'node:fs';

const dashboardPath = 'app/dashboard-client.tsx';
const focusCssPath = 'app/focus.css';

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Equipment precode anchor missing: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Equipment precode anchor is not unique: ${label}`);
  }
  return source.replace(search, replacement);
}

let dashboard = readFileSync(dashboardPath, 'utf8');

if (!dashboard.includes("import { EquipmentMaintenanceLog } from '@/components/equipment-maintenance-log';")) {
  dashboard = replaceOnce(
    dashboard,
    "import { DiveSyncStatus } from '@/components/dive-sync-status';",
    "import { DiveSyncStatus } from '@/components/dive-sync-status';\nimport { EquipmentMaintenanceLog } from '@/components/equipment-maintenance-log';",
    'EquipmentMaintenanceLog import',
  );
}

if (!dashboard.includes('overviewServiceItems,')) {
  dashboard = replaceOnce(
    dashboard,
    `import {\n  equipmentDiveCount,\n  equipmentServiceStatus,\n} from '@/lib/offline/equipment-usage';`,
    `import {\n  equipmentDiveCount,\n  equipmentServiceStatus,\n  overviewServiceItems,\n} from '@/lib/offline/equipment-usage';`,
    'equipment-usage import block',
  );
}

const overviewOld = `          {equipment.slice(0, 2).map((item) => (\n            <StatusRow\n              key={item.entityId}\n              title={item.name}\n              meta={\n                equipmentServiceStatus(item, dives).dateDue\n                  ? \`Next service \${new Date(\`\${equipmentServiceStatus(item, dives).dateDue}T12:00:00\`).toLocaleDateString()}\`\n                  : 'No service date set'\n              }\n              warn={equipmentServiceStatus(item, dives).state !== 'current'}\n            />\n          ))}`;
const overviewNew = `          {overviewServiceItems(equipment, dives, 8).map((item) => (\n            <StatusRow\n              key={item.entityId}\n              title={item.name}\n              meta={\`Next service \${new Date(\`\${equipmentServiceStatus(item, dives).dateDue}T12:00:00\`).toLocaleDateString('en-GB')}\`}\n              warn={equipmentServiceStatus(item, dives).state !== 'current'}\n            />\n          ))}\n          {!overviewServiceItems(equipment, dives, 8).length && (\n            <p className=\"focus-copy\">No equipment currently requires scheduled servicing.</p>\n          )}`;
if (dashboard.includes(overviewOld)) {
  dashboard = replaceOnce(dashboard, overviewOld, overviewNew, 'Overview Kit Status list');
} else if (!dashboard.includes('No equipment currently requires scheduled servicing.')) {
  throw new Error('Equipment precode anchor missing: Overview Kit Status list');
}

// Add the maintenance log as a child of the existing Equipment RecordDetail without
// touching the generic detail component or other record types.
if (!dashboard.includes('<EquipmentMaintenanceLog equipment={viewing} onEquipmentChanged={refresh} />')) {
  const detailAnchor = 'ownerKind="equipment"';
  const detailStart = dashboard.indexOf(detailAnchor);
  if (detailStart < 0) throw new Error('Equipment precode anchor missing: Equipment RecordDetail');
  const detailClose = dashboard.indexOf('\n        />', detailStart);
  if (detailClose < 0) throw new Error('Equipment precode anchor missing: Equipment RecordDetail close');
  dashboard = `${dashboard.slice(0, detailClose)}\n        >\n          <EquipmentMaintenanceLog equipment={viewing} onEquipmentChanged={refresh} />\n        </RecordDetail>${dashboard.slice(detailClose + '\n        />'.length)}`;
}

// Scope layout classes to EquipmentForm only. This prevents a global form-grid change.
const equipmentFormStart = dashboard.indexOf('function EquipmentForm({');
const equipmentFormEnd = dashboard.indexOf('\nfunction EquipmentSets(', equipmentFormStart);
if (equipmentFormStart < 0 || equipmentFormEnd < 0) {
  throw new Error('Equipment precode anchor missing: EquipmentForm bounds');
}
let equipmentForm = dashboard.slice(equipmentFormStart, equipmentFormEnd);
if (!equipmentForm.includes('equipment-form-fields')) {
  equipmentForm = equipmentForm.replace('<div className="record-fields">', '<div className="record-fields equipment-form-fields">');
}
equipmentForm = equipmentForm.replaceAll(
  '<label className="record-check record-wide">',
  '<label className="record-check record-wide equipment-toggle">',
);
if (!equipmentForm.includes('equipment-section-heading')) {
  const servicingLabel = '<label className="record-check record-wide equipment-toggle">\n          <input type="checkbox" checked={serviceRequired}';
  if (!equipmentForm.includes(servicingLabel)) throw new Error('Equipment precode anchor missing: serviceRequired checkbox');
  equipmentForm = equipmentForm.replace(
    servicingLabel,
    '<div className="record-wide equipment-section-heading"><span className="focus-eyebrow">SERVICING</span><h3>Scheduled servicing</h3></div>\n        ' + servicingLabel,
  );
  const retiredText = 'Retired / no longer in use';
  const retiredAt = equipmentForm.indexOf(retiredText);
  if (retiredAt < 0) throw new Error('Equipment precode anchor missing: retired checkbox');
  const retiredLabelAt = equipmentForm.lastIndexOf('<label className="record-check record-wide equipment-toggle">', retiredAt);
  if (retiredLabelAt < 0) throw new Error('Equipment precode anchor missing: retired label');
  equipmentForm = `${equipmentForm.slice(0, retiredLabelAt)}<div className="record-wide equipment-section-heading"><span className="focus-eyebrow">STATUS</span><h3>Equipment status</h3></div>\n        ${equipmentForm.slice(retiredLabelAt)}`;
}
dashboard = `${dashboard.slice(0, equipmentFormStart)}${equipmentForm}${dashboard.slice(equipmentFormEnd)}`;
writeFileSync(dashboardPath, dashboard);

let focusCss = readFileSync(focusCssPath, 'utf8');
const cssMarker = '/* Equipment owner-snags precode: grouped responsive editor controls. */';
if (!focusCss.includes(cssMarker)) {
  focusCss += `\n\n${cssMarker}\n.equipment-form-fields .equipment-section-heading {\n  grid-column: 1 / -1;\n  margin-top: 6px;\n  padding-top: 10px;\n  border-top: 1px solid rgba(255,255,255,.1);\n}\n.equipment-form-fields .equipment-section-heading h3 { margin: 3px 0 0; }\n.equipment-form-fields .equipment-toggle {\n  grid-column: 1 / -1;\n  display: flex !important;\n  flex-direction: row !important;\n  align-items: center !important;\n  justify-content: flex-start !important;\n  gap: 10px !important;\n  min-height: 44px;\n  width: fit-content;\n  max-width: 100%;\n  margin: 0;\n}\n.equipment-form-fields .equipment-toggle input[type='checkbox'] {\n  flex: 0 0 auto !important;\n  width: 18px !important;\n  height: 18px !important;\n  margin: 0 !important;\n}\n.equipment-form-fields .service-preview { min-width: 0; }\n@media (max-width: 780px) {\n  .equipment-form-fields .equipment-section-heading,\n  .equipment-form-fields .equipment-toggle { grid-column: auto; }\n  .equipment-form-fields .equipment-toggle { width: 100%; }\n}\n`;
  writeFileSync(focusCssPath, focusCss);
}

console.log('Applied Equipment owner-snag precode integration.');
