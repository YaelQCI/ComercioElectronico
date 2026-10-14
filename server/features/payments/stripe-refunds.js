import { PaymentError,paymentId } from './stripe-client.js'
import { requireAdministrator } from '../../utils/authorization.js'
import { earnedTenths } from '../../../shared/features/loyalty/points.js'

// Refund requests/allocations must already be approved and reserved by the business case.
// This adapter never accepts an amount, order or PaymentIntent from an HTTP client.
export async function submitStripeRefund(db,stripe,adminId,refundId) {
  paymentId(refundId)
  const request=await db.$transaction(async tx=>{
    await requireAdministrator(tx,adminId)
    const found=await tx.refund.findUnique({where:{id:refundId}})
    if(!found)throw new PaymentError(404,'Reembolso no disponible.')
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${found.orderId}::uuid FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "Refund" WHERE id=${refundId}::uuid FOR UPDATE`
    const refund=await tx.refund.findUnique({where:{id:refundId},include:{paymentAttempt:true,order:true,returnRequest:true,priceMatchRequest:true}}),a=refund.paymentAttempt
    if(refund.status==='SETTLED')return{settled:true}
    if((refund.requestedMoneyCents>0n&&(!a||a.orderId!==refund.orderId||!a.providerPaymentIntentId))||refund.currency!=='MXN'||!['REQUESTED','PROCESSING'].includes(refund.status))throw new PaymentError(409,'Solicitud de reembolso no preparada para Stripe.')
    if(refund.kind==='COMPENSATION'?(!a||a.appliedToOrder||refund.requestedPointsTenths!==0n):(refund.requestedMoneyCents>0n&&(!a.appliedToOrder||a.status!=='SUCCEEDED')))throw new PaymentError(409,'Origen del reembolso incompatible.')
    if(refund.kind==='CANCELLATION'&&(refund.order.status!=='CANCELED'||refund.order.shippedAt))throw new PaymentError(409,'La cancelación debe estar aprobada y registrada antes del reembolso.')
    if(refund.kind==='RETURN'&&refund.returnRequest?.status!=='RECEIVED')throw new PaymentError(409,'La devolución requiere recepción e inspección antes del reembolso.')
    if(refund.kind==='RETURN'){
      const allocations=await tx.refundAllocation.findMany({where:{refundId,kind:'UNIT'}}),units=[...new Set(allocations.map(a=>a.orderUnitId))]
      const inspected=await tx.returnItem.count({where:{returnRequestId:refund.returnRequestId,orderUnitId:{in:units},state:'RECEIVED',returnInspection_returnItem:{isNot:null}}})
      if(inspected!==units.length)throw new PaymentError(409,'Hay unidades sin recepción e inspección registradas.')
    }
    if(refund.kind==='PRICE_MATCH'&&refund.priceMatchRequest?.status!=='APPROVED')throw new PaymentError(409,'Price Match requiere aprobación registrada antes del reembolso.')
    await tx.refund.update({where:{id:refundId},data:{status:'PROCESSING'}})
    await tx.outboxMessage.upsert({where:{deduplicationKey:`refund:${refundId}`},create:{kind:'REFUND',aggregateType:'Refund',aggregateId:refundId,deduplicationKey:`refund:${refundId}`,payload:{refundId}},update:{}})
    return{paymentIntentId:a?.providerPaymentIntentId,amountCents:refund.requestedMoneyCents.toString(),idempotencyKey:refund.idempotencyKey,providerRefundId:refund.providerRefundId}
  })
  if(request.settled)return{settled:true}
  let response
  try{response=request.amountCents==='0'?{id:null,status:'succeeded',amountCents:'0',currency:'MXN'}:request.providerRefundId?await stripe.refundStatus(request.providerRefundId):await stripe.refund(request);if(response.paymentIntentId&&response.paymentIntentId!==request.paymentIntentId)throw new PaymentError(409,'Reembolso pertenece a otro intento.')}catch(e){await db.refund.updateMany({where:{id:refundId,status:'PROCESSING'},data:{lastError:'Resultado Stripe incierto; reintentar la misma clave.'}});throw e}
  return db.$transaction(async tx=>{
    const found=await tx.refund.findUnique({where:{id:refundId}})
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${found.orderId}::uuid FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "Refund" WHERE id=${refundId}::uuid FOR UPDATE`
    const refund=await tx.refund.findUnique({where:{id:refundId}})
    if(refund.status==='SETTLED')return{settled:true}
    if(response.amountCents!==refund.requestedMoneyCents.toString()||response.currency!=='MXN')throw new PaymentError(409,'Importe de reembolso incompatible; requiere revisión.')
    if(response.status!=='succeeded') {
      await tx.refund.update({where:{id:refundId},data:{providerRefundId:response.id,status:['failed','canceled'].includes(response.status)?'FAILED':'PROCESSING',lastError:'Reembolso todavía no confirmado.'}})
      return{settled:false}
    }
    await tx.refund.update({where:{id:refundId},data:{providerRefundId:response.id,status:'SETTLED',settledAt:new Date(),lastError:null}})
    const order=await tx.order.findUnique({where:{id:refund.orderId}})
    // A duplicate/non-applied charge has its own ceiling; never touches purchase benefits.
    if(refund.kind!=='COMPENSATION') {
      if(order.userId) {
        let a=await tx.loyaltyAccount.upsert({where:{userId:order.userId},create:{userId:order.userId},update:{}})
        await tx.$queryRaw`SELECT id FROM "LoyaltyAccount" WHERE id=${a.id}::uuid FOR UPDATE`
        a=await tx.loyaltyAccount.findUnique({where:{id:a.id}})
        if(refund.requestedPointsTenths>0n)await tx.loyaltyLedgerEntry.create({data:{accountId:a.id,orderId:order.id,refundId,kind:'RESTORE',deltaTenths:refund.requestedPointsTenths,balanceAfterTenths:a.balanceTenths+refund.requestedPointsTenths,idempotencyKey:`restore:${refundId}`,reason:'Restitución del canje original por reembolso confirmado'}})
        const gain=await tx.loyaltyLedgerEntry.aggregate({where:{accountId:a.id,orderId:order.id,kind:{in:['EARN','REVERSE']}},_sum:{deltaTenths:true}})
        if(gain._sum.deltaTenths!==null) {
          const refunded=await tx.refundAllocation.aggregate({where:{orderId:order.id,kind:'UNIT',refund:{status:'SETTLED'}},_sum:{moneyCents:true}})
          const target=BigInt(earnedTenths(order.goodsMoneyCents.toString(),(refunded._sum.moneyCents??0n).toString())),delta=target-gain._sum.deltaTenths
          if(delta<0n){a=await tx.loyaltyAccount.findUnique({where:{id:a.id}});await tx.loyaltyLedgerEntry.create({data:{accountId:a.id,orderId:order.id,refundId,kind:'REVERSE',deltaTenths:delta,balanceAfterTenths:a.balanceTenths+delta,idempotencyKey:`reverse:${refundId}`,reason:'Reversión de ganancia sobre dinero reembolsado'}})}
        }
      }
      const total=await tx.refund.aggregate({where:{orderId:order.id,status:'SETTLED',kind:{not:'COMPENSATION'}},_sum:{requestedMoneyCents:true}})
      if(order.totalMoneyCents>0n)await tx.order.update({where:{id:order.id},data:{moneyStatus:(total._sum.requestedMoneyCents??0n)>=order.totalMoneyCents?'REFUNDED':'PARTIALLY_REFUNDED'}})
    }
    await tx.outboxMessage.updateMany({where:{deduplicationKey:`refund:${refundId}`},data:{state:'PROCESSED',processedAt:new Date(),lastError:null}})
    return{settled:true}
  })
}
