import{createHash}from'node:crypto'
import{accountText,secretHash}from'../accounts/credentials.js'
import{paymentId,PaymentError}from'../payments/stripe-client.js'
import{requireAdministrator}from'../../utils/authorization.js'
import{withInventoryTransaction}from'../inventory/inventory-transaction.js'
import{sellableLots}from'../../../shared/features/inventory/lots.js'
import{refundRemaining,proportionalRefund}from'../../../shared/features/after-sales/refunds.js'
const now=async tx=>(await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now
async function lockOrder(tx,id){paymentId(id);await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id}::uuid FOR UPDATE`;const o=await tx.order.findUnique({where:{id}});if(!o)throw new PaymentError(404,'Pedido no disponible.');return o}
async function proof(tx,order,identity){
  if(identity?.userId===order.userId&&order.userId)return{requestedByUserId:order.userId}
  if(!/^[a-f0-9]{64}$/.test(identity?.guestToken??''))throw new PaymentError(404,'Pedido no disponible.')
  const token=await tx.actionToken.findFirst({where:{purpose:'GUEST_ORDER_ACCESS',orderId:order.id,tokenHash:secretHash(identity.guestToken),consumedAt:null,expiresAt:{gt:await now(tx)}}})
  if(!token)throw new PaymentError(404,'Pedido no disponible.')
  return{guestProofId:token.id}
}
function evidence(input){
  if(!Array.isArray(input)||!input.length||input.length>10)throw new PaymentError(400,'Incluye al menos un enlace de evidencia (máximo diez).')
  return input.map(e=>{let u;try{u=new URL(e.url)}catch{throw new PaymentError(400,'Enlace de evidencia inválido.')}if(u.protocol!=='https:'||u.username||u.password||u.href.length>2000)throw new PaymentError(400,'Usa enlaces HTTPS sin credenciales.');return{externalUrl:u.href,description:accountText(e.description,'Descripción de evidencia',500)}})
}
function ids(input){if(!Array.isArray(input)||!input.length||new Set(input).size!==input.length)throw new PaymentError(400,'Selecciona unidades únicas del pedido.');input.forEach(paymentId);return input}
const cents=value=>{if(typeof value!=='string'||!/^(0|[1-9]\d{0,14})$/.test(value))throw new PaymentError(400,'Importe inválido; utiliza centavos como texto.');return BigInt(value)}
async function committed(tx,orderId){return tx.refundAllocation.findMany({where:{orderId,refund:{status:{not:'FAILED'}}}})}
async function queueRefund(tx,order,kind,requestId,rows,shipping=0n){
  rows=rows.filter(r=>BigInt(r.moneyCents)+BigInt(r.pointsTenths)>0n)
  const cash=rows.reduce((s,r)=>s+BigInt(r.moneyCents),shipping),points=rows.reduce((s,r)=>s+BigInt(r.pointsTenths),0n)
  if(cash===0n&&points===0n)return null
  const payment=cash>0n?await tx.paymentAttempt.findFirst({where:{orderId:order.id,appliedToOrder:true,status:'SUCCEEDED'}}):null
  if(cash>0n&&!payment)throw new PaymentError(409,'Falta cobro aplicado para reembolsar.')
  const refund=await tx.refund.create({data:{orderId:order.id,paymentAttemptId:payment?.id,kind,returnRequestId:kind==='RETURN'?requestId:undefined,priceMatchRequestId:kind==='PRICE_MATCH'?requestId:undefined,requestedMoneyCents:cash,requestedPointsTenths:points,shippingRefundCents:shipping,idempotencyKey:`claim:${kind}:${requestId}`}})
  for(const r of rows)await tx.refundAllocation.create({data:{refundId:refund.id,orderId:order.id,orderUnitId:r.unitId,kind:'UNIT',moneyCents:BigInt(r.moneyCents),pointsTenths:BigInt(r.pointsTenths),benefitReductionCents:BigInt(r.moneyCents)+BigInt(r.pointsTenths)}})
  if(shipping>0n)await tx.refundAllocation.create({data:{refundId:refund.id,orderId:order.id,kind:'SHIPPING',moneyCents:shipping,pointsTenths:0n,benefitReductionCents:0n}})
  await tx.outboxMessage.create({data:{kind:'REFUND',aggregateType:'Refund',aggregateId:refund.id,deduplicationKey:`refund:${refund.id}`,payload:{refundId:refund.id}}})
  return refund.id
}
export function createAfterSales(db){
  return{
    async inspect(adminId,type,id){
      if(!['RETURN','PRICE_MATCH'].includes(type))throw new PaymentError(400,'Tipo inválido.')
      paymentId(id)
      return db.$transaction(async tx=>{
        await requireAdministrator(tx,adminId)
        const request=await(type==='RETURN'?tx.returnRequest:tx.priceMatchRequest).findUnique({where:{id}})
        if(!request)throw new PaymentError(404,'Solicitud no disponible.')
        const items=await(type==='RETURN'?tx.returnItem:tx.priceMatchItem).findMany({where:type==='RETURN'?{returnRequestId:id}:{priceMatchRequestId:id}})
        const files=await tx.claimEvidence.findMany({where:type==='RETURN'?{returnRequestId:id}:{priceMatchRequestId:id}})
        return JSON.parse(JSON.stringify({request,items,evidence:files},(_,v)=>typeof v==='bigint'?v.toString():v))
      })
    },
    async list(orderId,identity){return db.$transaction(async tx=>{
      paymentId(orderId);const order=await tx.order.findUnique({where:{id:orderId}});if(!order)throw new PaymentError(404,'Pedido no disponible.');await proof(tx,order,identity)
      const units=await tx.orderUnit.findMany({where:{orderId},include:{orderComponent:true},orderBy:{id:'asc'}})
      const returns=await tx.returnRequest.findMany({where:{orderId},include:{refund_returnRequest:{select:{id:true,status:true}}},orderBy:{requestedAt:'desc'}}),matches=await tx.priceMatchRequest.findMany({where:{orderId},include:{refund_priceMatchRequest:{select:{id:true,status:true}}},orderBy:{requestedAt:'desc'}})
      return{number:order.orderNumber,units:units.map(u=>({id:u.id,name:u.orderComponent.productSnapshot.name??'Producto del pedido',sku:u.orderComponent.variantSnapshot.sku??'SKU histórico',returned:!!u.returnedAt})),returns:returns.map(r=>({id:r.id,status:r.status,reason:r.reasonCode,decision:r.decisionReason,refunds:r.refund_returnRequest})),priceMatches:matches.map(r=>({id:r.id,status:r.status,decision:r.decisionReason,refunds:r.refund_priceMatchRequest}))}
    })},
    async request(orderId,identity,type,input){
      paymentId(orderId);paymentId(input?.idempotencyKey);const files=evidence(input?.evidence),unitIds=ids(input?.unitIds)
      if(!['RETURN','PRICE_MATCH'].includes(type))throw new PaymentError(400,'Tipo de solicitud inválido.')
      const description=accountText(input.description,'Descripción',4000),key=`case:${type}:${orderId}:${input.idempotencyKey}`,hash=createHash('sha256').update(JSON.stringify({type,description,unitIds,files,reason:input.reason,condition:input.condition,comparison:input.comparison})).digest('hex')
      return db.$transaction(async tx=>{
        const order=await lockOrder(tx,orderId),owner=await proof(tx,order,identity),clock=await now(tx)
        const prior=await tx.auditEvent.findFirst({where:{correlationId:key}})
        if(prior){if(prior.safeAfter.hash!==hash)throw new PaymentError(409,'Clave utilizada para otra solicitud.');return{id:prior.entityId,repeated:true}}
        const units=await tx.orderUnit.findMany({where:{orderId,id:{in:unitIds}}})
        if(units.length!==unitIds.length||units.some(u=>u.returnedAt))throw new PaymentError(409,'Unidades ajenas o ya recibidas en devolución.')
        let saved
        if(type==='RETURN'){
          if(order.status!=='DELIVERED'||!order.deliveredAt||clock<order.deliveredAt||clock-order.deliveredAt>30*86400000)throw new PaymentError(409,'Devolución fuera del plazo de treinta días desde entrega.')
          if(!['VOLUNTARY','DAMAGED_ON_RECEIPT','BROKEN_SEAL','WRONG_LOT'].includes(input.reason)||!['SEALED','OPENED','DAMAGED','WRONG_LOT','UNVERIFIABLE'].includes(input.condition))throw new PaymentError(400,'Motivo o condición inválidos.')
          if(input.reason==='VOLUNTARY'&&input.condition!=='SEALED')throw new PaymentError(409,'La devolución voluntaria requiere producto sin abrir y sello intacto.')
          if(await tx.returnItem.count({where:{orderUnitId:{in:unitIds},state:{not:'REJECTED'}}}))throw new PaymentError(409,'Ya hay una devolución para estas unidades.')
          saved=await tx.returnRequest.create({data:{orderId,...owner,reasonCode:input.reason,description,returnCostPayer:input.reason==='VOLUNTARY'?'CUSTOMER':'STORE'}})
        }else{
          if(!order.confirmedAt||order.status==='CANCELED'||clock<order.confirmedAt||clock-order.confirmedAt>7*86400000)throw new PaymentError(409,'Price Match fuera del plazo de siete días desde compra.')
          if(!Array.isArray(input.comparison)||input.comparison.length!==unitIds.length)throw new PaymentError(400,'Incluye precio y envío por unidad de la misma variante.')
          const parts=input.comparison.map(c=>({unitId:paymentId(c.unitId),price:cents(c.itemCents),shipping:cents(c.shippingCents)}))
          if(new Set(parts.map(p=>p.unitId)).size!==units.length||parts.some(p=>!unitIds.includes(p.unitId)))throw new PaymentError(400,'Comparación de unidades inválida.')
          saved=await tx.priceMatchRequest.create({data:{orderId,...owner,comparisonSnapshot:{description,sameVariantPendingReview:true,includesMexicoShippingPendingReview:true}}})
        }
        if(type==='RETURN')for(const u of units)await tx.returnItem.create({data:{returnRequestId:saved.id,orderId,orderUnitId:u.id,reportedCondition:input.condition}})
        else for(const p of input.comparison)await tx.priceMatchItem.create({data:{priceMatchRequestId:saved.id,orderId,orderUnitId:p.unitId,competitorItemCents:cents(p.itemCents),competitorShippingAllocatedCents:cents(p.shippingCents)}})
        for(const f of files)await tx.claimEvidence.create({data:{...f,returnRequestId:type==='RETURN'?saved.id:undefined,priceMatchRequestId:type==='PRICE_MATCH'?saved.id:undefined}})
        await tx.auditEvent.create({data:{actorId:owner.requestedByUserId,actorType:owner.requestedByUserId?'USER':'SYSTEM',action:'REQUEST_CLAIM',entityType:type==='RETURN'?'ReturnRequest':'PriceMatchRequest',entityId:saved.id,correlationId:key,safeAfter:{hash}}})
        return{id:saved.id,repeated:false}
      })
    },
    async review(adminId,type,id,input){
      if(!['RETURN','PRICE_MATCH'].includes(type))throw new PaymentError(400,'Tipo inválido.')
      paymentId(id);const reason=accountText(input?.reason,'Motivo de resolución',1000)
      if(!['APPROVE','REJECT'].includes(input?.decision))throw new PaymentError(400,'Decisión inválida.')
      return db.$transaction(async tx=>{
        await requireAdministrator(tx,adminId)
        const model=type==='RETURN'?tx.returnRequest:tx.priceMatchRequest,found=await model.findUnique({where:{id}})
        if(!found)throw new PaymentError(404,'Solicitud no disponible.')
        const order=await lockOrder(tx,found.orderId),request=await model.findUnique({where:{id}})
        if(request.status!=='REQUESTED')throw new PaymentError(409,'La solicitud ya fue revisada.')
        if(order.status==='CANCELED')throw new PaymentError(409,'El pedido está cancelado.')
        let refundId=null
        if(type==='RETURN'){
          if(typeof input.storeFault!=='boolean')throw new PaymentError(400,'Indica responsabilidad de tienda explícitamente.')
          await model.update({where:{id},data:{status:input.decision==='APPROVE'?'APPROVED':'REJECTED',reviewedById:adminId,reviewedAt:await now(tx),decisionReason:reason,storeFault:input.storeFault,returnCostPayer:input.storeFault?'STORE':'CUSTOMER'}})
          await tx.returnItem.updateMany({where:{returnRequestId:id},data:{state:input.decision==='APPROVE'?'APPROVED':'REJECTED'}})
        }else{
          if(input.decision==='APPROVE'&&(input.sameVariant!==true||input.includesMexicoShipping!==true))throw new PaymentError(400,'Confirma misma variante y costo con envío a México tras revisar evidencia.')
          const parts=await tx.priceMatchItem.findMany({where:{priceMatchRequestId:id},include:{orderUnit:true}}),prior=await committed(tx,order.id),rows=[]
          if(input.decision==='APPROVE')for(const p of parts){
            if(p.orderUnit.returnedAt)throw new PaymentError(409,'Unidad ya devuelta.')
            const history=prior.filter(a=>a.orderUnitId===p.orderUnitId),used=history.reduce((s,a)=>s+a.moneyCents+a.pointsTenths,0n)
            const difference=p.orderUnit.netGoodsCents-p.competitorItemCents-p.competitorShippingAllocatedCents-used
            const remaining=refundRemaining(p.orderUnit,history),reduction=difference>0n?difference:0n
            if(reduction>BigInt(remaining.totalCents))throw new PaymentError(409,'Diferencia supera saldo remanente.')
            const share=proportionalRefund(p.orderUnit,reduction,history);rows.push({unitId:p.orderUnitId,...share})
            await tx.priceMatchItem.update({where:{id:p.id},data:{approvedDifferenceCents:reduction,moneyRefundCents:BigInt(share.moneyCents),pointsRefundTenths:BigInt(share.pointsTenths)}})
          }
          if(input.decision==='APPROVE'&&!rows.some(r=>BigInt(r.benefitReductionCents)>0n))throw new PaymentError(409,'No hay diferencia reembolsable después de ajustes anteriores.')
          await model.update({where:{id},data:{status:input.decision==='APPROVE'?'APPROVED':'REJECTED',reviewedById:adminId,reviewedAt:await now(tx),decisionReason:reason}})
          if(input.decision==='APPROVE')refundId=await queueRefund(tx,order,'PRICE_MATCH',id,rows)
        }
        await tx.auditEvent.create({data:{actorId:adminId,actorType:'ADMIN',action:'REVIEW_CLAIM',entityType:type,entityId:id,reason,correlationId:`review:${id}`,safeAfter:{decision:input.decision}}})
        return{id,refundId}
      })
    },
    async receive(adminId,id,input){
      paymentId(id)
      return withInventoryTransaction(db,async({tx})=>{
        await requireAdministrator(tx,adminId)
        const found=await tx.returnRequest.findUnique({where:{id}});if(!found)throw new PaymentError(404,'Devolución no disponible.')
        const order=await lockOrder(tx,found.orderId),request=await tx.returnRequest.findUnique({where:{id}}),items=await tx.returnItem.findMany({where:{returnRequestId:id},include:{orderUnit:true},orderBy:{id:'asc'}})
        if(request.status!=='APPROVED')throw new PaymentError(409,'Solo se reciben devoluciones aprobadas.')
        if(!Array.isArray(input?.inspections)||input.inspections.length!==items.length||new Set(input.inspections.map(i=>i.itemId)).size!==items.length)throw new PaymentError(400,'Registra inspección de cada unidad aprobada.')
        const lotIds=[...new Set(items.map(i=>i.orderUnit.lotId))].sort();await tx.$queryRaw`SELECT id FROM "InventoryLot" WHERE id=ANY(${lotIds}::uuid[]) ORDER BY id FOR UPDATE`
        const prior=await committed(tx,order.id),rows=[],clock=await now(tx)
        for(const item of items){
          const data=input.inspections.find(i=>i.itemId===item.id)
          if(!data||!['SEALED','OPENED','DAMAGED','EXPIRED','WRONG_LOT','UNVERIFIABLE'].includes(data.condition)||!['SELLABLE','NON_SELLABLE','QUARANTINE'].includes(data.disposition))throw new PaymentError(400,'Inspección inválida.')
          const notes=accountText(data.notes,'Notas de inspección',1000),lot=await tx.inventoryLot.findUnique({where:{id:item.orderUnit.lotId},include:{warehouse:{select:{timezone:true}}}})
          const apt=data.condition==='SEALED'&&data.disposition==='SELLABLE'&&sellableLots([{...lot,onHandQty:1,reservedQty:0}],clock).length>0
          const inspection=await tx.returnInspection.create({data:{returnItemId:item.id,inspectedById:adminId,condition:data.condition,disposition:apt?'SELLABLE':data.disposition==='QUARANTINE'?'QUARANTINE':'NON_SELLABLE',notes}})
          await tx.inventoryMovement.create({data:{lotId:lot.id,returnInspectionId:inspection.id,orderUnitId:item.orderUnitId,kind:apt?'RETURN_SELLABLE':'RETURN_NON_SELLABLE',onHandDelta:apt?1:0,nonSellableDelta:apt?0:1,reason:notes,actorId:adminId,actorType:'ADMIN',idempotencyKey:`return:${inspection.id}`}})
          await tx.returnItem.update({where:{id:item.id},data:{state:'RECEIVED'}});await tx.orderUnit.update({where:{id:item.orderUnitId},data:{returnedAt:clock}})
          if(request.reasonCode==='VOLUNTARY'&&data.condition!=='SEALED')continue
          rows.push({unitId:item.orderUnitId,...refundRemaining(item.orderUnit,prior.filter(a=>a.orderUnitId===item.orderUnitId))})
        }
        await tx.returnRequest.update({where:{id},data:{status:'RECEIVED',receivedAt:clock}})
        const total=await tx.orderUnit.count({where:{orderId:order.id}}),returned=await tx.orderUnit.count({where:{orderId:order.id,returnedAt:{not:null}}})
        const fault=request.storeFault||await tx.returnRequest.count({where:{orderId:order.id,storeFault:true,status:{in:['RECEIVED','RESOLVED']}}})>0
        const shipping=total===returned&&fault?order.shippingChargedCents-prior.filter(a=>a.kind==='SHIPPING').reduce((s,a)=>s+a.moneyCents,0n):0n
        if(shipping<0n)throw new PaymentError(409,'Envío ya reembolsado en exceso.')
        const refundId=await queueRefund(tx,order,'RETURN',id,rows,shipping)
        return{id,refundId,inspectionRequiresReview:request.reasonCode==='VOLUNTARY'&&rows.length!==items.length}
      })
    },
    async resolve(adminId,type,id,input){
      if(!['RETURN','PRICE_MATCH'].includes(type))throw new PaymentError(400,'Tipo inválido.')
      paymentId(id);const reason=accountText(input?.reason,'Resolución',1000)
      return db.$transaction(async tx=>{
        await requireAdministrator(tx,adminId);const model=type==='RETURN'?tx.returnRequest:tx.priceMatchRequest,found=await model.findUnique({where:{id}})
        if(!found)throw new PaymentError(404,'Solicitud no disponible.');await lockOrder(tx,found.orderId)
        const request=await model.findUnique({where:{id}})
        if(request.status!==(type==='RETURN'?'RECEIVED':'APPROVED'))throw new PaymentError(409,'Solicitud no lista para resolver.')
        const refunds=await tx.refund.findMany({where:type==='RETURN'?{returnRequestId:id}:{priceMatchRequestId:id}})
        if(refunds.some(r=>r.status!=='SETTLED'))throw new PaymentError(409,'Hay reembolsos pendientes o fallidos; no se puede resolver.')
        if(!refunds.length&&input.noRefundDecision!==true)throw new PaymentError(409,'Registra explícitamente la decisión sin reintegro antes de resolver.')
        await model.update({where:{id},data:{status:'RESOLVED',...(type==='RETURN'?{resolvedAt:await now(tx)}:{})}})
        if(type==='RETURN')await tx.returnItem.updateMany({where:{returnRequestId:id,state:'RECEIVED'},data:{state:'RESOLVED'}})
        await tx.auditEvent.create({data:{actorId:adminId,actorType:'ADMIN',action:'RESOLVE_CLAIM',entityType:type,entityId:id,reason,correlationId:`resolve:${id}`}})
        return{id,resolved:true}
      })
    },
  }
}
