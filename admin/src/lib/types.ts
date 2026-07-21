export type AdminProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'admin' | 'runner' | 'customer';
  active_role: string;
  run_score: number;
  run_score_level: string;
  rating_sum: number;
  rating_count: number;
  suspended: boolean;
  restricted: boolean;
  created_at: string;
};

export type RunnerVerification = {
  id: string;
  user_id: string;
  id_document_url: string;
  selfie_url: string;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  profiles?: { full_name: string; phone: string | null } | null;
};

export type Vehicle = {
  id: string;
  user_id: string;
  make_model: string;
  plate_number: string | null;
  photo_urls: string[];
  approved: boolean;
  review_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
};

export type Trip = {
  id: string;
  runner_id: string;
  from_city: string;
  to_city: string;
  from_country: string;
  to_country: string;
  depart_date: string;
  depart_time: string;
  capacity_kg: number;
  spaces_remaining: number;
  services: string[];
  status: string;
  created_at: string;
  profiles?: { full_name: string } | null;
};

export type RequestItem = {
  id: string;
  customer_id: string;
  type: string;
  from_city: string;
  to_city: string;
  estimated_value: number;
  details: string | null;
  status: string;
  created_at: string;
  profiles?: { full_name: string } | null;
};

export type OrderRoom = {
  id: string;
  match_id: string;
  customer_id: string;
  runner_id: string;
  is_read_only: boolean;
  created_at: string;
  escrow_transactions?: EscrowTransaction | null;
  runner?: { full_name: string } | null;
  customer?: { full_name: string } | null;
};

export type EscrowTransaction = {
  id: string;
  order_room_id: string;
  item_value: number;
  runner_fee: number;
  platform_fee: number;
  protection_fee: number;
  total: number;
  status: string;
};

export type Dispute = {
  id: string;
  order_room_id: string;
  raised_by: string;
  reason: string;
  evidence: Record<string, unknown>;
  status: 'open' | 'reviewing' | 'resolved';
  admin_notes: string | null;
  resolution: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
};

export type Wallet = {
  id: string;
  user_id: string;
  owner_type: string;
  available_balance: number;
  pending_balance: number;
  frozen_balance: number;
  profiles?: { full_name: string } | null;
};

export type WalletTransaction = {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  reference: string | null;
  note: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  notes: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
};

export type RestrictedItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_absolute: boolean;
  notes: string | null;
  created_at: string;
};

export type DashboardStats = {
  pendingVerifications: number;
  pendingVehicles: number;
  openDisputes: number;
  activeOrders: number;
  totalUsers: number;
  platformRevenue: number;
};
