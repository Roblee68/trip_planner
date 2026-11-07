export type DistanceUnit = 'km' | 'mi';
const KM_PER_MILE = 1.609344;

export function toKilometres(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value * KM_PER_MILE : value;
}

export function fromKilometres(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? km / KM_PER_MILE : km;
}

export function formatDistance(km: number, unit: DistanceUnit): string {
  const value = fromKilometres(km, unit);
  return `${value < 10 ? Math.round(value * 10) / 10 : Math.round(value)} ${unit}`;
}
