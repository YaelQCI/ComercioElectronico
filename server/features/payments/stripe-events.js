import { createHash } from 'node:crypto'
import { PaymentError, verifyStripeEvent,paymentId } from './stripe-client.js'

const supported=new Set(['checkout.session.completed','checkout.session.expired','payment_intent.payment_failed'])
export async function receiveStripeEvent(db,payments,{raw,signature,secret,environment}) {
  const event=verifyStripeEvent(raw,signature,secret,environment),object=event.data.object
  const safePayload={id:object.id??null,orderId:object.metadata?.orderId??null,attemptId:object.metadata?.attemptId??null,created:event.created,paymentStatus:object.payment_status??null,amountTotal:Number.isSafeInteger(object.amount_total)?object.amount_total:null,currency:object.currency??null,livemode:event.livemode}
  const digest=createHash('sha256').update(raw).digest('hex')
  let saved
  try{saved=await db.providerEvent.create({data:{provider:'STRIPE',externalEventId:event.id,eventType:event.type,payloadDigest:digest,safePayload}})}
  catch(e){if(e.code!=='P2002')throw e;saved=await db.providerEvent.findUnique({where:{provider_externalEventId:{provider:'STRIPE',externalEventId:event.id}}})}
  if(saved.payloadDigest!==digest)throw new PaymentError(409,'Evento repetido con contenido diferente; requiere revisión.')
  if(saved.status==='PROCESSED')return{received:true}
  if(!supported.has(event.type)){await db.providerEvent.update({where:{id:saved.id},data:{status:'PROCESSED',processedAt:new Date()}});return{received:true}}
  try {
    paymentId(safePayload.attemptId);paymentId(safePayload.orderId)
    const attempt=await db.paymentAttempt.findFirst({where:{...(safePayload.attemptId?{id:safePayload.attemptId}:{}),orderId:safePayload.orderId, ...(event.type.startsWith('checkout.session.')?{OR:[{providerSessionId:object.id},{providerSessionId:null}]}:{})},include:{reservationSet:true}})
    if(!attempt||!safePayload.attemptId||!safePayload.orderId)throw new PaymentError(409,'Evento sin intento conocido; requiere reconciliación.')
    if(event.type.startsWith('checkout.session.')) {
      // A webhook can arrive before createSession has persisted its response.
      if(!attempt.providerSessionId)await db.paymentAttempt.updateMany({where:{id:attempt.id,providerSessionId:null},data:{providerSessionId:object.id}})
      await payments.reconcile(attempt.id,{eventPaidAt:event.type==='checkout.session.completed'&&object.payment_status==='paid'?new Date(event.created*1000):null})
    }else await payments.reconcile(attempt.id,{failedPaymentIntentId:object.id})
    await db.providerEvent.update({where:{id:saved.id},data:{status:'PROCESSED',processedAt:new Date(),lastError:null}})
    return{received:true}
  }catch(e){await db.providerEvent.update({where:{id:saved.id},data:{status:'FAILED',lastError:'Reconciliación pendiente; revisar referencias y proveedor.'}});throw e}
}
