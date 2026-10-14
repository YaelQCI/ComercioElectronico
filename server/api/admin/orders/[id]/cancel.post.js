import { getDatabase } from '../../../../utils/database.js'
import { accountIdentity } from '../../../../features/accounts/account-http.js'
import { AccountError } from '../../../../features/accounts/credentials.js'
import { requireCartOrigin } from '../../../../features/cart/cart-http.js'
import { PaymentError } from '../../../../features/payments/stripe-client.js'
import { cancelConfirmedOrder } from '../../../../features/payments/cancel-confirmed-order.js'
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','no-store');requireCartOrigin(event)
  try{const identity=await accountIdentity(event);return await cancelConfirmedOrder(getDatabase(),identity.user.id,getRouterParam(event,'id'),await readBody(event))}
  catch(e){const known=e instanceof AccountError||e instanceof PaymentError;throw createError({statusCode:known?e.status:503,statusMessage:known?e.message:'No pudimos cancelar el pedido. Consulta su estado antes de reintentar.'})}
})
