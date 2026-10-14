import { createHash, createHmac, randomUUID } from 'node:crypto'
import { AccountError, emailAddress, accountText, secretHash } from '../accounts/credentials.js'
import { checkoutCart } from '../cart/cart-repository.js'
import { prepareShipping } from '../shipping/shipping-quotes.js'
import { cartCouponLines } from '../coupons/cart-coupon.js'
import { allocateCents } from '../../../shared/features/pricing/prices.js'
import { shippingProgress } from '../../../shared/features/shipping/shipping-policy.js'
const hash = value => createHash('sha256').update(value).digest('hex')
export function checkoutContact(input) {
  const email = emailAddress(input?.email), address = { countryCode: 'MX' }
  for (const key of ['recipientName','phone','postalCode','state','city','district','street','exteriorNumber']) address[key] = accountText(input?.address?.[key], key, 200)
  if (!/^\d{5}$/.test(address.postalCode) || !/^[A-Z]{2}$/.test(address.state)) throw new AccountError(400, 'Código postal o código estatal inválido.')
  for (const key of ['interiorNumber','references']) address[key] = input.address[key] ? accountText(input.address[key], key, 250) : null
  return { email, address }
}
export function createCheckout(db, secret) {
  function accessToken(orderId, ownerHash) {
    if (!/^[A-Za-z0-9+/]{43}=$/.test(secret ?? '')) throw new AccountError(503, 'Acceso al pedido pendiente de configurar.')
    return createHmac('sha256', Buffer.from(secret,'base64')).update(`guest-order:${orderId}:${ownerHash}`).digest('hex')
  }
  function result(order, ownerHash) { return { orderId: order.id, number: order.orderNumber, totalMoneyCents: order.totalMoneyCents.toString(), currency: order.currency, status: order.status, guestToken: accessToken(order.id,ownerHash), paymentEnabled: false, stockReserved: false } }
  return {
    async prepare(ownerHash, userId, input) {
      if (!/^[a-f0-9]{64}$/.test(ownerHash ?? '') || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input?.idempotencyKey ?? '') || !Number.isInteger(input?.cartVersion) || input.cartVersion < 1 || !/^(0|[1-9]\d{0,14})$/.test(input?.expectedTotalCents ?? '') || input.accepted !== true) throw new AccountError(400, 'Falta carrito, clave, importe o aceptación válida.')
      if (input.requestedPointsTenths && input.requestedPointsTenths !== '0') throw new AccountError(409, 'Canje en checkout pendiente de integrar.')
      const contact = checkoutContact(input), eventKey = `draft:${hash(`${ownerHash}:${input.idempotencyKey}`)}`, requestHash = hash(JSON.stringify({ ...contact, userId: userId ?? null, cartVersion: input.cartVersion, quoteId: input.quoteId, total: input.expectedTotalCents }))
      // Validate secret before beginning any write, including guest checkout.
      accessToken(randomUUID(), ownerHash)
      return db.$transaction(async tx => {
        if (userId) { await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR SHARE`; if (!await tx.user.findFirst({ where:{ id:userId,deletedAt:null } })) throw new AccountError(401,'Cuenta no disponible.') }
        await tx.$queryRaw`SELECT id FROM "Cart" WHERE "guestTokenHash" = ${ownerHash} FOR UPDATE`
        const prior = await tx.orderStatusHistory.findUnique({ where: { eventKey }, include: { order: true } })
        if (prior) { if (prior.reason !== requestHash) throw new AccountError(409,'Clave utilizada para otros datos.'); return result(prior.order,ownerHash) }
        const { cart, items, current } = await checkoutCart(tx,ownerHash)
        if (cart.version !== input.cartVersion) throw new AccountError(409,'El carrito cambió. Revisa y acepta el importe vigente.')
        const a = contact.address, destination = { country:'MX', name:a.recipientName,phone:a.phone,postalCode:a.postalCode,state:a.state,city:a.city,street:a.street }
        const prepared = await prepareShipping(tx,ownerHash,destination)
        const quote = await tx.shippingQuote.findFirst({ where:{ id:input.quoteId,cartId:cart.id,status:'ACCEPTED' } })
        if (!quote || quote.requestFingerprint !== prepared.fingerprint || Date.now()-quote.quotedAt.getTime()>600000 || (quote.expiresAt && quote.expiresAt <= new Date())) throw new AccountError(409,'Cotiza y acepta de nuevo el envío para esta dirección y carrito.')
        const shipping = shippingProgress(current.totals.goodsAfterCouponCents,quote.quotedAmountCents.toString()), total = BigInt(current.totals.goodsMoneyCents)+BigInt(shipping.chargedAmountCents)
        if (total !== BigInt(input.expectedTotalCents)) throw new AccountError(409,'El importe cambió. Revisa y acepta el total vigente.')
        const policies = await tx.contentPage.findMany({ where:{ slug:{in:['privacidad','terminos','devoluciones']},publishedAt:{lte:new Date()} },orderBy:{slug:'asc'} })
        if (policies.length !== 3) throw new AccountError(503,'Las políticas deben aprobarse y publicarse antes de preparar pedidos.')
        const order = await tx.order.create({ data:{ orderNumber:`TFS-${randomUUID()}`,userId:userId??null,buyerEmail:contact.email,buyerEmailNormalized:contact.email,buyerName:a.recipientName,sourceCartId:cart.id,goodsBeforeCouponCents:BigInt(current.totals.goodsBeforeCouponCents),couponDiscountCents:BigInt(current.totals.couponDiscountCents),goodsAfterCouponCents:BigInt(current.totals.goodsAfterCouponCents),pointsAppliedTenths:0n,goodsMoneyCents:BigInt(current.totals.goodsMoneyCents),shippingQuotedCents:quote.quotedAmountCents,shippingChargedCents:BigInt(shipping.chargedAmountCents),shippingSubsidyCents:BigInt(shipping.subsidyCents),totalMoneyCents:total,couponId:cart.selectedCouponId,couponSnapshot:cart.selectedCoupon ? {code:cart.selectedCoupon.code,version:cart.selectedCoupon.version} : undefined,policySnapshot:{ pages:policies.map(p=>({slug:p.slug,version:p.version,title:p.title,content:p.content})),cartVersion:cart.version,sourceLines:items.map(i=>({id:i.id,quantity:i.quantity})) } } })
        const savedQuote = await tx.shippingQuote.create({ data:{ orderId:order.id,requestFingerprint:quote.requestFingerprint,provider:quote.provider,carrierCode:quote.carrierCode,serviceCode:quote.serviceCode,serviceName:quote.serviceName,quotedAmountCents:quote.quotedAmountCents,currency:quote.currency,originSnapshot:quote.originSnapshot,destinationSnapshot:quote.destinationSnapshot,packageSnapshot:quote.packageSnapshot,sanitizedResponse:quote.sanitizedResponse,status:'ACCEPTED',quotedAt:quote.quotedAt,expiresAt:quote.expiresAt } })
        await tx.orderAddress.create({data:{orderId:order.id,...a}})
        const parcel = prepared.parcel, warehouse = await tx.warehouse.findUnique({where:{singletonKey:1}})
        await tx.orderPackage.create({data:{orderId:order.id,quoteId:savedQuote.id,warehouseId:warehouse.id,packageTypeId:parcel.packageTypeId,originSnapshot:prepared.origin,packageCodeSnapshot:parcel.packageCode,weightGrams:parcel.grossWeightGrams,lengthMm:parcel.lengthMm,widthMm:parcel.widthMm,heightMm:parcel.heightMm,packingPlanSnapshot:parcel,carrierSnapshot:{code:quote.carrierCode},serviceSnapshot:{code:quote.serviceCode,name:quote.serviceName},deliveryEstimateSnapshot:{estimate:quote.sanitizedResponse.deliveryEstimate??null},acceptedAt:new Date()}})
        const pricing = cartCouponLines(items)
        for (const [position,item] of items.entries()) {
          const linePrice = current.totals.lines.find(l=>l.id===item.id), coupon = current.coupon?.lines.find(l=>l.id===item.id)
          const line = await tx.orderLine.create({data:{orderId:order.id,position,variantId:item.variantId,bundleId:item.bundleId,kind:item.variantId?'VARIANT':'BUNDLE',quantity:item.quantity,nameSnapshot:item.variant?.product.name??item.bundle.name,skuOrCodeSnapshot:item.variant?.sku??item.bundle.code,unitPriceCents:item.variant?.priceCents??item.bundle.priceCents,lineBeforeCouponCents:BigInt(linePrice.baseCents),couponDiscountCents:BigInt(linePrice.couponCents),lineAfterCouponCents:BigInt(linePrice.baseCents)-BigInt(linePrice.couponCents),compositionVersionSnapshot:item.bundle?.compositionVersion}})
          const parts = item.variant ? [{variant:item.variant,quantity:1}] : item.bundle.bundleComponent_bundle
          for (const part of parts) {
            const v = part.variant, base = BigInt(pricing[position].components.find(c=>c.id===v.id).allocatedBaseCents), discount = BigInt(coupon?.components.find(c=>c.id===v.id)?.cents??'0'), count=part.quantity*item.quantity
            const component = await tx.orderComponent.create({data:{orderId:order.id,orderLineId:line.id,variantId:v.id,quantityPerLineUnit:part.quantity,totalQuantity:count,productSnapshot:{id:v.product.id,name:v.product.name,categoryIds:v.product.productCategory_product.map(c=>c.categoryId)},variantSnapshot:{sku:v.sku,flavor:v.flavor,presentation:v.presentationLabel,compareAtPriceCents:v.compareAtPriceCents?.toString()??null},referenceUnitPriceCents:v.priceCents,allocatedBaseCents:base,allocatedCouponCents:discount,allocatedNetCents:base-discount}})
            const weights=Array.from({length:count},(_,i)=>({id:String(i+1).padStart(12,'0'),weightCents:'1'})), bases=allocateCents(base,weights), discounts=allocateCents(discount,bases.map(b=>({id:b.id,weightCents:b.cents})))
            for(let index=0;index<count;index++){const b=BigInt(bases[index].cents),d=BigInt(discounts[index].cents);await tx.orderUnit.create({data:{orderId:order.id,orderComponentId:component.id,variantId:v.id,unitOrdinal:index+1,baseCents:b,couponCents:d,netGoodsCents:b-d,pointsTenths:0n,moneyCents:b-d}})}
          }
        }
        await tx.orderStatusHistory.create({data:{orderId:order.id,fromStatus:null,toStatus:'PENDING_PAYMENT',actorType:'SYSTEM',reason:requestHash,eventKey}})
        await tx.actionToken.create({data:{purpose:'GUEST_ORDER_ACCESS',tokenHash:secretHash(accessToken(order.id,ownerHash)),emailNormalized:contact.email,orderId:order.id,expiresAt:new Date(Date.now()+7*86400000)}})
        return result(order,ownerHash)
      },{timeout:30000})
    },
    async guestRead(token) {
      if(!/^[a-f0-9]{64}$/.test(token??''))throw new AccountError(404,'Pedido no disponible.')
      const proof=await db.actionToken.findFirst({where:{purpose:'GUEST_ORDER_ACCESS',tokenHash:secretHash(token),expiresAt:{gt:new Date()},consumedAt:null},include:{order:true}})
      if(!proof?.order)throw new AccountError(404,'Pedido no disponible.')
      const o=proof.order;return{number:o.orderNumber,status:o.status,moneyStatus:o.moneyStatus,totalMoneyCents:o.totalMoneyCents.toString(),currency:o.currency}
    },
  }
}
