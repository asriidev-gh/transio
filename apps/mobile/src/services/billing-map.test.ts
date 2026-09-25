import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planIdFromPackageType, planIdFromProductId } from './billing-map';

describe('billing plan mapping', () => {
  it('maps package types to plans and ignores the rest', () => {
    assert.equal(planIdFromPackageType('WEEKLY'), 'weekly');
    assert.equal(planIdFromPackageType('MONTHLY'), 'monthly');
    assert.equal(planIdFromPackageType('ANNUAL'), 'yearly');
    for (const other of ['LIFETIME', 'SIX_MONTH', 'CUSTOM', 'UNKNOWN', '', null, undefined]) {
      assert.equal(planIdFromPackageType(other), null);
    }
  });

  it('guesses the plan from a product id', () => {
    assert.equal(planIdFromProductId('smart_transcriber_weekly'), 'weekly');
    assert.equal(planIdFromProductId('smart_transcriber_monthly:base'), 'monthly');
    assert.equal(planIdFromProductId('Smart_Transcriber_Yearly'), 'yearly');
    assert.equal(planIdFromProductId('pro_annual'), 'yearly');
    assert.equal(planIdFromProductId('something_else'), null);
    assert.equal(planIdFromProductId(undefined), null);
  });
});
