import { apiRequest, ApiClientError } from '@/src/services/api';
import { getDeviceId } from '@/src/services/device-id';

/**
 * Tell the API which guest account owns this device. Call right after guest sign-in.
 * Returns true when this device may keep using the account. Throws only for
 * DEVICE_ALREADY_CLAIMED, the one answer the app must act on. Any other failure lets the
 * user in: the server enforces limits itself and a network blip must not lock anyone out.
 */
export async function claimGuestDevice(): Promise<boolean> {
  if (!getDeviceId()) return false;
  try {
    await apiRequest<{ claimed: boolean; conflict: boolean }>('/device/claim', {
      method: 'POST',
      auth: true,
      body: {},
      retries: 1,
    });
    return true;
  } catch (err) {
    if (err instanceof ApiClientError && err.code === 'DEVICE_ALREADY_CLAIMED') throw err;
    return false;
  }
}
