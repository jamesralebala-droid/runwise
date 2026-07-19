import * as Crypto from 'expo-crypto';
import { MatchOffer, OrderRoom, RequestItem, Trip, Vehicle, Wallet } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export const newId = () => Crypto.randomUUID();

export async function getOpenTrips(): Promise<Trip[]> {
  const { data, error } = await supabase.from('trips').select('*').in('status', ['leaving_soon', 'today', 'tomorrow', 'upcoming']).order('depart_date').limit(50);
  if (error) throw error;
  const trips = (data || []) as Trip[];
  const runnerIds = [...new Set(trips.map((trip) => trip.runner_id))];
  if (!runnerIds.length) return trips;
  const profiles = await supabase.from('public_profiles').select('id, full_name, rating_sum, rating_count').in('id', runnerIds);
  if (profiles.error) return trips;
  const byId = new Map((profiles.data || []).map((profile) => [profile.id, profile]));
  return trips.map((trip) => ({ ...trip, profiles: byId.get(trip.runner_id) || null }));
}

export async function getMyRequests(userId: string): Promise<RequestItem[]> {
  const { data, error } = await supabase.from('requests').select('*').eq('customer_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as RequestItem[];
}

export async function getOpenRequests(): Promise<RequestItem[]> {
  const { data, error } = await supabase.from('requests').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []) as RequestItem[];
}

export async function getMyTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase.from('trips').select('*').eq('runner_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Trip[];
}

export async function getCustomerMatches(userId: string): Promise<MatchOffer[]> {
  const { data, error } = await supabase.from('matches').select('*, trips(*), requests(*)').eq('customer_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as MatchOffer[];
}

export async function getOrders(userId: string, role: 'customer' | 'runner' | 'admin'): Promise<OrderRoom[]> {
  let query = supabase.from('order_rooms').select('*, escrow_transactions(*)').order('created_at', { ascending: false });
  if (role !== 'admin') query = query.eq(role === 'runner' ? 'runner_id' : 'customer_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as OrderRoom[];
}

export async function getWallet(userId: string): Promise<Wallet | null> {
  const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as Wallet | null;
}

export async function getWalletTransactions(walletId: string) {
  const { data, error } = await supabase.from('wallet_transactions').select('*').eq('wallet_id', walletId).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data || [];
}

export async function getVerification(userId: string) {
  const { data, error } = await supabase.from('runner_verifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getVehicles(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase.from('vehicles').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Vehicle[];
}

export async function recordAcceptance(userId: string, role: string, documentType: string, context: string, relatedId?: string) {
  const { data: document } = await supabase.from('legal_documents').select('version').eq('document_type', documentType).eq('status', 'published').maybeSingle();
  const { error } = await supabase.from('legal_acceptances').insert({
    user_id: userId,
    document_type: documentType,
    document_version: document?.version || '1.0',
    acceptance_context: context,
    related_record_id: relatedId || null,
    user_role: role,
  });
  if (error) throw error;
}

export async function uploadAsset(userId: string, folder: 'kyc' | 'vehicles', asset: { uri: string; name: string; mimeType?: string | null }) {
  const response = await fetch(asset.uri);
  const bytes = await response.arrayBuffer();
  const cleanName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${folder}/${userId}/${Date.now()}-${cleanName}`;
  const { error } = await supabase.storage.from('runwise-uploads').upload(path, bytes, { contentType: asset.mimeType || 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
