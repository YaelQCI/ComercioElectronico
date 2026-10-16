import { getDatabase } from '../../utils/database.js'
import { createCheckout } from './prepare-order.js'
import { AccountError } from '../accounts/credentials.js'
import { accountIdentity } from '../accounts/account-http.js'
import { guestCartHash, requireCartOrigin } from '../cart/cart-http.js'
import { CartError } from '../cart/cart-repository.js'
import { ShippingError } from '../shipping/shipping-quotes.js'
import { limitRequest, RequestLimitError } from '../../utils/request-limit.js'
import { stripePaymentReady } from '../payments/stripe-configuration.js'
export async function checkoutRequest(event, guest = false) {
  setHeader(event,'Cache-Control','no-store'); requireCartOrigin(event)
  try {
    const db=getDatabase(),service=createCheckout(db,useRuntimeConfig(event).authSecret),input=await readBody(event)
    if(guest)return{order:await service.guestRead(input?.token)}
    const hash=guestCartHash(event),identity=await accountIdentity(event,false)
    await limitRequest(db,`checkout:${hash??getRequestIP(event,{xForwardedFor:false})}`,5)
    const result=await service.prepare(hash,identity?.user.id,input),config=useRuntimeConfig(event)
    return {...result,paymentEnabled:stripePaymentReady(config)}
  }catch(e){const known=e instanceof AccountError||e instanceof CartError||e instanceof ShippingError||e instanceof RequestLimitError;throw createError({statusCode:known?e.status:503,statusMessage:known?e.message:'No pudimos preparar el pedido. Conservamos tu carrito.'})}
}
