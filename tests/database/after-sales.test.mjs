import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { paymentFixture,fakeStripe } from './payment-fixture.mjs'
import { createOrderPayments } from '../../server/features/payments/order-payments.js'
import { submitStripeRefund } from '../../server/features/payments/stripe-refunds.js'
import { createOrders } from '../../server/features/orders/order-repository.js'
import { createAfterSales } from '../../server/features/after-sales/claims.js'
const url=process.env.TEST_DATABASE_URL
if(!url||!new URL(url).pathname.startsWith('/fitness_migration_test'))throw Error('Usar base aislada.')
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url,options:'-c timezone=UTC'})})
test.after(()=>db.$disconnect())
const evidence=[{url:'https://example.com/evidencia-prueba',description:'Evidencia sintética'}]
async function fixture(){
  const f=await paymentFixture(db),stripe=fakeStripe(),payments=createOrderPayments(db,stripe,f.shipping)
  await payments.start(f.prepared.orderId,f.identity,f.total)
  const attempt=await db.paymentAttempt.findFirst({where:{orderId:f.prepared.orderId}})
  stripe.paid(attempt.providerSessionId);await payments.reconcile(attempt.id)
  const orders=createOrders(db)
  for(const [expectedStatus,status] of [['CONFIRMED','PREPARING'],['PREPARING','SHIPPED'],['SHIPPED','DELIVERED']])await orders.advance(f.admin.id,f.prepared.orderId,{status,expectedStatus,reason:'Prueba',idempotencyKey:randomUUID()})
  return{...f,stripe,service:createAfterSales(db),units:await db.orderUnit.findMany({where:{orderId:f.prepared.orderId},orderBy:{id:'asc'}})}
}
test('Price Match reserva diferencia; devolución parcial descuenta ajuste y envío se reintegra una sola vez al devolver todo por fallo de tienda',async()=>{
  const f=await fixture(),id=f.prepared.orderId,s=f.service,u=f.units[0]
  await assert.rejects(s.list(id,{guestToken:'a'.repeat(64)}),e=>e.status===404)
  const input={idempotencyKey:randomUUID(),description:'Prueba de comparación',unitIds:[u.id],evidence,comparison:[{unitId:u.id,itemCents:'700',shippingCents:'100'}]}
  const match=await s.request(id,f.identity,'PRICE_MATCH',input)
  assert.equal((await s.request(id,f.identity,'PRICE_MATCH',input)).repeated,true)
  const approved=await s.review(f.admin.id,'PRICE_MATCH',match.id,{decision:'APPROVE',reason:'Comparación verificada sintética',sameVariant:true,includesMexicoShipping:true})
  assert.equal((await db.refund.findUnique({where:{id:approved.refundId}})).requestedMoneyCents,200n)
  await assert.rejects(s.resolve(f.admin.id,'PRICE_MATCH',match.id,{reason:'Prueba'}),e=>e.status===409)
  await submitStripeRefund(db,f.stripe,f.admin.id,approved.refundId)
  await s.resolve(f.admin.id,'PRICE_MATCH',match.id,{reason:'Reintegro confirmado'})
  let total=200n
  for(const unit of f.units){
    const request=await s.request(id,f.identity,'RETURN',{idempotencyKey:randomUUID(),description:'Incidencia sintética',unitIds:[unit.id],evidence,reason:'DAMAGED_ON_RECEIPT',condition:'DAMAGED'})
    await s.review(f.admin.id,'RETURN',request.id,{decision:'APPROVE',reason:'Daño confirmado sintético',storeFault:true})
    const detail=await s.inspect(f.admin.id,'RETURN',request.id)
    const received=await s.receive(f.admin.id,request.id,{inspections:detail.items.map(i=>({itemId:i.id,condition:'DAMAGED',disposition:'NON_SELLABLE',notes:'Inspección sintética'}))})
    await assert.rejects(s.receive(f.admin.id,request.id,{inspections:[]}),e=>e.status===409)
    total+=(await db.refund.findUnique({where:{id:received.refundId}})).requestedMoneyCents
    await submitStripeRefund(db,f.stripe,f.admin.id,received.refundId)
    await s.resolve(f.admin.id,'RETURN',request.id,{reason:'Reembolso liquidado'})
  }
  assert.equal(total,BigInt(f.total))
  assert.equal(await db.inventoryMovement.count({where:{kind:'RETURN_NON_SELLABLE',orderUnit:{orderId:id}}}),2)
  assert.equal((await db.inventoryLot.findUnique({where:{id:f.lot.id}})).nonSellableQty,2)
})
test('voluntaria abierta se rechaza; recepción requiere aprobación y administradores; sello intacto no reintegra envío',async()=>{
  const f=await fixture(),id=f.prepared.orderId,u=f.units[0],s=f.service,input={idempotencyKey:randomUUID(),description:'Solicitud sintética',unitIds:[u.id],evidence,reason:'VOLUNTARY',condition:'SEALED'}
  await assert.rejects(s.request(id,f.identity,'RETURN',{...input,condition:'OPENED'}),e=>e.status===409)
  const r=await s.request(id,f.identity,'RETURN',input)
  await assert.rejects(s.receive(f.admin.id,r.id,{inspections:[]}),e=>e.status===409)
  await assert.rejects(s.review(randomUUID(),'RETURN',r.id,{decision:'APPROVE',reason:'Prueba',storeFault:false}))
  await s.review(f.admin.id,'RETURN',r.id,{decision:'APPROVE',reason:'Prueba',storeFault:false})
  const detail=await s.inspect(f.admin.id,'RETURN',r.id),received=await s.receive(f.admin.id,r.id,{inspections:detail.items.map(i=>({itemId:i.id,condition:'SEALED',disposition:'SELLABLE',notes:'Sello verificado sintético'}))})
  const refund=await db.refund.findUnique({where:{id:received.refundId}})
  assert.equal(refund.requestedMoneyCents,1000n);assert.equal(refund.shippingRefundCents,0n)
  assert.equal(await db.inventoryMovement.count({where:{kind:'RETURN_SELLABLE',orderUnitId:u.id}}),1)
})
