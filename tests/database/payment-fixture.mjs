import{randomUUID,randomBytes}from'node:crypto'
import{deliveredFixture}from'./order-fixture.mjs'
import{createCartRepository}from'../../server/features/cart/cart-repository.js'
import{createShippingQuotes}from'../../server/features/shipping/shipping-quotes.js'
import{createCheckout}from'../../server/features/checkout/prepare-order.js'
import{createStoreAdministration}from'../../server/features/administration/manage-store.js'
export async function paymentFixture(db,{priceCents='1000',shippingCents='500',coupon=false}={}){
  const email=`${randomUUID()}@example.invalid`,admin=await db.user.create({data:{email,emailNormalized:email,passwordHash:'fixture',displayName:'Fixture',role:'ADMIN'}}),f=await deliveredFixture(db,admin.id)
  await db.productVariant.update({where:{id:f.variant.id},data:{priceCents:BigInt(priceCents)}})
  await createStoreAdministration(db).adjustStock(admin.id,{lotId:f.lot.id,delta:5,reason:'Fixture',idempotencyKey:randomUUID()})
  for(const slug of['privacidad','terminos','devoluciones'])await db.contentPage.upsert({where:{slug},create:{slug,title:'Fixture',content:'Solo pruebas',publishedAt:new Date(),updatedById:admin.id},update:{publishedAt:new Date(),updatedById:admin.id}})
  const warehouse=await db.warehouse.findFirst();await db.warehouse.update({where:{id:warehouse.id},data:{state:'CX'}})
  await db.packageType.create({data:{code:`FIXTURE-${randomUUID()}`,innerLengthMm:300,innerWidthMm:300,innerHeightMm:300,outerLengthMm:310,outerWidthMm:310,outerHeightMm:310,tareWeightGrams:100,maxGrossWeightGrams:3000}})
  const owner=randomBytes(32).toString('hex'),cartService=createCartRepository(db)
  let cart=await cartService.add(owner,{variantId:f.variant.id,quantity:2,version:1})
  if(coupon){const code=`FIXTURE-${randomUUID()}`.toUpperCase();await db.coupon.create({data:{code,codeNormalized:code.toLowerCase(),kind:'FIXED',fixedAmountCents:500n,maxUses:1,maxUsesPerCustomer:1}});cart=await cartService.coupon(owner,{code,version:cart.version})}
  const destination={country:'MX',name:'Fixture',phone:'5555555555',street:'Calle sintética 1',city:'Ciudad sintética',state:'CX',postalCode:'01234'}
  const rate={carrierCode:'fixture',serviceCode:'ground',serviceName:'Fixture',quotedAmountCents:shippingCents,currency:'MXN',deliveryEstimate:'Fixture'}
  const shipping={quote:async()=>[rate]},quotes=createShippingQuotes(db,shipping)
  const quoted=await quotes.quote(owner,destination),selected=await quotes.select(owner,quoted.quotes[0].id,destination)
  const total=(BigInt(cart.totals.goodsAfterCouponCents)+BigInt(selected.chargedAmountCents)).toString()
  const checkout=createCheckout(db,randomBytes(32).toString('base64'))
  const prepared=await checkout.prepare(owner,null,{email,address:{recipientName:destination.name,phone:destination.phone,street:destination.street,exteriorNumber:'1',city:destination.city,state:destination.state,postalCode:destination.postalCode,district:'Fixture'},accepted:true,cartVersion:cart.version,quoteId:selected.id,expectedTotalCents:total,idempotencyKey:randomUUID()})
  return{...f,admin,owner,prepared,cartService,shipping,rate,total,identity:{guestHash:owner,guestToken:prepared.guestToken}}
}
export function fakeStripe(){
  const sessions=new Map(),keys=new Map();let unavailable=false
  return{sessions,keys,origin:'http://localhost:3000',setUnavailable:value=>{unavailable=value},
    async createSession(input){if(unavailable)throw Error('Proveedor ausente');if(keys.has(input.idempotencyKey))return{...sessions.get(keys.get(input.idempotencyKey))};const id=`cs_test_${input.attemptId.replaceAll('-','')}`,s={id,orderId:input.orderId,attemptId:input.attemptId,amountCents:input.amountCents,currency:'MXN',status:'open',paymentStatus:'unpaid',paymentIntentId:null,expiresAt:new Date(input.expiresAtSeconds*1000),url:`https://checkout.stripe.com/c/pay/${id}`};keys.set(input.idempotencyKey,id);sessions.set(id,s);return{...s}},
    async session(id){if(unavailable)throw Error('Proveedor ausente');if(!sessions.has(id))throw Error('Sesión desconocida');return{...sessions.get(id)}},
    async expire(id){if(unavailable)throw Error('Proveedor ausente');const s=sessions.get(id);if(s.paymentStatus==='paid')throw Error('Pagado');s.status='expired';s.url=null;return{...s}},
    paid(id){const s=sessions.get(id);s.status='complete';s.paymentStatus='paid';s.paymentIntentId=`pi_${s.attemptId.replaceAll('-','')}`;s.url=null},
    async refund(input){return{id:`re_${input.idempotencyKey.replaceAll(':','_')}`,status:'succeeded',amountCents:input.amountCents,currency:'MXN'}},
  }
}
