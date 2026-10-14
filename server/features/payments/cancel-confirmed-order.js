import { requireAdministrator } from '../../utils/authorization.js'
import { accountText } from '../accounts/credentials.js'
import { paymentId,PaymentError } from './stripe-client.js'
import { withInventoryTransaction } from '../inventory/inventory-transaction.js'
import { sellableLots } from '../../../shared/features/inventory/lots.js'

export async function cancelConfirmedOrder(db,adminId,orderId,input) {
  paymentId(orderId);paymentId(input?.idempotencyKey)
  const reason=accountText(input?.reason,'Motivo',500),eventKey=`cancel:${input.idempotencyKey}`
  return withInventoryTransaction(db,async({tx})=>{
    await requireAdministrator(tx,adminId)
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId}::uuid FOR UPDATE`
    const previous=await tx.orderStatusHistory.findUnique({where:{eventKey}})
    if(previous){if(previous.orderId!==orderId||previous.actorId!==adminId||previous.reason!==reason)throw new PaymentError(409,'Clave de cancelación utilizada para otra operación.');return{canceled:true,repeated:true,refundId:(await tx.refund.findUnique({where:{idempotencyKey:`refund:${eventKey}`}}))?.id??null}}
    const order=await tx.order.findUnique({where:{id:orderId}})
    if(!order)throw new PaymentError(404,'Pedido no disponible.')
    if(!['CONFIRMED','PREPARING'].includes(order.status)||order.shippedAt)throw new PaymentError(409,'Solo se cancela un pedido confirmado antes del envío; revalida su estado.')
    if(!['PAID','NOT_REQUIRED','PARTIALLY_REFUNDED'].includes(order.moneyStatus))throw new PaymentError(409,'El estado monetario requiere revisión antes de cancelar.')
    const units=await tx.orderUnit.findMany({where:{orderId},orderBy:[{lotId:'asc'},{id:'asc'}]})
    if(!units.length||units.some(u=>!u.lotId))throw new PaymentError(409,'El pedido no tiene una asignación física completa.')
    const lotIds=[...new Set(units.map(u=>u.lotId))].sort()
    await tx.$queryRaw`SELECT id FROM "InventoryLot" WHERE id=ANY(${lotIds}::uuid[]) ORDER BY id FOR UPDATE`
    const clock=(await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now
    for(const unit of units){
      const lot=await tx.inventoryLot.findUnique({where:{id:unit.lotId},include:{warehouse:{select:{timezone:true}}}})
      const apt=sellableLots([{...lot,onHandQty:1,reservedQty:0}],clock).length>0
      await tx.inventoryMovement.create({data:{lotId:lot.id,orderUnitId:unit.id,kind:apt?'RETURN_SELLABLE':'RETURN_NON_SELLABLE',onHandDelta:apt?1:0,nonSellableDelta:apt?0:1,reason,actorId:adminId,actorType:'ADMIN',idempotencyKey:`cancel-unit:${unit.id}`}})
    }
    const committed=await tx.refundAllocation.findMany({where:{orderId,refund:{status:{not:'FAILED'}}}})
    const allocations=units.map(u=>{
      const prior=committed.filter(a=>a.orderUnitId===u.id),money=u.moneyCents-prior.reduce((s,a)=>s+a.moneyCents,0n),points=u.pointsTenths-prior.reduce((s,a)=>s+a.pointsTenths,0n)
      if(money<0n||points<0n)throw new PaymentError(409,'Reparto de reembolsos inconsistente.')
      return{unit:u,money,points}
    }).filter(a=>a.money>0n||a.points>0n)
    const shipping=order.shippingChargedCents-committed.filter(a=>a.kind==='SHIPPING').reduce((s,a)=>s+a.moneyCents,0n)
    if(shipping<0n)throw new PaymentError(409,'Reembolso de envío inconsistente.')
    const money=allocations.reduce((s,a)=>s+a.money,shipping),points=allocations.reduce((s,a)=>s+a.points,0n)
    const payment=money>0n?await tx.paymentAttempt.findFirst({where:{orderId,appliedToOrder:true,status:'SUCCEEDED'}}):null
    if(money>0n&&!payment)throw new PaymentError(409,'Falta el cobro aplicado para reembolsar.')
    let refund=null
    if(money>0n||points>0n){
      refund=await tx.refund.create({data:{orderId,paymentAttemptId:payment?.id,kind:'CANCELLATION',requestedMoneyCents:money,requestedPointsTenths:points,shippingRefundCents:shipping,idempotencyKey:`refund:${eventKey}`}})
      for(const a of allocations)await tx.refundAllocation.create({data:{refundId:refund.id,orderId,orderUnitId:a.unit.id,kind:'UNIT',moneyCents:a.money,pointsTenths:a.points,benefitReductionCents:a.money+a.points}})
      if(shipping>0n)await tx.refundAllocation.create({data:{refundId:refund.id,orderId,kind:'SHIPPING',moneyCents:shipping,pointsTenths:0n,benefitReductionCents:0n}})
      await tx.outboxMessage.create({data:{kind:'REFUND',aggregateType:'Refund',aggregateId:refund.id,deduplicationKey:`refund:${refund.id}`,payload:{refundId:refund.id}}})
    }
    await tx.orderStatusHistory.create({data:{orderId,fromStatus:order.status,toStatus:'CANCELED',actorId:adminId,actorType:'ADMIN',reason,eventKey}})
    await tx.order.update({where:{id:orderId},data:{status:'CANCELED',canceledAt:clock}})
    return{canceled:true,repeated:false,refundId:refund?.id??null,refundPending:!!refund}
  })
}
