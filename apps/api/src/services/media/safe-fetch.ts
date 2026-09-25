import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { Agent } from 'undici';
import { isPrivateOrLocalIp } from './url-guard.js';

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * DNS lookup used at connect time. Every resolved address must be public, and the connection
 * uses exactly the addresses checked here, so a host cannot answer "public" to a pre-check
 * and "127.0.0.1" to the real connection (DNS rebinding).
 */
export function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
): void {
  dnsLookup(hostname, { all: true, family: options.family }, (err, addresses) => {
    if (err) {
      callback(err, []);
      return;
    }
    if (addresses.length === 0 || addresses.some((a) => isPrivateOrLocalIp(a.address))) {
      const blocked: NodeJS.ErrnoException = new Error('Local URLs cannot be imported');
      blocked.code = 'EBLOCKED';
      callback(blocked, []);
      return;
    }
    if (options.all) {
      callback(null, addresses);
      return;
    }
    const first = addresses[0];
    if (!first) {
      callback(new Error('No address'), []);
      return;
    }
    callback(null, first.address, first.family);
  });
}

let agent: Agent | null = null;

/** fetch that refuses to connect to non-public addresses, whatever DNS says at connect time. */
export const safeFetch: typeof fetch = (input, init) => {
  agent ??= new Agent({ connect: { lookup: safeLookup } });
  // Node's global fetch accepts undici's `dispatcher`; it is not in the DOM RequestInit type.
  return fetch(input, { ...init, dispatcher: agent } as unknown as RequestInit);
};
