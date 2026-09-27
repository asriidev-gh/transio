import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldShowStoreReview, type StoreReviewState } from './store-review';

const fresh: StoreReviewState = { opens: 0, prompted: false, star: null };

describe('shouldShowStoreReview', () => {
  it('waits until the second open', () => {
    assert.equal(shouldShowStoreReview({ ...fresh, opens: 1 }), false);
    assert.equal(shouldShowStoreReview({ ...fresh, opens: 2 }), true);
  });

  it('stays hidden after the prompt was shown or a star was chosen', () => {
    assert.equal(shouldShowStoreReview({ opens: 3, prompted: true, star: null }), false);
    assert.equal(shouldShowStoreReview({ opens: 3, prompted: false, star: 5 }), false);
  });
});
