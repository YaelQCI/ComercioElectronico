import { getDatabase } from '../../utils/database.js'
import { createStripeClient, PaymentError } from './stripe-client.js'
import { createOrderPayments } from './order-payments.js'
import { receiveStripeEvent } from './stripe-events.js'
import { createEnviaRates } from '../shipping/envia-rates.js'
import { accountIdentity } from '../accounts/account-http.js'
import { AccountError } from '../accounts/credentials.js'
import { guestCartHash, requireCartOrigin } from '../cart/cart-http.js'
import { limitRequest, RequestLimitError } from '../../utils/request-limit.js'
export function configuredPayments(db,config) {
  const stripe=createStripeClient({secretKey:config.stripeSecretKey,environment:config.stripeEnvironment,siteUrl:config.stripeSiteUrl})
  const shipping={quote:input=>createEnviaRates({token:config.enviaToken,environment:config.enviaEnvironment,carrier:config.enviaCarrier}).quote(input)}
  return createOrderPayments(db,stripe,shipping,{minimumCents:config.stripeMinimumCents})
}
export async function paymentRequest(event,action) {
  setHeader(event,'Cache-Control','no-store')
  if(action!=='webhook')requireCartOrigin(event)
  try {
    const config=useRuntimeConfig(event),db=getDatabase()
    if(config.stripeEnabled!==true&&config.stripeEnabled!=='true')throw new PaymentError(503,'Pago pendiente de habilitar.')
    const payments=configuredPayments(db,config)
    if(action==='webhook') {
      const length=Number(getHeader(event,'content-length')??'0')
      if(length>1048576)throw new PaymentError(413,'Webhook demasiado grande.')
      const raw=await readRawBody(event,false)
      return await receiveStripeEvent(db,payments,{raw:Buffer.isBuffer(raw)?raw:Buffer.from(raw??''),signature:getHeader(event,'stripe-signature'),secret:config.stripeWebhookSecret,environment:config.stripeEnvironment})
    }
    const input=await readBody(event),identity=await accountIdentity(event,false),owner={userId:identity?.user.id,guestHash:guestCartHash(event),guestToken:input?.guestToken??getCookie(event,'fitness_guest_order')}
    if(action==='status')return await payments.status(input?.orderId,owner)
    await limitRequest(db,`payment:${identity?.user.id??guestCartHash(event)??getRequestIP(event,{xForwardedFor:false})}`,10)
    if(action==='start'){
      const result=await payments.start(input?.orderId,owner,input?.acceptedTotalCents)
      if(/^[a-f0-9]{64}$/.test(input?.guestToken??''))setCookie(event,'fitness_guest_order',input.guestToken,{httpOnly:true,secure:!import.meta.dev,sameSite:'lax',path:'/',maxAge:7*86400})
      return result
    }
    return await payments.cancel(input?.orderId,owner)
  }catch(e){const known=e instanceof PaymentError||e instanceof AccountError||e instanceof RequestLimitError;throw createError({statusCode:known?e.status:503,statusMessage:known?e.message:'No pudimos completar la operación de pago. Conservamos el intento para revisar su estado.'})}
}
