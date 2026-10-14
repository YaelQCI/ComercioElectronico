import test from'node:test'
import assert from'node:assert/strict'
import{randomUUID}from'node:crypto'
import{PrismaClient}from'../../generated/prisma/client.ts'
import{PrismaPg}from'@prisma/adapter-pg'
import{paymentFixture,fakeStripe}from'./payment-fixture.mjs'
import{createOrderPayments}from'../../server/features/payments/order-payments.js'
import{cancelConfirmedOrder}from'../../server/features/payments/cancel-confirmed-order.js'
import{submitStripeRefund}from'../../server/features/payments/stripe-refunds.js'
import{createOrders}from'../../server/features/orders/order-repository.js'
const url=process.env.TEST_DATABASE_URL
if(!url||!new URL(url).pathname.startsWith('/fitness_migration_test'))throw Error('Usar base aislada.')
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url,options:'-c timezone=UTC'})})
test.after(()=>db.$disconnect())
async function paid(f){const stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping);await payments.start(f.prepared.orderId,f.identity,f.total);const a=await db.paymentAttempt.findFirst({where:{orderId:f.prepared.orderId}});stripe.paid(a.providerSessionId);await payments.reconcile(a.id);return stripe}
test('cancelación concurrente restaura una vez, reserva reembolso total y conserva pago hasta liquidación',async()=>{
  const f=await paymentFixture(db),stripe=await paid(f),input={reason:'Cancelación sintética',idempotencyKey:randomUUID()}
  await assert.rejects(cancelConfirmedOrder(db,randomUUID(),f.prepared.orderId,input))
  const results=await Promise.all([1,2].map(()=>cancelConfirmedOrder(db,f.admin.id,f.prepared.orderId,input)))
  assert.equal(results.filter(r=>!r.repeated).length,1)
  const order=await db.order.findUnique({where:{id:f.prepared.orderId}}),refund=await db.refund.findUnique({where:{id:results[0].refundId}})
  assert.equal(order.status,'CANCELED');assert.equal(order.moneyStatus,'PAID')
  assert.equal(refund.requestedMoneyCents,BigInt(f.total));assert.equal(refund.shippingRefundCents,500n)
  assert.equal((await db.inventoryLot.findUnique({where:{id:f.lot.id}})).onHandQty,5)
  assert.equal(await db.inventoryMovement.count({where:{kind:'RETURN_SELLABLE',orderUnit:{orderId:order.id}}}),2)
  await submitStripeRefund(db,stripe,f.admin.id,refund.id)
  assert.equal((await db.order.findUnique({where:{id:order.id}})).moneyStatus,'REFUNDED')
  await assert.rejects(cancelConfirmedOrder(db,f.admin.id,order.id,{...input,reason:'Otro motivo'}),e=>e.status===409)
})
test('cancelar contra marcar enviado permite una sola transición y lote bloqueado se registra no vendible',async()=>{
  const f=await paymentFixture(db);await paid(f)
  const orders=createOrders(db);await orders.advance(f.admin.id,f.prepared.orderId,{status:'PREPARING',expectedStatus:'CONFIRMED',reason:'Fixture',idempotencyKey:randomUUID()})
  const results=await Promise.allSettled([cancelConfirmedOrder(db,f.admin.id,f.prepared.orderId,{reason:'Fixture',idempotencyKey:randomUUID()}),orders.advance(f.admin.id,f.prepared.orderId,{status:'SHIPPED',expectedStatus:'PREPARING',reason:'Fixture',idempotencyKey:randomUUID()})])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  const blocked=await paymentFixture(db);await paid(blocked);await db.inventoryLot.update({where:{id:blocked.lot.id},data:{isBlocked:true}})
  await cancelConfirmedOrder(db,blocked.admin.id,blocked.prepared.orderId,{reason:'Fixture',idempotencyKey:randomUUID()})
  const lot=await db.inventoryLot.findUnique({where:{id:blocked.lot.id}});assert.equal(lot.onHandQty,3);assert.equal(lot.nonSellableQty,2)
})
test('pedido pagado solo con puntos revierte canje sin crear reembolso Stripe ficticio',async()=>{
  const f=await paymentFixture(db,{priceCents:'100',shippingCents:'0'}),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  await db.$transaction(async tx=>{
    const units=await tx.orderUnit.findMany({where:{orderId:f.prepared.orderId}})
    for(const u of units)await tx.orderUnit.update({where:{id:u.id},data:{pointsTenths:u.netGoodsCents,moneyCents:0n}})
    await tx.order.update({where:{id:f.prepared.orderId},data:{userId:f.admin.id,pointsAppliedTenths:200n,goodsMoneyCents:0n,totalMoneyCents:0n}})
    const a=await tx.loyaltyAccount.create({data:{userId:f.admin.id}})
    await tx.loyaltyLedgerEntry.create({data:{accountId:a.id,kind:'ADJUSTMENT',deltaTenths:200n,balanceAfterTenths:200n,actorId:f.admin.id,reason:'Fixture',idempotencyKey:randomUUID()}})
  })
  await payments.start(f.prepared.orderId,{userId:f.admin.id},'0')
  const result=await cancelConfirmedOrder(db,f.admin.id,f.prepared.orderId,{reason:'Fixture',idempotencyKey:randomUUID()})
  await submitStripeRefund(db,stripe,f.admin.id,result.refundId)
  const a=await db.loyaltyAccount.findUnique({where:{userId:f.admin.id}});assert.equal(a.balanceTenths,200n)
  assert.equal(stripe.sessions.size,0);assert.equal((await db.refund.findUnique({where:{id:result.refundId}})).providerRefundId,null)
  assert.equal((await db.order.findUnique({where:{id:f.prepared.orderId}})).moneyStatus,'NOT_REQUIRED')
})
