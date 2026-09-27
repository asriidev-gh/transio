import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'smart-transcriber-store-review';

export interface StoreReviewState {
  opens: number;
  /** Set when the prompt has been shown. It does not appear again. */
  prompted: boolean;
  /** 1–5 once the user picks a star. */
  star: number | null;
}

const EMPTY: StoreReviewState = { opens: 0, prompted: false, star: null };

/** Second launch, and only if they have never been asked or chosen a star. */
export function shouldShowStoreReview(state: StoreReviewState): boolean {
  return state.opens >= 2 && !state.prompted && state.star == null;
}

function normalize(raw: Partial<StoreReviewState> | null): StoreReviewState {
  const star = Number(raw?.star);
  return {
    opens: Math.max(0, Number(raw?.opens) || 0),
    prompted: Boolean(raw?.prompted),
    star: star >= 1 && star <= 5 ? star : null,
  };
}

export async function loadStoreReview(): Promise<StoreReviewState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return normalize(JSON.parse(raw) as Partial<StoreReviewState>);
  } catch {
    return { ...EMPTY };
  }
}

async function save(state: StoreReviewState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

let openRecorded: Promise<StoreReviewState> | null = null;
let claimHeld = false;

/** Count one app open per process. Later callers share the same result. */
export function recordAppOpen(): Promise<StoreReviewState> {
  if (!openRecorded) {
    openRecorded = (async () => {
      const prev = await loadStoreReview();
      const next = { ...prev, opens: prev.opens + 1 };
      await save(next);
      return next;
    })();
  }
  return openRecorded;
}

/** True when this launch should show the prompt. Call release if the screen goes away first. */
export async function tryClaimStoreReviewPrompt(): Promise<boolean> {
  const recorded = await recordAppOpen();
  const fresh = await loadStoreReview();
  const merged: StoreReviewState = {
    ...fresh,
    opens: Math.max(fresh.opens, recorded.opens),
  };
  if (!shouldShowStoreReview(merged) || claimHeld) return false;
  claimHeld = true;
  return true;
}

export function releaseStoreReviewClaim(): void {
  claimHeld = false;
}

export async function markStoreReviewPrompted(): Promise<void> {
  const state = await loadStoreReview();
  if (state.prompted) return;
  await save({ ...state, prompted: true });
}

export async function saveStoreReviewStar(star: number): Promise<void> {
  const state = await loadStoreReview();
  await save({ ...state, prompted: true, star });
}
