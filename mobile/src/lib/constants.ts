export const REQUEST_TYPES = [
  'shopping',
  'parcel',
  'documents',
  'medicine',
  'gift',
  'business_stock',
  'large_cargo',
] as const;

export const REQUEST_LABELS: Record<string, string> = {
  shopping: 'Shopping',
  parcel: 'Parcel',
  documents: 'Documents',
  medicine: 'Medicine',
  gift: 'Gift',
  business_stock: 'Business stock',
  large_cargo: 'Large cargo',
};

export const REQUEST_ICONS: Record<string, string> = {
  shopping: '🛍️',
  parcel: '📦',
  documents: '📄',
  medicine: '💊',
  gift: '🎁',
  business_stock: '🏪',
  large_cargo: '🚚',
};

export const TRANSPORT_MODES = [
  { value: 'private_car', label: 'Car', icon: '🚗' },
  { value: 'bus_coach', label: 'Bus/Coach', icon: '🚌' },
  { value: 'combi_taxi', label: 'Combi/Taxi', icon: '🚐' },
  { value: 'truck', label: 'Truck', icon: '🚛' },
  { value: 'motorcycle', label: 'Bike', icon: '🏍️' },
  { value: 'bicycle', label: 'Cycle', icon: '🚲' },
  { value: 'air_travel', label: 'Air', icon: '✈️' },
  { value: 'other', label: 'Other', icon: '🚶' },
] as const;

// Modes that run on the runner's own registered, admin-approved vehicle.
export const PRIVATE_VEHICLE_MODES = ['private_car', 'motorcycle', 'truck'];

// Public passenger-transport modes that need a company name + registration plate.
export const TRANSIT_MODES = ['bus_coach', 'combi_taxi'];

export const MILESTONES: Record<string, string> = {
  heading_to_pickup: 'Heading to pickup',
  collected: 'Collected',
  shopping_started: 'Shopping started',
  shopping_complete: 'Shopping complete',
  journey_started: 'Journey started',
  border_reached: 'Border reached',
  customs_processing: 'Customs processing',
  border_cleared: 'Border cleared',
  destination_reached: 'Destination reached',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  delayed: 'Delayed',
  personal_stop: 'Personal stop',
  vehicle_breakdown: 'Vehicle breakdown',
  emergency: 'Emergency',
};

export const DISPUTE_REASONS = [
  'Item not delivered',
  'Item damaged',
  'Wrong item or quantity',
  'Unexpected delay',
  'Payment or fee problem',
  'Safety concern',
  'Other',
];

export const formatMoney = (value: number | string | null | undefined) =>
  `P${Number(value || 0).toFixed(2)}`;

export const titleCase = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
