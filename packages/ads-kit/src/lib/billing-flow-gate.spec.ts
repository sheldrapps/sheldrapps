import { BillingFlowGate } from './billing-flow-gate';

describe('BillingFlowGate', () => {
  it('allows one foreground flow and rejects concurrent flows', () => {
    const gate = new BillingFlowGate();

    expect(gate.begin(true)).toBeTrue();
    expect(gate.begin(true)).toBeFalse();

    gate.complete();

    expect(gate.begin(true)).toBeTrue();
  });

  it('rejects flows while the app is inactive', () => {
    const gate = new BillingFlowGate();
    gate.setAppActive(false);

    expect(gate.canRunBillingOperations()).toBeFalse();
    expect(gate.begin(true)).toBeFalse();
  });

  it('blocks future flows after a native launch failure', () => {
    const gate = new BillingFlowGate();
    gate.block();

    expect(gate.canRunBillingOperations()).toBeFalse();
    expect(gate.begin(true)).toBeFalse();
    expect(gate.getState()).toEqual({
      appActive: true,
      inProgress: false,
      blocked: true,
    });
  });
});
