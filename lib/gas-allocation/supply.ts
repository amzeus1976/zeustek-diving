export function ownedFullEligibility(input: {
  currentPressureBar: number | null;
  requestedPressureBar: number | null;
  toleranceBar?: number;
}) {
  const {
    currentPressureBar: current,
    requestedPressureBar: target,
    toleranceBar = 5,
  } = input;
  return (
    current != null &&
    target != null &&
    Number.isFinite(current) &&
    Number.isFinite(target) &&
    Number.isFinite(toleranceBar) &&
    current > 0 &&
    target > 0 &&
    toleranceBar >= 0 &&
    toleranceBar < target &&
    current >= target - toleranceBar
  );
}
