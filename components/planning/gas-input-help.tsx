'use client';
import { useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { AccessibleDialog } from '../accessible-dialog';
import styles from './recreational-gas-planner.module.css';
const help: Record<string, string> = {
  Mode: 'Direct ascent uses the declared working interval. Other modes require every planned route interval, its duration and accessible supply. No decompression schedule is generated.',
  'Bühlmann model':
    'Choose the existing ZH-L16B or ZH-L16C no-stop model. Gas allocation does not change its physiological result.',
  'GF Low (%)':
    'Stored model setting. The current no-stop surface check uses GF High; GF Low does not introduce decompression stops.',
  'GF High (%)':
    'Conservatism setting used by the frozen no-stop surface check. Use your selected planning assumptions and training.',
  'Compare the other model':
    'Displays the other frozen model for comparison. It does not replace the selected model or increase its limit.',
  'Cylinder water volume (L)':
    'Internal water capacity, not the volume of compressed gas. Owned values come from the canonical cylinder.',
  'Start pressure (bar)':
    'The pressure basis for this reference calculation. Actual availability and fill requests are distinguished in each supply card.',
  Water:
    'Select fresh or salt water so the existing pressure-depth conversion uses the correct density assumption.',
  'Surface pressure (bar)':
    'Absolute surface pressure used by the existing engine. Do not substitute gauge cylinder pressure.',
  'Planned depth (m)':
    'Maximum planned depth used by the conservative no-stop assessment. Every route depth must fit within it.',
  'Conservatism depth (m)':
    'Additional depth used for the conservative gas comparison. It does not add gas-switch or decompression credit.',
  'Maximum PPO₂ (bar)':
    'Selected oxygen partial-pressure ceiling. MOD is the ceiling for each gas, not an automatic switch depth.',
  'Selected / actual gas':
    'The gas used by the frozen physiological assessment. Different-gas allocations remain separately flagged as physiologically unsupported.',
  'Custom nitrox O₂ (%)':
    'Measured or planned oxygen percentage. Manual entry is not analysis evidence; confirm actual supply analysis separately.',
  'Own RMV (L/min)':
    'Your surface-equivalent respiratory minute volume. A manual edit replaces the saved source assumption.',
  'Buddy RMV (L/min)':
    'Buddy surface-equivalent RMV used by the emergency reserve. If unknown, the existing engine uses the displayed owner-RMV fallback.',
  'Ascent rate (m/min)':
    'Rate used by the existing emergency-reserve phases. It does not generate a decompression schedule.',
  'Reference water volume (L)':
    'Optional comparison capacity before choosing a supply. It does not create inventory or count as committed gas.',
  'Reference pressure (bar)':
    'Optional comparison pressure. Once an accessible reference supply is selected, its verified configuration supplies this value.',
  Checkpoint:
    'Name the end of this route interval so assignments and switch points can be reviewed clearly.',
  'Checkpoint type':
    'Descriptive classification of this route endpoint. It does not prescribe a depth or switch.',
  'Start depth (m)':
    'Depth at the beginning of the interval. It must continue from the preceding interval endpoint.',
  'End depth (m)':
    'Depth at the interval endpoint. Changing it updates the next start depth; verify both intervals afterward.',
  'Average depth (m)':
    'Average used for gas consumption during this interval. It must lie between its start and end depths; split excursions into separate intervals.',
  'Duration (min)':
    'Time for this interval only. The complete route must fit the declared planned working time.',
  'Cylinder / gas':
    'Exactly one accessible supply for this interval. Independent cylinders remain separate; a manifold must first be explicitly configured.',
  'Buddy sharing':
    'Includes buddy RMV in this interval consumption once. Emergency-reserve buddy contributions remain separately displayed.',
  'Direct ascent possible':
    'Records the route assumption. A route with a required return still needs every return interval and reserve assignment.',
  'Route notes':
    'Context for the route interval. Notes do not establish accessibility or change calculations.',
  'Supply workflow':
    'Requirements only allows a draft without owned inventory. Choose supplies when you can explicitly assign cylinders and reserves.',
  'New supply type':
    'Choose owned-empty, owned-full, hire or temporary/manual. This action creates a planning snapshot only.',
  'Supply type':
    'Changing source strategy requires fresh evidence. Owned-full depends on current canonical fill/analysis; empty cylinders remain fill requests.',
  Role: 'Main/backgas, independent sidemount sides, pony/bailout and stage have distinct access and reserve obligations.',
  'Canonical cylinder':
    'Select the existing owned record. Capturing it snapshots current evidence without repairing or changing inventory.',
  Label:
    'A readable planning label. Canonical and immutable snapshot identities remain stored separately.',
  'Suggested request':
    'A starting request for typical hire dimensions. It does not assert actual availability, fill pressure or analysis.',
  'Water volume (L)':
    'Actual internal cylinder water capacity. Compressed litres are calculated from this capacity and the applicable pressure.',
  'Rated pressure (bar)':
    'Recorded working-pressure limit. Planned start pressure must not exceed it.',
  'Current pressure (bar)':
    'Latest actual pressure evidence, separate from the pressure you intend to obtain. Unknown hire pressure cannot pass readiness.',
  'Requested / planned start pressure (bar)':
    'The pressure you intend to start with. Empty cylinders generate a fill request; owned-full eligibility uses this target and its tolerance.',
  'Allowed start-pressure tolerance (bar)':
    'Explicit permitted shortfall from the requested pressure. Gas accounting still uses the lower actual/planned pressure; tolerance does not add gas.',
  'Oxygen (%)':
    'Oxygen percentage for this supply. Each assigned route and reserve depth is checked against its PPO₂ ceiling.',
  'Helium (%)':
    'Helium percentage is preserved as evidence. This recreational no-stop workflow does not provide helium physiological validation.',
  Valve:
    'Record the connection needed. Confirm compatibility with the actual regulator and configuration.',
  'Material / type':
    'Preserves hire/manual cylinder description and any explicit owned-inventory copy.',
  'Analysis source':
    'Identify who supplied actual analysis evidence. A cylinder label alone is not a current analysis.',
  'Analysis date/time':
    'When the gas was actually analysed. Retrieval or editing time must not be substituted for observation time.',
  'Fill / operator source':
    'Where the temporary cylinder was supplied. Preserved when an owned copy is explicitly created.',
  'Available from checkpoint':
    'Earliest point at which the cylinder can actually be accessed. It cannot cover any earlier route or reserve obligation.',
  'Actual analysis confirmed':
    'Confirm the dated analysis for the actual gas. Owned evidence comes from the canonical current fill and linked analysis.',
  'Cylinder condition and configuration confirmed':
    'Confirm actual condition and intended setup. Owned inspections and service status are read from canonical evidence.',
  'Supply notes':
    'Supply-specific context retained with the snapshot. Notes never substitute for assignments or evidence.',
  'Manifold label':
    'Name the explicitly connected backmount working supply. Member identities and constraints remain visible.',
  'Manifold member':
    'Choose two distinct main cylinders with compatible gas, planned pressure and availability. Independent cylinders are never pooled automatically.',
  'Connection and compatible configuration verified':
    'Only an explicitly verified open manifold can act as one accessible supply.',
  'Operating state':
    'A closed, isolated or unknown connection cannot be credited as an open shared working supply.',
  'Owner-selected sidemount balance tolerance (bar, optional)':
    'Optional explicit pressure-difference limit at every checkpoint. No equal split or automatic equalisation is assumed.',
  'Frozen-engine reference supply':
    'One accessible supply used for the existing single-supply comparison. Independent totals do not feed this reference.',
  'Working-time supply':
    'The explicitly assigned supply for the direct-ascent working interval. Reserve assignments remain separate.',
  'Switch checkpoint':
    'The explicit point where the next gas or stage is used. MOD alone never selects it.',
  'Switch to':
    'Accessible supply used after the named checkpoint. Switching grants no NDL or decompression credit.',
  'Assumption / scenario name':
    'Describe the contingency, including any failed later switch or unavailable supply. Alternative scenarios are assessed separately.',
  'Include in readiness':
    'A selected scenario must pass its own per-cylinder obligations. An unselected scenario is retained for review only.',
  'Scenario starts at':
    'Where the contingency begins. Gas already consumed before this checkpoint remains deducted.',
  'Unavailable supplies / failed switches':
    'Supplies that this scenario cannot credit. Reserve and route assignments must use the remaining accessible supplies.',
  'Scenario route supply':
    'Explicitly assign each remaining interval for this contingency. Surplus is never silently transferred between independent cylinders.',
  'Additional scenario factor':
    'Owner-selected advanced allowance applied once to this scenario’s route consumption, excluding the frozen emergency reserve.',
  'Apply an additional factor to this scenario’s route consumption':
    'Disabled by default. The version, factor, basis and selection time are recorded; it cannot reduce or multiply the frozen reserve.',
  'Reserve supply':
    'The specific accessible supply responsible for this obligation. Missing or inaccessible assignments block readiness.',
  'Assigned reserve (L)':
    'Surface-equivalent litres assigned to this supply. Complete frozen reserve and applicable per-supply thirds floors must remain covered.',
  'From checkpoint':
    'First checkpoint at which this reserve assignment applies. Overlapping assignments to the same supply are rejected.',
  'Through checkpoint':
    'Last checkpoint covered, inclusive. Complete reserve coverage must continue through the route.',
};
export function GasInputHelp({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const body = children ?? help[label];
  if (!body) return null;
  return (
    <>
      <button
        className={styles.help}
        type="button"
        aria-label={`Help: ${label}`}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <HelpCircle size={17} />
      </button>
      {open && (
        <AccessibleDialog
          label={`Help: ${label}`}
          className="focus-modal"
          close={() => setOpen(false)}
        >
          <h3>{label}</h3>
          <p>{body}</p>
          <button type="button" onClick={() => setOpen(false)}>
            Close help
          </button>
        </AccessibleDialog>
      )}
    </>
  );
}
