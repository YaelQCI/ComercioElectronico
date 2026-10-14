import { getDatabase } from '../../../../utils/database.js'
import { createStripeClient,PaymentError } from '../../../../features/payments/stripe-client.js'
import { submitStripeRefund } from '../../../../features/payments/stripe-refunds.js'
import { accountIdentity } from '../../../../features/accounts/account-http.js'
import { AccountError } from '../../../../features/accounts/credentials.js'
import { requireCartOrigin } from '../../../../features/cart/cart-http.js'
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','no-store');requireCartOrigin(event)
  try{
    const config=useRuntimeConfig(event)
    if(config.stripeEnabled!==true&&config.stripeEnabled!=='true')throw new PaymentError(503,'Pago pendiente de habilitar.')
    const identity=await accountIdentity(event),stripe=createStripeClient({secretKey:config.stripeSecretKey,environment:config.stripeEnvironment,siteUrl:config.stripeSiteUrl})
    return await submitStripeRefund(getDatabase(),stripe,identity.user.id,getRouterParam(event,'id'))
  }catch(e){const known=e instanceof PaymentError||e instanceof AccountError;throw createError({statusCode:known?e.status:503,statusMessage:known?e.message:'Reembolso pendiente de reconciliación.'})}
})
