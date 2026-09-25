import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ConsumeOutcome,
  ConsumeParams,
  QuotaRepository,
  RefundParams,
} from './types.js';

const OUTCOMES: ReadonlySet<string> = new Set([
  'ok',
  'already_counted',
  'free_limit',
  'daily_limit',
  'paused',
]);

/** Quota storage in Supabase. Needs the service role: the tables allow no other access. */
export class SupabaseQuotaRepository implements QuotaRepository {
  constructor(private readonly client: SupabaseClient) {}

  async consume(params: ConsumeParams): Promise<ConsumeOutcome> {
    const { data, error } = await this.client.rpc('consume_quota', {
      p_feature: params.feature,
      p_user_id: params.userId,
      p_device_hash: params.deviceHash,
      p_is_pro: params.isPro,
      p_free_limit: params.freeLimit,
      p_pro_daily_limit: params.proDailyLimit,
      p_global_limit: params.globalLimit,
      p_conversation_id: params.conversationId,
    });
    if (error) throw new Error(`consume_quota failed: ${error.message}`);
    if (typeof data !== 'string' || !OUTCOMES.has(data)) {
      throw new Error('consume_quota returned an unexpected value');
    }
    return data as ConsumeOutcome;
  }

  async refund(params: RefundParams): Promise<void> {
    const { error } = await this.client.rpc('refund_quota', {
      p_feature: params.feature,
      p_user_id: params.userId,
      p_device_hash: params.deviceHash,
      p_is_pro: params.isPro,
      p_global_limit: params.globalLimit,
      p_conversation_id: params.conversationId,
    });
    if (error) throw new Error(`refund_quota failed: ${error.message}`);
  }

  async isPro(userId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('subscriptions')
      .select('is_active, expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`subscription lookup failed: ${error.message}`);
    if (!data?.is_active) return false;
    if (!data.expires_at) return true;
    return new Date(data.expires_at as string).getTime() > Date.now();
  }

  async claimGuestDevice(userId: string, deviceHash: string): Promise<{ ownerUserId: string }> {
    const { error: insertError } = await this.client
      .from('guest_devices')
      .upsert(
        { device_hash: deviceHash, user_id: userId },
        { onConflict: 'device_hash', ignoreDuplicates: true },
      );
    if (insertError) throw new Error(`device claim failed: ${insertError.message}`);

    const { data, error } = await this.client
      .from('guest_devices')
      .select('user_id')
      .eq('device_hash', deviceHash)
      .maybeSingle();
    if (error || !data) throw new Error('device claim lookup failed');
    return { ownerUserId: data.user_id as string };
  }
}
