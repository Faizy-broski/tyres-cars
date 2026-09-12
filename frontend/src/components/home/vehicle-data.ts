// Common vehicle → OEM tyre size lookup for the hero "Search By Vehicle" flow.
// Keeps this a client-side, database-free static table — deliberately small
// and curated rather than a full fitment database.

export interface VehicleFitment {
  model: string
  width: number
  profile: number
  rim: number
}

export interface VehicleMakeData {
  make: string
  models: VehicleFitment[]
}

export const VEHICLE_YEARS = Array.from({ length: 12 }, (_, i) => String(2025 - i))

export const VEHICLE_DATA: VehicleMakeData[] = [
  {
    make: 'Toyota',
    models: [
      { model: 'Corolla', width: 205, profile: 55, rim: 16 },
      { model: 'Camry',   width: 215, profile: 60, rim: 16 },
      { model: 'RAV4',    width: 265, profile: 65, rim: 17 },
      { model: 'Hilux',   width: 265, profile: 70, rim: 16 },
    ],
  },
  {
    make: 'Mazda',
    models: [
      { model: 'Mazda 3',  width: 205, profile: 60, rim: 16 },
      { model: 'Mazda CX-5', width: 265, profile: 60, rim: 18 },
    ],
  },
  {
    make: 'Ford',
    models: [
      { model: 'Ranger', width: 265, profile: 70, rim: 16 },
      { model: 'Focus',  width: 195, profile: 65, rim: 15 },
    ],
  },
  {
    make: 'Holden',
    models: [
      { model: 'Commodore', width: 225, profile: 45, rim: 17 },
    ],
  },
  {
    make: 'Hyundai',
    models: [
      { model: 'i30',    width: 205, profile: 55, rim: 16 },
      { model: 'Tucson', width: 265, profile: 65, rim: 17 },
    ],
  },
  {
    make: 'Kia',
    models: [
      { model: 'Sportage', width: 265, profile: 60, rim: 18 },
    ],
  },
  {
    make: 'Mitsubishi',
    models: [
      { model: 'Triton', width: 245, profile: 75, rim: 16 },
      { model: 'ASX',    width: 215, profile: 60, rim: 16 },
    ],
  },
  {
    make: 'Nissan',
    models: [
      { model: 'X-Trail', width: 265, profile: 65, rim: 17 },
      { model: 'Navara',  width: 265, profile: 70, rim: 16 },
    ],
  },
  {
    make: 'Volkswagen',
    models: [
      { model: 'Golf', width: 225, profile: 45, rim: 17 },
    ],
  },
  {
    make: 'Honda',
    models: [
      { model: 'CR-V', width: 265, profile: 60, rim: 18 },
    ],
  },
  {
    make: 'Subaru',
    models: [
      { model: 'Forester', width: 205, profile: 60, rim: 16 },
    ],
  },
  {
    make: 'Suzuki',
    models: [
      { model: 'Swift', width: 195, profile: 65, rim: 15 },
    ],
  },
]

export const VEHICLE_MAKES = VEHICLE_DATA.map(m => m.make)

export function getModelsForMake(make: string): string[] {
  return VEHICLE_DATA.find(m => m.make === make)?.models.map(mo => mo.model) ?? []
}

export function getFitmentForVehicle(make: string, model: string): VehicleFitment | null {
  return VEHICLE_DATA.find(m => m.make === make)?.models.find(mo => mo.model === model) ?? null
}
