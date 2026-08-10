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

export type WaitlistSignup = {
  id: string;
  email: string;
  full_name: string;
  interest: 'customer' | 'runner' | 'both';
  town_city: string;
  frequent_routes: string | null;
  phone: string | null;
  marketing_consent: boolean;
  source: string;
  status: 'new' | 'contacted' | 'converted' | 'archived';
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

// ---------------------------------------------------------------------------
// Wallet & Payment System
// ---------------------------------------------------------------------------

export type PaymentStatus =
  | 'payment_verification_required'
  | 'info_requested'
  | 'paid'
  | 'rejected'
  | 'refunded'
  | 'cancelled';

export type Payment = {
  id: string;
  order_no: string;
  order_room_id: string;
  customer_id: string;
  runner_id: string;
  delivery_fee: number;
  commission: number;
  runner_earnings: number;
  total_amount: number;
  payment_method: string;
  recipient_name: string | null;
  status: PaymentStatus;
  reference_number: string | null;
  amount_reported: number | null;
  screenshot_url: string | null;
  paid_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  info_request_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: { full_name: string; phone: string | null } | null;
  runner?: { full_name: string; phone: string | null } | null;
  payment_references?: PaymentReference[] | null;
  order_rooms?: { id: string; created_at: string } | null;
};

export type PaymentReference = {
  id: string;
  payment_id: string;
  submitted_by: string;
  reference_number: string;
  amount_reported: number | null;
  screenshot_url: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

export type TransactionType =
  | 'CUSTOMER_PAYMENT'
  | 'RUNWISE_COMMISSION'
  | 'RUNNER_EARNING'
  | 'RUNNER_SETTLEMENT'
  | 'REFUND'
  | 'PAYMENT_REVERSAL'
  | 'ADJUSTMENT';

export type LedgerTransaction = {
  id: string;
  tx_ref: string;
  order_room_id: string | null;
  payment_id: string | null;
  customer_id: string | null;
  runner_id: string | null;
  amount: number;
  transaction_type: TransactionType;
  payment_method: string | null;
  status: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  customer?: { full_name: string; phone: string | null } | null;
  runner?: { full_name: string; phone: string | null } | null;
};

export type WalletLedger = {
  id: string;
  order_room_id: string;
  order_no: string;
  customer_payment: number;
  runwise_revenue: number;
  runner_earnings: number;
  refund_amount: number;
  payment_status: string;
  delivery_status: string;
  settlement_status: string;
  created_at: string;
};

export type RunnerEarning = {
  id: string;
  runner_id: string;
  order_room_id: string;
  payment_id: string | null;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  settled_at: string | null;
  settled_by: string | null;
  created_at: string;
};

export type Settlement = {
  id: string;
  runner_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  payment_method: string | null;
  reference_number: string | null;
  requested_by: string | null;
  processed_by: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  runner?: { full_name: string; phone: string | null } | null;
};

export type Refund = {
  id: string;
  payment_id: string | null;
  order_room_id: string;
  customer_id: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'processed' | 'rejected';
  processed_by: string | null;
  processed_at: string | null;
  notes: string | null;
  created_at: string;
  payment?: { order_no: string; total_amount: number; payment_method: string | null; reference_number: string | null } | null;
  customer?: { full_name: string; phone: string | null } | null;
};

export type PaymentMethod = {
  id: string;
  display_name: string;
  mode: string;
  recipient_name: string | null;
  is_active: boolean;
  sort_order: number;
};

export type PaymentDashboardStats = {
  total_transactions: number;
  today_revenue: number;
  paid_today: number;
  total_commission: number;
  total_runner_earnings: number;
  awaiting_verification: number;
  info_requested: number;
  pending_settlements: number;
  completed_deliveries: number;
  refunds: number;
  rejected_payments: number;
  pending_refunds: number;
};

export type RunnerWalletSummary = {
  runner_id: string;
  total_earned: number;
  pending: number;
  paid_out: number;
  available: number;
  completed_deliveries: number;
};
