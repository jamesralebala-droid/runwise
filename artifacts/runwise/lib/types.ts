export type UserRole = 'customer' | 'runner' | 'admin';

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  active_role: UserRole;
  run_score: number;
  run_score_level: 'bronze' | 'silver' | 'gold' | 'platinum';
  rating_sum: number;
  rating_count: number;
  suspended?: boolean;
  restricted?: boolean;
  created_at: string;
};

export type Trip = {
  id: string;
  runner_id: string;
  vehicle_id: string | null;
  from_country: string;
  from_city: string;
  to_country: string;
  to_city: string;
  from_landmark?: string | null;
  to_landmark?: string | null;
  written_directions?: string | null;
  depart_date: string;
  depart_time: string;
  stops: string[];
  capacity_kg: number;
  capacity_spaces: number;
  spaces_remaining: number;
  services: string[];
  potential_earnings: number;
  status: string;
  created_at: string;
  profiles?: { full_name: string; rating_sum: number; rating_count: number } | null;
};

export type RequestItem = {
  id: string;
  customer_id: string;
  type: string;
  from_city: string;
  to_city: string;
  estimated_value: number;
  from_landmark?: string | null;
  to_landmark?: string | null;
  written_directions?: string | null;
  details: string | null;
  status: string;
  created_at: string;
};

export type MatchOffer = {
  id: string;
  trip_id: string;
  request_id: string;
  runner_id: string;
  customer_id: string;
  status: string;
  created_at: string;
  trips?: Trip | null;
  requests?: RequestItem | null;
};

export type Escrow = {
  id: string;
  order_room_id: string;
  item_value: number;
  runner_fee: number;
  platform_fee: number;
  protection_fee: number;
  priority_fee: number;
  total: number;
  status: string;
};

export type OrderRoom = {
  id: string;
  match_id: string;
  customer_id: string;
  runner_id: string;
  is_read_only: boolean;
  created_at: string;
  escrow_transactions?: Escrow | null;
};

export type Wallet = {
  id: string;
  user_id: string;
  owner_type: string;
  available_balance: number;
  pending_balance: number;
  frozen_balance: number;
};

export type Vehicle = {
  id: string;
  user_id: string;
  make_model: string;
  plate_number: string | null;
  photo_urls: string[];
  approved: boolean;
  review_status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  created_at: string;
};
