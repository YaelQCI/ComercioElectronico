import { randomUUID } from 'node:crypto'
// Synthetic delivered zero-total order. No Stripe, no commercial data, all DB guards active.
export async function deliveredFixture(db, userId, { bundle = false } = {}) {
  return db.$transaction(async tx => {
    const code = randomUUID(), warehouse = await tx.warehouse.findFirst(), user = await tx.user.findUnique({ where: { id: userId } })
    const product = await tx.product.create({ data: { name: 'Producto sintético', description: 'Solo pruebas', slug: code, publishedAt: new Date() } })
    const variant = await tx.productVariant.create({ data: { productId: product.id, sku: code, flavor: 'Fixture', flavorNormalized: 'fixture', presentationLabel: 'Fixture', presentationNormalized: 'fixture', contentAmount: '100', contentUnit: 'g', priceCents: 0n, weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100 } })
    const lot = await tx.inventoryLot.create({ data: { variantId: variant.id, warehouseId: warehouse.id, lotCode: code, expiresOn: new Date('2030-01-31'), expiryPrecision: 'DAY' } })
    const order = await tx.order.create({ data: { orderNumber: code, userId, buyerEmail: user.email, buyerEmailNormalized: user.emailNormalized, buyerName: user.displayName, goodsBeforeCouponCents: 0n, couponDiscountCents: 0n, goodsAfterCouponCents: 0n, pointsAppliedTenths: 0n, goodsMoneyCents: 0n, shippingQuotedCents: 0n, shippingChargedCents: 0n, shippingSubsidyCents: 0n, totalMoneyCents: 0n, policySnapshot: {} } })
    const pack = bundle ? await tx.bundle.create({ data: { code, slug: `bundle-${code}`, name: 'Combo sintético', priceCents: 0n, bundleComponent_bundle: { create: { variantId: variant.id, quantity: 1 } } } }) : null
    const line = await tx.orderLine.create({ data: { orderId: order.id, position: 0, variantId: pack ? null : variant.id, bundleId: pack?.id, kind: pack ? 'BUNDLE' : 'VARIANT', compositionVersionSnapshot: pack?.compositionVersion, quantity: 1, nameSnapshot: product.name, skuOrCodeSnapshot: variant.sku, unitPriceCents: 0n, lineBeforeCouponCents: 0n, couponDiscountCents: 0n, lineAfterCouponCents: 0n } })
    const component = await tx.orderComponent.create({ data: { orderId: order.id, orderLineId: line.id, variantId: variant.id, quantityPerLineUnit: 1, totalQuantity: 1, productSnapshot: {}, variantSnapshot: {}, referenceUnitPriceCents: 0n, allocatedBaseCents: 0n, allocatedCouponCents: 0n, allocatedNetCents: 0n } })
    const unit = await tx.orderUnit.create({ data: { orderId: order.id, orderComponentId: component.id, variantId: variant.id, unitOrdinal: 1, baseCents: 0n, couponCents: 0n, netGoodsCents: 0n, pointsTenths: 0n, moneyCents: 0n, lotId: lot.id, lotSnapshot: {} } })
    const quote = await tx.shippingQuote.create({ data: { orderId: order.id, requestFingerprint: code, carrierCode: 'FIXTURE', serviceCode: 'FIXTURE', serviceName: 'Prueba', quotedAmountCents: 0n, originSnapshot: {}, destinationSnapshot: {}, packageSnapshot: {}, sanitizedResponse: {} } })
    const reservation = await tx.reservationSet.create({ data: { orderId: order.id, attemptNumber: 1, expiresAt: new Date(Date.now()+29*60000), acceptedQuoteId: quote.id, checkoutFingerprint: code, acceptedCheckoutSnapshot: {}, idempotencyKey: code } })
    const stock = await tx.reservationStock.create({ data: { reservationSetId: reservation.id, lotId: lot.id, quantity: 1 } })
    for (const data of [{ kind: 'RECEIPT', onHandDelta: 1, reservedDelta: 0 }, { kind: 'RESERVE', onHandDelta: 0, reservedDelta: 1, reservationStockId: stock.id }, { kind: 'SALE', onHandDelta: -1, reservedDelta: -1, reservationStockId: stock.id, orderUnitId: unit.id }]) await tx.inventoryMovement.create({ data: { lotId: lot.id, nonSellableDelta: 0, reason: 'Fixture', actorType: 'SYSTEM', idempotencyKey: randomUUID(), ...data } })
    await tx.orderAddress.create({ data: { orderId: order.id, recipientName: 'Fixture', phone: '0000000000', countryCode: 'MX', postalCode: '01000', state: 'Fixture', city: 'Fixture', district: 'Fixture', street: 'Fixture', exteriorNumber: '1' } })
    await tx.orderPackage.create({ data: { orderId: order.id, quoteId: quote.id, warehouseId: warehouse.id, originSnapshot: {}, packageCodeSnapshot: 'FIXTURE', weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 100, packingPlanSnapshot: {}, carrierSnapshot: {}, serviceSnapshot: {}, deliveryEstimateSnapshot: {}, acceptedAt: new Date() } })
    await tx.reservationSet.update({ where: { id: reservation.id }, data: { state: 'CONSUMED', resolvedAt: new Date() } })
    let from = 'PENDING_PAYMENT'
    for (const to of ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED']) {
      await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: from, toStatus: to, actorType: 'SYSTEM', eventKey: randomUUID() } })
      await tx.order.update({ where: { id: order.id }, data: { status: to, ...(to === 'CONFIRMED' ? { confirmedAt: new Date(), moneyStatus: 'NOT_REQUIRED' } : to === 'SHIPPED' ? { shippedAt: new Date() } : to === 'DELIVERED' ? { deliveredAt: new Date() } : {}) } })
      from = to
    }
    return { product, variant, unit, order, lot }
  }, { timeout: 30000 })
}
