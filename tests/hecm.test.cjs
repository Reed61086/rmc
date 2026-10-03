const {test} = require('node:test');
const assert = require('node:assert/strict');
const {lookupPlf, refinanceAvailability, calculateEstimate} = require('../hecm.js');
test('HUD table reproduces independent cells and nearest eighth rounding', () => {
  for (const [age, rate, expected] of [[62,3,.524],[79,6.625,.450],[79,6.78,.444],[79,6.875,.439],[99,6.75,.699],[62,18.875,.068]]) {
    assert.equal(lookupPlf(age,rate).factor,expected);
  }
  assert.equal(lookupPlf(79,6.78).lookupRate,6.75);
  assert.equal(lookupPlf(79,6.8125).lookupRate,6.875);
  for (const args of [[61,6],[100,6],[79,2.9],[79,19],[NaN,6]]) assert.throws(()=>lookupPlf(...args));
});
test('RMI borrower fixture reconciles principal limit, repairs and first year', () => {
  const r=calculateEstimate({age:79,value:300000,oneYear:4.15,tenYear:4.78,margin:2,payoff:80000,fees:2459,repairs:6000,repairFee:0,mode:'standard'});
  assert.equal(r.initialRate,6.15); assert.equal(r.expectedRate,6.78);
  assert.equal(r.factor,.444); assert.equal(r.principalLimit,133200);
  assert.equal(r.repairReserve,9000); assert.equal(r.closingCosts,13459);
  assert.equal(r.mandatoryObligations,102459); assert.equal(r.disbursementLimit,115779);
  assert.equal(r.netAvailable,30741); assert.equal(r.firstYearCash,13320);
});
test('first-year branches cap cash, preserve shortages and separate reserves', () => {
  for(const [obligations,cash,shortage] of [[20000,40000,0],[70000,10000,0],[95000,5000,0],[105000,0,5000]]) {
    const r=refinanceAvailability(100000,obligations);
    assert.equal(r.firstYearCash,cash); assert.equal(r.shortage,shortage);
    assert.ok(r.disbursementLimit<=100000);
  }
});
test('repair fee is explicit, bounded, and counted once; purchase rejects reserve', () => {
  const input={age:79,value:300000,oneYear:4.15,tenYear:4.78,margin:2,payoff:80000,fees:2459,repairs:6000,repairFee:90,mode:'standard'};
  const r=calculateEstimate(input);
  assert.equal(r.closingCosts,13549); assert.equal(r.netAvailable,30651);
  assert.equal(r.firstYearCash,13320);
  assert.throws(()=>calculateEstimate({...input,repairFee:91}));
  assert.throws(()=>calculateEstimate({...input,mode:'h4p'}));
  assert.throws(()=>calculateEstimate({...input,repairs:-1}));
});
