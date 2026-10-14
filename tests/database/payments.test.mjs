import test from'node:test'
import assert from'node:assert/strict'
import{randomUUID,createHmac}from'node:crypto'
import{PrismaClient}from'../../generated/prisma/client.ts'
import{PrismaPg}from'@prisma/adapter-pg'
import{createOrderPayments}from'../../server/features/payments/order-payments.js'
import{receiveStripeEvent}from'../../server/features/payments/stripe-events.js'
import{submitStripeRefund}from'../../server/features/payments/stripe-refunds.js'
import{paymentFixture,fakeStripe}from'./payment-fixture.mjs'
import{createOrders}from'../../server/features/orders/order-repository.js'
const url=process.env.TEST_DATABASE_URL
if(!url||!new URL(url).pathname.startsWith('/fitness_migration_test'))throw Error('Base aislada requerida.')
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url,options:'-c timezone=UTC'})})
test.after(()=>db.$disconnect())
const request=(s,id=`evt_${randomUUID().replaceAll('-','')}`,type='checkout.session.completed')=>{
  const secret='whsec_fixture_secret',time=Math.floor(Date.now()/1000),raw=Buffer.from(JSON.stringify({id,type,created:time,livemode:false,data:{object:{id:s.id,metadata:{orderId:s.orderId,attemptId:s.attemptId},payment_status:s.paymentStatus,amount_total:Number(s.amountCents),currency:'mxn',customer_details:{email:'must-not-be-stored@example.invalid'}}}}))
  return{raw,signature:`t=${time},v1=${createHmac('sha256',secret).update(`${time}.`).update(raw).digest('hex')}`,secret,environment:'test'}
}
test('dos inicios, propiedad, webhook duplicado y compra atómica conservan añadidos posteriores',async()=>{
  const f=await paymentFixture(db,{coupon:true}),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  await assert.rejects(payments.start(f.prepared.orderId,{guestHash:'0'.repeat(64)},f.total),e=>e.status===404)
  const results=await Promise.all([1,2].map(()=>payments.start(f.prepared.orderId,f.identity,f.total)))
  assert.equal(results[0].url,results[1].url);assert.equal(stripe.sessions.size,1)
  const attempt=await db.paymentAttempt.findFirst({where:{orderId:f.prepared.orderId}})
  assert.equal(await db.reservationSet.count({where:{orderId:f.prepared.orderId}}),1)
  assert.equal((await db.inventoryLot.findUnique({where:{id:f.lot.id}})).reservedQty,2)
  let cart=await f.cartService.read(f.owner);await f.cartService.add(f.owner,{variantId:f.variant.id,quantity:1,version:cart.version})
  stripe.paid(attempt.providerSessionId)
  const body=request(stripe.sessions.get(attempt.providerSessionId))
  await Promise.all([1,2].map(()=>receiveStripeEvent(db,payments,body)))
  const status=await payments.status(f.prepared.orderId,f.identity)
  assert.equal(status.status,'CONFIRMED');assert.equal(status.moneyStatus,'PAID')
  const lot=await db.inventoryLot.findUnique({where:{id:f.lot.id}});assert.equal(lot.onHandQty,3);assert.equal(lot.reservedQty,0)
  assert.equal((await f.cartService.read(f.owner)).pieces,1)
  assert.equal(await db.inventoryMovement.count({where:{kind:'SALE',orderUnit:{orderId:f.prepared.orderId}}}),2)
  assert.equal((await db.couponUsage.findFirst({where:{orderId:f.prepared.orderId}})).state,'CONSUMED')
  const event=await db.providerEvent.findFirst({where:{externalEventId:JSON.parse(body.raw).id}});assert.ok(!JSON.stringify(event.safePayload).includes('must-not-be-stored'))
  await payments.reconcile(attempt.id);assert.equal((await db.order.findUnique({where:{id:f.prepared.orderId}})).status,'CONFIRMED')
})
test('cancelar cierra y reconcilia antes de liberar; reintento obtiene otra reserva y sesión',async()=>{
  const f=await paymentFixture(db),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  await payments.start(f.prepared.orderId,f.identity,f.total)
  await payments.cancel(f.prepared.orderId,f.identity)
  assert.equal((await db.inventoryLot.findUnique({where:{id:f.lot.id}})).reservedQty,0)
  assert.equal((await payments.status(f.prepared.orderId,f.identity)).moneyStatus,'FAILED')
  await payments.start(f.prepared.orderId,f.identity,f.total)
  assert.equal(stripe.sessions.size,2)
  assert.equal(await db.reservationSet.count({where:{orderId:f.prepared.orderId,state:'ACTIVE'}}),1)
})
test('proveedor incierto retiene recursos y mismo intento se recupera con la misma clave',async()=>{
  const f=await paymentFixture(db),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  stripe.setUnavailable(true);await assert.rejects(payments.start(f.prepared.orderId,f.identity,f.total))
  assert.equal((await db.inventoryLot.findUnique({where:{id:f.lot.id}})).reservedQty,2)
  assert.equal((await payments.status(f.prepared.orderId,f.identity)).moneyStatus,'RECONCILING')
  stripe.setUnavailable(false);await payments.start(f.prepared.orderId,f.identity,f.total)
  assert.equal(await db.paymentAttempt.count({where:{orderId:f.prepared.orderId}}),1);assert.equal(stripe.sessions.size,1)
})
test('importe alterado, tarifa cambiada y mínimo no reservan; total cero confirma sin Stripe',async()=>{
  const f=await paymentFixture(db),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  await assert.rejects(payments.start(f.prepared.orderId,f.identity,'1'),e=>e.status===409)
  f.rate.quotedAmountCents='600';await assert.rejects(payments.start(f.prepared.orderId,f.identity,f.total),e=>e.status===409)
  assert.equal(await db.reservationSet.count({where:{orderId:f.prepared.orderId}}),0)
  const small=await paymentFixture(db,{priceCents:'1',shippingCents:'0'}),p=createOrderPayments(db,stripe,small.shipping)
  await assert.rejects(p.start(small.prepared.orderId,small.identity,small.total),e=>e.status===409)
  const zero=await paymentFixture(db,{priceCents:'0',shippingCents:'0'}),z=createOrderPayments(db,stripe,zero.shipping)
  assert.equal((await z.start(zero.prepared.orderId,zero.identity,'0')).confirmed,true)
  assert.equal((await z.status(zero.prepared.orderId,zero.identity)).moneyStatus,'NOT_REQUIRED')
  assert.equal(await db.paymentAttempt.count({where:{orderId:zero.prepared.orderId}}),0)
})
test('reembolso autorizado toma importe persistido, sincroniza dinero e idempotencia',async()=>{
  const f=await paymentFixture(db),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  await payments.start(f.prepared.orderId,f.identity,f.total)
  const a=await db.paymentAttempt.findFirst({where:{orderId:f.prepared.orderId}});stripe.paid(a.providerSessionId);await payments.reconcile(a.id)
  await db.$transaction(async tx=>{await tx.orderStatusHistory.create({data:{orderId:f.prepared.orderId,fromStatus:'CONFIRMED',toStatus:'CANCELED',actorType:'SYSTEM',reason:'Cancelación sintética aprobada',eventKey:randomUUID()}});await tx.order.update({where:{id:f.prepared.orderId},data:{status:'CANCELED',canceledAt:new Date()}})})
  const unit=await db.orderUnit.findFirst({where:{orderId:f.prepared.orderId}})
  const refund=await db.$transaction(async tx=>{const r=await tx.refund.create({data:{orderId:f.prepared.orderId,paymentAttemptId:a.id,kind:'CANCELLATION',requestedMoneyCents:unit.moneyCents,requestedPointsTenths:0n,shippingRefundCents:0n,idempotencyKey:`refund:${randomUUID()}`}});await tx.refundAllocation.create({data:{refundId:r.id,orderId:f.prepared.orderId,orderUnitId:unit.id,kind:'UNIT',moneyCents:unit.moneyCents,pointsTenths:0n,benefitReductionCents:unit.moneyCents}});return r})
  await assert.rejects(submitStripeRefund(db,stripe,randomUUID(),refund.id))
  await submitStripeRefund(db,stripe,f.admin.id,refund.id);await submitStripeRefund(db,stripe,f.admin.id,refund.id)
  assert.equal((await db.refund.findUnique({where:{id:refund.id}})).status,'SETTLED')
  assert.equal((await payments.status(f.prepared.orderId,f.identity)).moneyStatus,'PARTIALLY_REFUNDED')
})
test('canje se consume con pago y reembolso restituye reparto original/revierte ganancia una vez',async()=>{
  const f=await paymentFixture(db,{priceCents:'1500'}),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  await db.$transaction(async tx=>{
    const unit=await tx.orderUnit.findFirst({where:{orderId:f.prepared.orderId}})
    await tx.orderUnit.update({where:{id:unit.id},data:{pointsTenths:100n,moneyCents:unit.moneyCents-100n}})
    await tx.order.update({where:{id:f.prepared.orderId},data:{userId:f.admin.id,pointsAppliedTenths:100n,goodsMoneyCents:2900n,totalMoneyCents:3400n}})
    const account=await tx.loyaltyAccount.create({data:{userId:f.admin.id}})
    await tx.loyaltyLedgerEntry.create({data:{accountId:account.id,kind:'ADJUSTMENT',deltaTenths:100n,balanceAfterTenths:100n,actorId:f.admin.id,reason:'Saldo sintético de prueba',idempotencyKey:randomUUID()}})
  })
  const identity={userId:f.admin.id};await payments.start(f.prepared.orderId,identity,'3400')
  assert.equal((await db.loyaltyAccount.findUnique({where:{userId:f.admin.id}})).reservedTenths,100n)
  const a=await db.paymentAttempt.findFirst({where:{orderId:f.prepared.orderId}});stripe.paid(a.providerSessionId);await payments.reconcile(a.id)
  assert.equal((await db.loyaltyAccount.findUnique({where:{userId:f.admin.id}})).balanceTenths,0n)
  const orders=createOrders(db);let from='CONFIRMED'
  for(const status of['PREPARING','SHIPPED','DELIVERED']){await orders.advance(f.admin.id,f.prepared.orderId,{status,expectedStatus:from,reason:'Fixture',idempotencyKey:randomUUID()});from=status}
  assert.equal((await db.loyaltyAccount.findUnique({where:{userId:f.admin.id}})).balanceTenths,20n)
  const unit=await db.orderUnit.findFirst({where:{orderId:f.prepared.orderId,pointsTenths:100n}})
  const refund=await db.$transaction(async tx=>{
    const request=await tx.priceMatchRequest.create({data:{orderId:f.prepared.orderId,requestedByUserId:f.admin.id,status:'APPROVED',reviewedById:f.admin.id,reviewedAt:new Date(),decisionReason:'Fixture',comparisonSnapshot:{fixture:true}}})
    const r=await tx.refund.create({data:{orderId:f.prepared.orderId,paymentAttemptId:a.id,priceMatchRequestId:request.id,kind:'PRICE_MATCH',requestedMoneyCents:unit.moneyCents,requestedPointsTenths:unit.pointsTenths,shippingRefundCents:0n,idempotencyKey:`refund:${randomUUID()}`}})
    await tx.refundAllocation.create({data:{refundId:r.id,orderId:f.prepared.orderId,orderUnitId:unit.id,kind:'UNIT',moneyCents:unit.moneyCents,pointsTenths:unit.pointsTenths,benefitReductionCents:unit.netGoodsCents}});return r
  })
  await submitStripeRefund(db,stripe,f.admin.id,refund.id);await submitStripeRefund(db,stripe,f.admin.id,refund.id)
  assert.equal((await db.loyaltyAccount.findUnique({where:{userId:f.admin.id}})).balanceTenths,110n)
  assert.equal(await db.loyaltyLedgerEntry.count({where:{refundId:refund.id,kind:'RESTORE'}}),1)
  assert.equal(await db.loyaltyLedgerEntry.count({where:{refundId:refund.id,kind:'REVERSE'}}),1)
})
test('sesión expirada libera; cobro no aplicado compensa su propio saldo sin tocar compra legítima',async()=>{
  const f=await paymentFixture(db),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  await payments.start(f.prepared.orderId,f.identity,f.total)
  const old=await db.paymentAttempt.findFirst({where:{orderId:f.prepared.orderId}})
  const session=stripe.sessions.get(old.providerSessionId);session.status='expired';session.url=null
  await payments.sweep()
  assert.equal((await db.reservationSet.findUnique({where:{id:old.reservationSetId}})).state,'RELEASED')
  await payments.start(f.prepared.orderId,f.identity,f.total)
  const fresh=await db.paymentAttempt.findFirst({where:{orderId:f.prepared.orderId,id:{not:old.id}}})
  stripe.paid(fresh.providerSessionId);await payments.reconcile(fresh.id)
  stripe.paid(old.providerSessionId);await assert.rejects(payments.reconcile(old.id))
  const compensation=await db.refund.findFirst({where:{paymentAttemptId:old.id,kind:'COMPENSATION'}})
  assert.equal(compensation.requestedMoneyCents,BigInt(f.total));assert.equal(compensation.requestedPointsTenths,0n)
  assert.equal(await db.refundAllocation.count({where:{refundId:compensation.id}}),0)
  await submitStripeRefund(db,stripe,f.admin.id,compensation.id)
  assert.equal((await payments.status(f.prepared.orderId,f.identity)).moneyStatus,'PAID')
  assert.equal((await db.paymentAttempt.findUnique({where:{id:fresh.id}})).appliedToOrder,true)
  assert.equal((await db.inventoryLot.findUnique({where:{id:f.lot.id}})).onHandQty,3)
})
test('respuesta de importe alterado y evento inválido no confirman; tarjeta rechazada conserva reintento',async()=>{
  const f=await paymentFixture(db),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  await payments.start(f.prepared.orderId,f.identity,f.total)
  const a=await db.paymentAttempt.findFirst({where:{orderId:f.prepared.orderId}}),s=stripe.sessions.get(a.providerSessionId)
  s.paymentIntentId=`pi_${a.id.replaceAll('-','')}`
  await payments.reconcile(a.id,{failedPaymentIntentId:s.paymentIntentId})
  assert.equal((await payments.status(f.prepared.orderId,f.identity)).cardRejected,true)
  const body=request(s);await assert.rejects(receiveStripeEvent(db,payments,{...body,signature:'t=1,v1=invalid'}))
  stripe.paid(s.id);s.amountCents='9999';await assert.rejects(payments.reconcile(a.id))
  assert.equal((await payments.status(f.prepared.orderId,f.identity)).moneyStatus,'RECONCILING')
  assert.equal((await db.inventoryLot.findUnique({where:{id:f.lot.id}})).reservedQty,2)
  assert.equal((await db.order.findUnique({where:{id:f.prepared.orderId}})).confirmedAt,null)
})
