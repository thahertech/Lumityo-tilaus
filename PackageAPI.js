import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

export const PACKAGE_PREVIEW_ENABLED =
  Platform.OS !== 'web' && process.env.EXPO_PUBLIC_PACKAGE_ENABLED === 'true';
export const PACKAGE_TERMS_VERSION = process.env.EXPO_PUBLIC_PACKAGE_TERMS_VERSION || '';

const storage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

let supabase;
function getClient() {
  if (!PACKAGE_PREVIEW_ENABLED) throw new Error('Package preview is disabled');
  if (!supabase) {
    supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { storage, storageKey: 'lumityot-package-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
    );
    AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  }
  return supabase;
}

const journalKey = (kind, userId) => `lumityot_${kind}_${userId}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cancellationKey = 'lumityot_package_cancellation';
const validCancellation = (value) => typeof value?.name === 'string' && value.name.trim().length > 0 &&
  value.name.trim().length <= 200 && typeof value.email === 'string' && value.email.trim().length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()) &&
  typeof value.contract === 'string' && value.contract.trim().length > 0 && value.contract.trim().length <= 1000 &&
  !/[\u0000-\u001f\u007f]/.test(value.name + value.email + value.contract);

export async function getPendingCancellation() {
  const raw = await SecureStore.getItemAsync(cancellationKey);
  if (raw === null) return null;
  const request = JSON.parse(raw);
  if (!request || typeof request.id !== 'string' || !uuid.test(request.id) || !validCancellation(request.payload)) {
    throw new Error('Stored cancellation request is invalid');
  }
  return request;
}

export async function submitPackageCancellation(payload) {
  if (!validCancellation(payload)) throw new Error('Invalid cancellation details');
  const normalized = { name: payload.name.trim(), email: payload.email.trim(), contract: payload.contract.trim() };
  let request = await getPendingCancellation();
  if (request && JSON.stringify(request.payload) !== JSON.stringify(normalized)) {
    throw new Error('A different cancellation request is awaiting confirmation');
  }
  if (!request) {
    request = { id: Crypto.randomUUID(), payload: normalized };
    await SecureStore.setItemAsync(cancellationKey, JSON.stringify(request));
  }
  const { data, error } = await getClient().functions.invoke('package-cancellation', {
    body: { id: request.id, ...request.payload },
  });
  if (error) throw error;
  if (typeof data?.receivedAt !== 'string' || !Number.isFinite(Date.parse(data.receivedAt))) {
    throw new Error('Invalid cancellation confirmation');
  }
  await SecureStore.deleteItemAsync(cancellationKey);
  return data.receivedAt;
}

function validCheckout(payload, allowMissingEmail = false) {
  return typeof payload?.address === 'string' && payload.address.length >= 5 &&
    payload.address.length <= 250 && !/[\u0000-\u001f\u007f]/.test(payload.address) &&
    ((allowMissingEmail && payload.email === undefined) || (typeof payload?.email === 'string' && payload.email.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) && !/[\u0000-\u001f\u007f]/.test(payload.email))) &&
    typeof payload.deviceId === 'string' && payload.deviceId.length > 0 &&
    payload.deviceId.length <= 200 && !/[\u0000-\u001f\u007f]/.test(payload.deviceId) &&
    typeof payload.phone === 'string' && payload.phone.length > 0 &&
    payload.phone.length <= 40 && !/[\u0000-\u001f\u007f]/.test(payload.phone) &&
    typeof payload.termsVersion === 'string' && payload.termsVersion.length > 0;
}

function validOrder(payload) {
  return typeof payload?.p_purchase_id === 'string' && uuid.test(payload.p_purchase_id) &&
    typeof payload.p_device_id === 'string' && payload.p_device_id.trim().length > 0 && payload.p_device_id.trim().length <= 200 &&
    typeof payload.p_name === 'string' && payload.p_name.trim().length > 0 && payload.p_name.trim().length <= 200 &&
    typeof payload.p_phone === 'string' && payload.p_phone.trim().length > 0 && payload.p_phone.trim().length <= 40 &&
    (payload.p_info === null || (typeof payload.p_info === 'string' && payload.p_info.length <= 2000));
}

async function readJournal(kind, userId) {
  const raw = await SecureStore.getItemAsync(journalKey(kind, userId));
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !uuid.test(value.id) ||
      !(kind === 'checkout' ? validCheckout(value.payload, true) : validOrder(value.payload))) {
    throw new Error('Stored package request is invalid');
  }
  return value;
}

async function writeJournal(kind, userId, request) {
  await SecureStore.setItemAsync(journalKey(kind, userId), JSON.stringify(request));
}

export async function getPackageSession() {
  const { data, error } = await getClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function ensurePackageSession() {
  const client = getClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;
  const { data: anonymous, error: anonymousError } = await client.auth.signInAnonymously();
  if (anonymousError) throw anonymousError;
  if (!anonymous.session?.user?.id) throw new Error('Anonymous package session was not created');
  return anonymous.session;
}

export async function signOutPackage() {
  const { error } = await getClient().auth.signOut();
  if (error) throw error;
}

export async function getPackages() {
  const { data, error } = await getClient().rpc('my_snow_packages');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Invalid package balance response');
  return data;
}

export async function getPackageOrders() {
  const { data, error } = await getClient().rpc('my_package_orders');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Invalid package orders response');
  return data;
}

export const getPendingCheckout = (userId) => readJournal('checkout', userId);
export const getPendingPackageOrder = (userId) => readJournal('order', userId);

export async function recoverPendingCheckout(userId) {
  const [local, result] = await Promise.all([
    getPendingCheckout(userId), getClient().rpc('my_unresolved_package_checkout'),
  ]);
  if (result.error) throw result.error;
  if (!Array.isArray(result.data) || result.data.length > 1) throw new Error('Invalid unresolved checkout response');
  const remote = result.data[0];
  if (!remote) return local;
  const request = { id: remote.id, payload: {
    address: remote.service_address, deviceId: remote.device_id, phone: remote.phone,
    email: remote.customer_email, termsVersion: remote.terms_version,
  } };
  if (typeof request.id !== 'string' || !uuid.test(request.id) || !validCheckout(request.payload)) {
    throw new Error('Invalid unresolved checkout');
  }
  const localMatchesRemote = local && ['address', 'deviceId', 'phone', 'termsVersion']
    .every((key) => local.payload[key] === request.payload[key]) &&
    (!local.payload.email || local.payload.email === request.payload.email);
  if (local && (local.id !== request.id || !localMatchesRemote)) {
    throw new Error('Conflicting unresolved checkout requests');
  }
  if (!local || !local.payload.email) await writeJournal('checkout', userId, request);
  return local?.payload.email ? local : request;
}

export async function startOrResumeCheckout(userId, address, phone, email, deviceId, termsVersion) {
  const client = getClient();
  let request = await getPendingCheckout(userId);
  if (!request) {
    const payload = { address: address.trim(), deviceId: deviceId.trim(), phone: phone.trim(), email: typeof email === 'string' ? email.trim().toLowerCase() : '', termsVersion };
    if (!validCheckout(payload)) throw new Error('Invalid checkout details');
    request = { id: Crypto.randomUUID(), payload };
    await writeJournal('checkout', userId, request);
  } else if (!request.payload.email && email?.trim()) {
    request.payload.email = email.trim().toLowerCase();
    if (!validCheckout(request.payload)) throw new Error('Invalid checkout details');
    await writeJournal('checkout', userId, request);
  }
  const { data, error } = await client.functions.invoke('package-checkout', {
    body: { checkoutId: request.id, ...request.payload },
  });
  if (error) {
    let errorCode;
    try { errorCode = (await error.context?.json())?.error; } catch { /* Keep the original function error. */ }
    if (errorCode) throw new Error(errorCode);
    throw error;
  }
  if (!data || typeof data.status !== 'string') throw new Error('Invalid checkout response');
  if (data.status === 'paid') await SecureStore.deleteItemAsync(journalKey('checkout', userId));
  return data;
}

export async function submitPackageOrder(userId, payload) {
  const client = getClient();
  let request = await getPendingPackageOrder(userId);
  if (!request) {
    if (!validOrder(payload)) throw new Error('Invalid order details');
    request = { id: Crypto.randomUUID(), payload };
    await writeJournal('order', userId, request);
  } else if (JSON.stringify(request.payload) !== JSON.stringify(payload)) {
    throw new Error('A different package order is awaiting confirmation');
  }
  const { data, error } = await client.rpc('create_package_order', {
    p_request_id: request.id,
    ...request.payload,
  });
  if (error) throw error;
  if (!Number.isInteger(data)) throw new Error('Invalid order confirmation');
  await SecureStore.deleteItemAsync(journalKey('order', userId));
  return data;
}
