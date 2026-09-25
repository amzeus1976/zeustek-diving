export type CylinderDetailDrafts = {
  profile: unknown;
  fill: unknown;
  usage: unknown;
  analysis: unknown;
};

export function hasUnsavedCylinderDetailDraft(current: CylinderDetailDrafts, saved: CylinderDetailDrafts): boolean {
  return (Object.keys(current) as Array<keyof CylinderDetailDrafts>)
    .some((section) => JSON.stringify(current[section]) !== JSON.stringify(saved[section]));
}
