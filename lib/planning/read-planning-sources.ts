import {
  listDivingCalendarBookings,
  listGasPlans,
  deriveRmvBaseline,
} from '../offline/planning-pages';
import { listEnrichedDivePlans } from '../offline/dive-planning-centre';
import { listDives } from '../offline/dives';
import { listCylinderFills, listGasAnalyses } from '../offline/loadouts-gas';
import { readCylinderInventory } from '../gear/read-cylinder-inventory';
/** Source-compatible reads without the frozen legacy cylinder-ID repair side effect. */
export async function readPlanningSources() {
  const [bookings, gasPlans, divePlans, dives, fills, analyses, cylinders] =
    await Promise.all([
      listDivingCalendarBookings(),
      listGasPlans(),
      listEnrichedDivePlans(),
      listDives(),
      listCylinderFills(),
      listGasAnalyses(),
      readCylinderInventory(),
    ]);
  return {
    bookings,
    gasPlans,
    divePlans,
    dives,
    fills,
    analyses,
    cylinders,
    rmvBaseline: deriveRmvBaseline(dives),
  };
}
