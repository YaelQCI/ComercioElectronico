import { getDatabase } from '../../utils/database.js'
import { accountIdentity } from '../accounts/account-http.js'
import { AccountError } from '../accounts/credentials.js'
import { requireCartOrigin } from '../cart/cart-http.js'
import { PaymentError } from '../payments/stripe-client.js'
import { createAfterSales } from './claims.js'
export async function claimRequest(event,admin=false){
  setHeader(event,'Cache-Control','no-store')
  requireCartOrigin(event)
  try{
    const input=await readBody(event),identity=await accountIdentity(event,admin),service=createAfterSales(getDatabase())
    if(admin){
      const id=getRouterParam(event,'id'),userId=identity.user.id
      if(input.action==='inspect')return await service.inspect(userId,input.type,id)
      if(input.action==='review')return await service.review(userId,input.type,id,input)
      if(input.action==='receive'&&input.type==='RETURN')return await service.receive(userId,id,input)
      if(input.action==='resolve')return await service.resolve(userId,input.type,id,input)
      throw new PaymentError(400,'Operación inválida.')
    }
    const owner={userId:identity?.user.id,guestToken:input.guestToken??getCookie(event,'fitness_guest_order')}
    if(input.action==='list')return await service.list(input.orderId,owner)
    if(input.action==='request')return await service.request(input.orderId,owner,input.type,input)
    throw new PaymentError(400,'Operación inválida.')
  }catch(e){const known=e instanceof AccountError||e instanceof PaymentError;throw createError({statusCode:known?e.status:503,statusMessage:known?e.message:'No pudimos procesar la solicitud. Consulta su estado antes de reintentar.'})}
}
