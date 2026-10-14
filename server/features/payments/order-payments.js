import { createHash } from 'node:crypto'
import { PaymentError, paymentId } from './stripe-client.js'
import { secretHash } from '../accounts/credentials.js'
import { withInventoryTransaction } from '../inventory/inventory-transaction.js'
import { reserveInventory, consumeInventory, releaseInventory } from '../inventory/inventory-reservations.js'
import { reserveCoupon, consumeCoupon, releaseCoupon } from '../coupons/coupon-reservations.js'
import { reservePoints, consumePoints, releasePoints } from '../loyalty/loyalty-repository.js'
import { checkoutCart } from '../cart/cart-repository.js'
import { prepareShipping } from '../shipping/shipping-quotes.js'
import { shippingProgress } from '../../../shared/features/shipping/shipping-policy.js'

const held = ['ACTIVE','RECONCILING']
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function authorize(tx,order,identity) {
  if(!order)throw new PaymentError(404,'Pedido no disponible.')
  if(identity?.userId&&order.userId===identity.userId)return
  if(!order.userId&&identity?.guestHash&&await tx.cart.findFirst({where:{id:order.sourceCartId,guestTokenHash:identity.guestHash,userId:null}}))return
  if(/^[a-f0-9]{64}$/.test(identity?.guestToken??'')&&await tx.actionToken.findFirst({where:{purpose:'GUEST_ORDER_ACCESS',orderId:order.id,tokenHash:secretHash(identity.guestToken),expiresAt:{gt:new Date()},consumedAt:null}}))return
  throw new PaymentError(404,'Pedido no disponible.')
}
async function lockOrder(tx,id) {
  paymentId(id);await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id}::uuid FOR UPDATE`
  return tx.order.findUnique({where:{id},include:{orderPackage_order:{include:{quote:true}},sourceCart:true}})
}
function dto(order,attempt,reservation) {
  return {orderId:order.id,number:order.orderNumber,status:order.status,moneyStatus:order.moneyStatus,totalMoneyCents:order.totalMoneyCents.toString(),currency:order.currency,paymentStatus:attempt?.status??null,cardRejected:attempt?.failureCode==='STRIPE_PAYMENT_FAILED',expiresAt:reservation?.expiresAt.toISOString()??null,needsReview:order.moneyStatus==='RECONCILING'}
}
async function removePurchasedCartItems(tx,order) {
  if(!order.sourceCartId)return
  await tx.$queryRaw`SELECT id FROM "Cart" WHERE id=${order.sourceCartId}::uuid FOR UPDATE`
  for(const source of order.policySnapshot.sourceLines??[]) {
    const current=await tx.cartItem.findFirst({where:{id:source.id,cartId:order.sourceCartId}})
    if(!current)continue
    if(current.quantity<=source.quantity)await tx.cartItem.delete({where:{id:current.id}})
    else await tx.cartItem.update({where:{id:current.id},data:{quantity:current.quantity-source.quantity}})
  }
  await tx.cart.update({where:{id:order.sourceCartId},data:{version:{increment:1}}})
  await tx.shippingQuote.updateMany({where:{cartId:order.sourceCartId,status:{in:['AVAILABLE','ACCEPTED']}},data:{status:'INVALIDATED'}})
}
async function confirm(context,order,attempt,reservation) {
  const tx=context.tx
  if(order.confirmedAt)return
  if(attempt)await tx.paymentAttempt.update({where:{id:attempt.id},data:{appliedToOrder:true}})
  await consumeCoupon(context,reservation.id)
  await consumePoints(context,reservation.id)
  await consumeInventory(context,reservation.id)
  await tx.orderStatusHistory.create({data:{orderId:order.id,fromStatus:'PENDING_PAYMENT',toStatus:'CONFIRMED',actorType:'SYSTEM',reason:'Pago verificado o total cero confirmado',eventKey:`confirm:${order.id}`}})
  await tx.order.update({where:{id:order.id},data:{status:'CONFIRMED',moneyStatus:attempt?'PAID':'NOT_REQUIRED',confirmedAt:new Date()}})
  await removePurchasedCartItems(tx,order)
}
export function createOrderPayments(db,stripe,shipping,{minimumCents='1000'}={}) {
  if(!/^[1-9]\d{0,11}$/.test(minimumCents))throw new PaymentError(503,'Mínimo Stripe inválido.')
  async function latest(tx,orderId){return tx.reservationSet.findFirst({where:{orderId},orderBy:{attemptNumber:'desc'},include:{paymentAttempt_reservationSet:true}})}
  async function markUncertain(attemptId,session=null,paidAt=null) {
    const a=await db.paymentAttempt.findUnique({where:{id:attemptId}})
    if(!a)return
    await withInventoryTransaction(db,async({tx})=>{
      const order=await lockOrder(tx,a.orderId),r=await tx.reservationSet.findUnique({where:{id:a.reservationSetId}})
      const current=await tx.paymentAttempt.findUnique({where:{id:attemptId}})
      if(current.appliedToOrder)return
      const proof=session?.attemptId===attemptId&&session.orderId===order.id&&session.paymentStatus==='paid'&&session.paymentIntentId&&session.amountCents===current.amountCents.toString()&&session.currency==='MXN'
      await tx.paymentAttempt.update({where:{id:attemptId},data:{status:proof?'SUCCEEDED':'RECONCILING',failureCode:'PROVIDER_UNCERTAIN',lastReconciledAt:new Date(),...(proof?{providerPaymentIntentId:session.paymentIntentId,providerPaidAt:paidAt??new Date()}: {})}})
      if(!order.confirmedAt)await tx.order.update({where:{id:order.id},data:{moneyStatus:'RECONCILING'}})
      if(held.includes(r.state))await tx.reservationSet.update({where:{id:r.id},data:{state:'RECONCILING'}})
      if(proof&&(!held.includes(r.state)||order.confirmedAt||(paidAt&&paidAt>r.expiresAt))){
        const key=`compensation:${attemptId}`
        const refund=await tx.refund.upsert({where:{idempotencyKey:key},create:{orderId:order.id,paymentAttemptId:attemptId,kind:'COMPENSATION',requestedMoneyCents:current.amountCents,requestedPointsTenths:0n,shippingRefundCents:0n,idempotencyKey:key},update:{}})
        await tx.outboxMessage.upsert({where:{deduplicationKey:`refund:${refund.id}`},create:{kind:'REFUND',aggregateType:'Refund',aggregateId:refund.id,deduplicationKey:`refund:${refund.id}`,payload:{refundId:refund.id}},update:{}})
      }
    })
  }
  return {
    async status(orderId,identity) {
      paymentId(orderId)
      return db.$transaction(async tx=>{const order=await tx.order.findUnique({where:{id:orderId}});await authorize(tx,order,identity);const r=await latest(tx,orderId);return dto(order,r?.paymentAttempt_reservationSet[0],r)})
    },
    async start(orderId,identity,acceptedTotalCents) {
      paymentId(orderId)
      const preflight=await db.$transaction(async tx=>{
        const order=await tx.order.findUnique({where:{id:orderId},include:{orderPackage_order:{include:{quote:true}},sourceCart:true}})
        await authorize(tx,order,identity)
        const r=await latest(tx,orderId)
        if(order.confirmedAt)return{complete:true,order}
        if(order.status!=='PENDING_PAYMENT'||acceptedTotalCents!==order.totalMoneyCents.toString())throw new PaymentError(409,'Revisa y acepta el importe del pedido antes de pagar.')
        if(order.totalMoneyCents>0n&&(order.totalMoneyCents<BigInt(minimumCents)||order.totalMoneyCents>999999999999n))throw new PaymentError(409,'El total no cumple los límites configurados de Stripe. Modifica tu carrito; no se añadirá un cargo extra.')
        if(r&&held.includes(r.state))return{existing:true,order,r}
        if(!order.sourceCart?.guestTokenHash||!order.orderPackage_order)throw new PaymentError(409,'El pedido requiere un checkout actualizado.')
        const quote=order.orderPackage_order.quote,prepared=await prepareShipping(tx,order.sourceCart.guestTokenHash,quote.destinationSnapshot)
        if(prepared.version!==order.policySnapshot.cartVersion||prepared.fingerprint!==quote.requestFingerprint)throw new PaymentError(409,'El carrito, los precios o el empaque cambiaron. Prepara un nuevo pedido.')
        return{order,prepared,quote}
      })
      if(preflight.complete)return{confirmed:true}
      if(preflight.existing)return this.openAttempt(preflight.r.paymentAttempt_reservationSet[0]?.id,preflight.r)
      // Network calls always outside the inventory transaction. Recotization cannot create guides.
      const rates=await shipping.quote({origin:preflight.prepared.origin,destination:preflight.prepared.destination,package:preflight.prepared.parcel,goodsCents:preflight.prepared.baseCents,content:preflight.prepared.content})
      const rate=rates.find(r=>r.carrierCode===preflight.quote.carrierCode&&r.serviceCode===preflight.quote.serviceCode&&r.currency==='MXN')
      if(!rate||rate.quotedAmountCents!==preflight.quote.quotedAmountCents.toString())throw new PaymentError(409,'La tarifa o cobertura cambió. Vuelve a cotizar y aceptar el envío antes de pagar.')
      const reserved=await withInventoryTransaction(db,async context=>{
        const tx=context.tx,order=await lockOrder(tx,orderId);await authorize(tx,order,identity)
        const previous=await latest(tx,orderId)
        if(order.confirmedAt)return{complete:true}
        if(previous&&held.includes(previous.state))return{r:previous,attempt:previous.paymentAttempt_reservationSet[0]}
        if(order.status!=='PENDING_PAYMENT'||order.totalMoneyCents.toString()!==acceptedTotalCents)throw new PaymentError(409,'El pedido cambió.')
        await tx.$queryRaw`SELECT id FROM "Cart" WHERE id=${order.sourceCartId}::uuid FOR UPDATE`
        const fresh=await prepareShipping(tx,order.sourceCart.guestTokenHash,preflight.quote.destinationSnapshot)
        if(fresh.fingerprint!==preflight.prepared.fingerprint)throw new PaymentError(409,'El carrito o el paquete cambió durante la recotización.')
        const {items,current}=await checkoutCart(tx,order.sourceCart.guestTokenHash)
        if(current.totals.goodsAfterCouponCents!==order.goodsAfterCouponCents.toString())throw new PaymentError(409,'Los importes cambiaron; prepara un nuevo pedido.')
        const lines=await tx.orderLine.findMany({where:{orderId},orderBy:{position:'asc'}})
        if(lines.length!==items.length||lines.some((l,i)=>l.variantId!==items[i].variantId||l.bundleId!==items[i].bundleId||l.quantity!==items[i].quantity||l.unitPriceCents!==(items[i].variant?.priceCents??items[i].bundle.priceCents)||l.compositionVersionSnapshot!==(items[i].bundle?.compositionVersion??null)))throw new PaymentError(409,'Las selecciones cambiaron; prepara un nuevo pedido.')
        const policies=await tx.contentPage.findMany({where:{slug:{in:['privacidad','terminos','devoluciones']},publishedAt:{lte:new Date()}}})
        if(policies.length!==3||policies.some(p=>!order.policySnapshot.pages?.some(s=>s.slug===p.slug&&s.version===p.version)))throw new PaymentError(409,'Las políticas cambiaron; revisa el checkout.')
        const clock=(await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now,attemptNumber=(previous?.attemptNumber??0)+1
        const freshQuote=await tx.shippingQuote.create({data:{orderId,provider:'ENVIA',requestFingerprint:fresh.fingerprint,carrierCode:rate.carrierCode,serviceCode:rate.serviceCode,serviceName:rate.serviceName,quotedAmountCents:BigInt(rate.quotedAmountCents),currency:'MXN',quotedAt:clock,originSnapshot:fresh.origin,destinationSnapshot:fresh.destination,packageSnapshot:fresh.parcel,sanitizedResponse:{deliveryEstimate:rate.deliveryEstimate??null},status:'ACCEPTED'}})
        await tx.orderPackage.update({where:{orderId},data:{quoteId:freshQuote.id,acceptedAt:clock,deliveryEstimateSnapshot:{estimate:rate.deliveryEstimate??null}}})
        const r=await tx.reservationSet.create({data:{orderId,attemptNumber,createdAt:clock,expiresAt:new Date(clock.getTime()+1800000),acceptedQuoteId:freshQuote.id,checkoutFingerprint:preflight.prepared.fingerprint,acceptedCheckoutSnapshot:{totalMoneyCents:acceptedTotalCents,stripeExpiresAtSeconds:Math.floor(clock.getTime()/1000)+1860,stripeOrigin:stripe.origin,stripeEnvironment:stripe.environment??'test',stripeScope:stripe.scope??'injected-provider'},idempotencyKey:`checkout:${orderId}:${attemptNumber}`}})
        await reserveCoupon(context,r.id);await reserveInventory(context,r.id);await reservePoints(context,r.id)
        if(order.totalMoneyCents===0n){await confirm(context,order,null,r);return{complete:true}}
        const attempt=await tx.paymentAttempt.create({data:{orderId,reservationSetId:r.id,amountCents:order.totalMoneyCents,currency:'MXN',idempotencyKey:`stripe:${r.id}`}})
        await tx.outboxMessage.create({data:{kind:'CREATE_PAYMENT',aggregateType:'PaymentAttempt',aggregateId:attempt.id,deduplicationKey:`create:${attempt.id}`,payload:{attemptId:attempt.id}}})
        await tx.order.update({where:{id:orderId},data:{moneyStatus:'PENDING'}})
        return{r,attempt}
      })
      if(reserved.complete)return{confirmed:true}
      return this.openAttempt(reserved.attempt?.id,reserved.r)
    },
    async openAttempt(attemptId,reservation) {
      if(!attemptId)throw new PaymentError(409,'El pedido requiere revisión.')
      if(!held.includes(reservation.state)||reservation.expiresAt<=new Date())throw new PaymentError(409,'El plazo de pago terminó. Consulta el estado mientras conciliamos el intento.')
      if(reservation.acceptedCheckoutSnapshot.stripeOrigin!==stripe.origin||reservation.acceptedCheckoutSnapshot.stripeEnvironment!==(stripe.environment??'test')||reservation.acceptedCheckoutSnapshot.stripeScope!==(stripe.scope??'injected-provider'))throw new PaymentError(409,'La configuración Stripe cambió durante el intento; requiere revisión con su configuración original.')
      const attempt=await db.paymentAttempt.findUnique({where:{id:attemptId},include:{order:true}})
      let session
      try {
        session=attempt.providerSessionId?await stripe.session(attempt.providerSessionId):await stripe.createSession({orderId:attempt.orderId,orderNumber:attempt.order.orderNumber,attemptId:attempt.id,amountCents:attempt.amountCents.toString(),expiresAtSeconds:reservation.acceptedCheckoutSnapshot.stripeExpiresAtSeconds,idempotencyKey:attempt.idempotencyKey})
        if(session.orderId!==attempt.orderId||session.attemptId!==attempt.id||session.amountCents!==attempt.amountCents.toString()||session.currency!=='MXN')throw new PaymentError(502,'Stripe devolvió una sesión incompatible. El pedido requiere revisión.')
        await withInventoryTransaction(db,async({tx})=>{
          const order=await lockOrder(tx,attempt.orderId),current=await tx.paymentAttempt.findUnique({where:{id:attemptId}})
          if(current.providerSessionId&&current.providerSessionId!==session.id)throw new PaymentError(409,'Sesión Stripe incompatible con el intento.')
          // Do not regress a webhook that won the race against session persistence.
          await tx.paymentAttempt.update({where:{id:attemptId},data:{providerSessionId:session.id,...(session.paymentIntentId?{providerPaymentIntentId:session.paymentIntentId}:{}),...(!order.confirmedAt&&!['SUCCEEDED','EXPIRED','FAILED'].includes(current.status)?{status:'SESSION_CREATED',failureCode:null}:{})}})
          await tx.outboxMessage.updateMany({where:{deduplicationKey:`create:${attemptId}`},data:{state:'PROCESSED',processedAt:new Date(),lastError:null}})
        })
      }catch(e){await markUncertain(attemptId);throw e}
      if(session.status!=='open'||!session.url)throw new PaymentError(409,'La sesión ya no está abierta. Consulta el estado del pedido.')
      const current=await db.reservationSet.findUnique({where:{id:reservation.id}})
      if(!held.includes(current.state)||current.expiresAt<=new Date())throw new PaymentError(409,'El plazo terminó; no reanudes el pago.')
      return{confirmed:false,url:session.url,expiresAt:current.expiresAt.toISOString()}
    },
    async reconcile(attemptId,{eventPaidAt=null,close=false,failedPaymentIntentId=null}={}) {
      paymentId(attemptId)
      const attempt=await db.paymentAttempt.findUnique({where:{id:attemptId},include:{reservationSet:true}})
      if(!attempt||!attempt.providerSessionId){if(attempt)await markUncertain(attemptId);return{pending:true}}
      let session
      try {
        session=await stripe.session(attempt.providerSessionId)
        if(session.status==='open'&&session.paymentStatus!=='paid'&&(close||attempt.reservationSet.expiresAt<=new Date())) {
          try {await stripe.expire(session.id,`expire:${attempt.id}`)}catch{}
          session=await stripe.session(session.id)
        }
      }catch(e){await markUncertain(attemptId);throw e}
      const observedAt=new Date()
      if(!eventPaidAt){const proof=await db.providerEvent.findFirst({where:{provider:'STRIPE',eventType:'checkout.session.completed',AND:[{safePayload:{path:['attemptId'],equals:attemptId}},{safePayload:{path:['id'],equals:session.id}},{safePayload:{path:['paymentStatus'],equals:'paid'}}]},orderBy:{receivedAt:'asc'}});if(proof)eventPaidAt=new Date(proof.safePayload.created*1000)}
      try {return await withInventoryTransaction(db,async context=>{
        const tx=context.tx,order=await lockOrder(tx,attempt.orderId),current=await tx.paymentAttempt.findUnique({where:{id:attemptId}}),r=await tx.reservationSet.findUnique({where:{id:attempt.reservationSetId}})
        if(session.orderId!==order.id||session.attemptId!==current.id||session.id!==current.providerSessionId||session.amountCents!==order.totalMoneyCents.toString()||session.currency!==order.currency)throw new PaymentError(409,'Pago incompatible con pedido; requiere revisión.')
        if(current.appliedToOrder&&order.confirmedAt)return{confirmed:true}
        if(await tx.refund.findFirst({where:{paymentAttemptId:current.id,kind:'COMPENSATION',status:{not:'FAILED'}}}))throw new PaymentError(409,'Este cobro está comprometido para compensación; no puede confirmar una compra.')
        if(session.paymentStatus==='paid'&&session.status==='complete'&&session.paymentIntentId) {
          const paidAt=eventPaidAt??current.providerPaidAt??(observedAt<=r.expiresAt?observedAt:null)
          if(!paidAt||paidAt<new Date(Math.floor(r.createdAt.getTime()/1000)*1000)||paidAt>r.expiresAt||paidAt>observedAt||!held.includes(r.state)||order.status!=='PENDING_PAYMENT')throw new PaymentError(409,'Cobro fuera de plazo o sin reserva disponible; requiere compensación y revisión.')
          await tx.paymentAttempt.update({where:{id:attemptId},data:{status:'SUCCEEDED',providerPaymentIntentId:session.paymentIntentId,providerPaidAt:paidAt,lastReconciledAt:observedAt,failureCode:null}})
          await confirm(context,order,current,r)
          return{confirmed:true}
        }
        if(session.status==='expired'&&session.paymentStatus==='unpaid'&&held.includes(r.state)) {
          await tx.paymentAttempt.update({where:{id:attemptId},data:{status:'EXPIRED',lastReconciledAt:observedAt,failureCode:null}})
          await releaseCoupon(context,r.id);await releasePoints(context,r.id);await releaseInventory(context,r.id,'Sesión Stripe cerrada y reconciliada sin cobro')
          await tx.order.update({where:{id:order.id},data:{moneyStatus:'FAILED'}})
          return{expired:true}
        }
        await tx.paymentAttempt.update({where:{id:attemptId},data:{lastReconciledAt:observedAt,...(failedPaymentIntentId&&session.paymentIntentId===failedPaymentIntentId&&session.paymentStatus==='unpaid'?{failureCode:'STRIPE_PAYMENT_FAILED'}:{})}})
        return{pending:true}
      })}catch(e){await markUncertain(attemptId,session,eventPaidAt??(session.paymentStatus==='paid'?observedAt:null));throw e}
    },
    async cancel(orderId,identity) {
      paymentId(orderId)
      const attempt=await db.$transaction(async tx=>{const order=await tx.order.findUnique({where:{id:orderId}});await authorize(tx,order,identity);if(order.confirmedAt)throw new PaymentError(409,'El pedido ya está confirmado. Solicita cancelación por el flujo de posventa.');const r=await latest(tx,orderId);return r?.paymentAttempt_reservationSet[0]})
      return attempt?this.reconcile(attempt.id,{close:true}):{pending:false}
    },
    async sweep(limit=20) {
      if(!Number.isInteger(limit)||limit<1||limit>100)throw new PaymentError(400,'Tamaño de lote de reconciliación inválido.')
      const attempts=await db.paymentAttempt.findMany({where:{appliedToOrder:false,reservationSet:{state:{in:held}},status:{in:['PENDING','SESSION_CREATED','PROCESSING','RECONCILING','SUCCEEDED']}},orderBy:[{lastReconciledAt:{sort:'asc',nulls:'first'}},{createdAt:'asc'}],take:limit,include:{reservationSet:true}})
      const results=[]
      for(const a of attempts)try{
        if(!a.providerSessionId&&a.reservationSet.expiresAt>new Date())await this.openAttempt(a.id,a.reservationSet)
        results.push({attemptId:a.id,...await this.reconcile(a.id)})
      }catch{results.push({attemptId:a.id,pending:true})}
      return results
    },
  }
}
