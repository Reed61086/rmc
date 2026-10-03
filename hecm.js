/* Pure calculation path used by the calculator, report and regression tests. */
(function(root, factory) {
  if(typeof module==='object' && module.exports) module.exports=factory(require('./data/hud-plf.js'));
  else root.Hecm=factory(root.HudPlfData);
})(globalThis, function(table) {
  'use strict';
  function lookupPlf(age, expectedRate) {
    if(!table || !Number.isInteger(age) || age<table.minAge || age>table.maxAge || !Number.isFinite(expectedRate) || expectedRate<3 || expectedRate>18.875) {
      throw Error('HUD lookup requires an age from 62–99 and expected rate from 3%–18.875%.');
    }
    const eighth=Math.round((expectedRate + Number.EPSILON)*8);
    const factor=table.rows[age-table.minAge]?.[eighth-table.minEighth];
    if(!Number.isFinite(factor)) throw Error('The official HUD table entry is unavailable.');
    return {factor,lookupRate:eighth/8,tableVersion:table.version};
  }
  function refinanceAvailability(principalLimit, mandatoryObligations) {
    if(!Number.isFinite(principalLimit) || !Number.isFinite(mandatoryObligations) || principalLimit<0 || mandatoryObligations<0) throw Error('Invalid obligations.');
    const netAvailable=Math.round(principalLimit-mandatoryObligations);
    const disbursementLimit=Math.round(Math.min(principalLimit,Math.max(principalLimit*.6,mandatoryObligations+principalLimit*.1)));
    return {netAvailable,disbursementLimit,firstYearCash:Math.max(0,Math.min(netAvailable,Math.round(disbursementLimit-mandatoryObligations))),shortage:Math.max(0,-netAvailable)};
  }
  function calculateEstimate({age,value,oneYear,tenYear,margin,payoff=0,fees=0,repairs=0,repairFee=0,mode='standard'}) {
    for(const amount of [value,oneYear,tenYear,margin,payoff,fees,repairs,repairFee]) if(!Number.isFinite(amount)||amount<0) throw Error('Enter valid, nonnegative amounts.');
    if(value<=0 || oneYear<=0 || tenYear<=0 || margin>10 || oneYear>20 || tenYear>20) throw Error('Inputs are outside the supported estimate range.');
    if(!['standard','h4p'].includes(mode)) throw Error('Unsupported calculator mode.');
    if(mode==='h4p' && (repairs>0 || repairFee>0)) throw Error('Purchase repair set-asides are not supported. Required repairs must be resolved before closing.');
    if((repairs===0 && repairFee!==0)||repairFee>Math.max(50,repairs*.015)) throw Error('Repair administration fee exceeds the permitted estimate bound or has no associated repairs.');
    const initialRate=Number((oneYear+margin).toFixed(3));
    const expectedRate=Number((tenYear+margin).toFixed(3));
    const lookup=lookupPlf(age,expectedRate);
    const maxClaimAmount=Math.round(Math.min(value,1209750)); // Existing configured cap; separate annual policy update.
    const principalLimit=Math.round(maxClaimAmount*lookup.factor);
    const ufmip=Math.round(maxClaimAmount*.02);
    const originationFee=Math.round(Math.min(6000,Math.max(2500,Math.min(maxClaimAmount,200000)*.02+Math.max(0,maxClaimAmount-200000)*.01)));
    const repairReserve=Math.round(repairs*1.5);
    const closingCosts=Math.round(ufmip+originationFee+fees+repairFee);
    const mandatoryObligations=Math.round(payoff+closingCosts+repairReserve);
    return {initialRate,expectedRate,...lookup,maxClaimAmount,principalLimit,ufmip,originationFee,repairReserve,repairFee,closingCosts,mandatoryObligations,
      ...refinanceAvailability(principalLimit,mandatoryObligations),
      // Preserve the existing purchase formula in this scoped refinance correction.
      requiredInvestment:Math.round(Math.max(0,value-principalLimit+ufmip+originationFee))};
  }
  return {lookupPlf,refinanceAvailability,calculateEstimate,tableSource:table?.source,tableVersion:table?.version};
});
