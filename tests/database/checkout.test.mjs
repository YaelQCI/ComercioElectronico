import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID,randomBytes } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { deliveredFixture } from './order-fixture.mjs'
import { createCartRepository } from '../../server/features/cart/cart-repository.js'
import { createShippingQuotes } from '../../server/features/shipping/shipping-quotes.js'
import { createCheckout } from '../../server/features/checkout/prepare-order.js'
import { createStoreAdministration } from '../../server/features/administration/manage-store.js'
const url=process.env.TEST_DATABASE_URL
if(!url||!new URL(url).pathname.startsWith('/fitness_migration_test'))throw new Error('Base aislada requerida.')
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url})}),checkout=createCheckout(db,randomBytes(32).toString('base64'))
test.after(()=>db.$disconnect())
test('prepara snapshot sin cobro/reserva, idempotencia concurrente, total y acceso opaco',async()=>{
  const email=`${randomUUID()}@example.invalid`,admin=await db.user.create({data:{email,emailNormalized:email,passwordHash:'fixture',displayName:'Fixture',role:'ADMIN'}}),f=await deliveredFixture(db,admin.id)
  await db.productVariant.update({where:{id:f.variant.id},data:{priceCents:1000n}})
  await createStoreAdministration(db).adjustStock(admin.id,{lotId:f.lot.id,delta:3,reason:'Fixture',idempotencyKey:randomUUID()})
  for(const slug of ['privacidad','terminos','devoluciones'])await db.contentPage.upsert({where:{slug},create:{slug,title:'Fixture',content:'Solo pruebas, no política comercial',publishedAt:new Date(),updatedById:admin.id},update:{publishedAt:new Date(),updatedById:admin.id}})
  const warehouse=await db.warehouse.findFirst();await db.warehouse.update({where:{id:warehouse.id},data:{state:'CX'}})
  await db.packageType.create({data:{code:`FIXTURE-${randomUUID()}`,innerLengthMm:300,innerWidthMm:300,innerHeightMm:300,outerLengthMm:310,outerWidthMm:310,outerHeightMm:310,tareWeightGrams:100,maxGrossWeightGrams:3000}})
  const owner=randomBytes(32).toString('hex'),cartService=createCartRepository(db),cart=await cartService.add(owner,{variantId:f.variant.id,quantity:2,version:1})
  const destination={country:'MX',name:'Fixture',phone:'5555555555',street:'Calle sintética 1',city:'Ciudad sintética',state:'CX',postalCode:'01234'},shipping=createShippingQuotes(db,{quote:async()=>[{carrierCode:'fixture',serviceCode:'ground',serviceName:'Fixture',quotedAmountCents:'500',currency:'MXN',deliveryEstimate:'Fixture'}]})
  const quoted=await shipping.quote(owner,destination),selected=await shipping.select(owner,quoted.quotes[0].id,destination)
  const input={email,address:{recipientName:destination.name,phone:destination.phone,street:destination.street,exteriorNumber:'1',city:destination.city,state:destination.state,postalCode:destination.postalCode,district:'Fixture'},accepted:true,cartVersion:cart.version,quoteId:selected.id,expectedTotalCents:'2500',idempotencyKey:randomUUID()}
  const results=await Promise.all([1,2].map(()=>checkout.prepare(owner,null,input)))
  assert.equal(results[0].orderId,results[1].orderId);assert.equal(results[0].totalMoneyCents,'2500')
  const orderId=results[0].orderId
  assert.equal(await db.orderUnit.count({where:{orderId}}),2)
  assert.equal(await db.reservationSet.count({where:{orderId}}),0);assert.equal(await db.paymentAttempt.count({where:{orderId}}),0)
  assert.equal((await db.inventoryLot.findUnique({where:{id:f.lot.id}})).reservedQty,0)
  assert.equal((await cartService.read(owner)).pieces,2)
  assert.equal((await checkout.guestRead(results[0].guestToken)).number,results[0].number)
  await assert.rejects(checkout.guestRead(randomBytes(32).toString('hex')),e=>e.status===404)
  await assert.rejects(checkout.prepare(owner,null,{...input,email:'otro@example.invalid'}),e=>e.status===409)
  await assert.rejects(checkout.prepare(owner,null,{...input,idempotencyKey:randomUUID(),expectedTotalCents:'1'}),e=>e.status===409)
  assert.equal((await db.orderLine.findFirst({where:{orderId}})).lineAfterCouponCents,2000n)
})
