import { money,allocateCents } from '../pricing/prices.js'
export function refundRemaining(unit,committed=[]) {
  const originalMoney=money(unit.moneyCents),originalPoints=money(unit.pointsTenths)
  const cash=originalMoney-committed.reduce((s,a)=>s+money(a.moneyCents),0n),points=originalPoints-committed.reduce((s,a)=>s+money(a.pointsTenths),0n)
  if(cash<0n||points<0n)throw new RangeError('Reembolsos exceden el reparto original.')
  return{moneyCents:cash.toString(),pointsTenths:points.toString(),totalCents:(cash+points).toString()}
}
export function proportionalRefund(unit,reductionCents,committed=[]) {
  const reduction=money(reductionCents),remaining=refundRemaining(unit,committed)
  if(reduction>money(remaining.totalCents))throw new RangeError('Reintegro excede importe remanente.')
  const parts=allocateCents(reduction,[{id:'money',weightCents:unit.moneyCents},{id:'points',weightCents:unit.pointsTenths}])
  let cash=money(parts[0].cents),points=money(parts[1].cents)
  if(cash>money(remaining.moneyCents)){points+=cash-money(remaining.moneyCents);cash=money(remaining.moneyCents)}
  if(points>money(remaining.pointsTenths)){cash+=points-money(remaining.pointsTenths);points=money(remaining.pointsTenths)}
  return{moneyCents:cash.toString(),pointsTenths:points.toString(),benefitReductionCents:reduction.toString()}
}
