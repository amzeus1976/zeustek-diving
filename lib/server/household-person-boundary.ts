/** A shared Person never carries references or notes about the owner's private entities. */
export function householdPersonProjection<T extends Record<string, unknown>>(person: T): T {
  const copy = {...person};
  for (const field of [
    'operatorId', 'currentDiveOperatorId', 'operatorName', 'operatorType',
    'operatorWebsite', 'operatorBookingUrl', 'operatorEmail', 'operatorPhone',
    'operatorAddress', 'operatorPostcode', 'operatorLocation', 'operatorEmergencyContact',
    'operatorNotes', 'operatorServices', 'operatorAgencies', 'bookingUrl',
  ]) delete copy[field];
  return copy;
}
