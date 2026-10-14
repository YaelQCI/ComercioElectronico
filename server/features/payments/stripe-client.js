import { createHmac, timingSafeEqual } from 'node:crypto'

import {createHash} from 'node:crypto'

export class PaymentError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
export const paymentId = id => {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id ?? '')) throw new PaymentError(400, 'Identificador de pago inválido.')
  return id
}
function providerId(value, prefix) {
  if (typeof value !== 'string' || !new RegExp(`^${prefix}_[A-Za-z0-9_]{1,200}$`).test(value)) throw new PaymentError(502, 'Referencia Stripe inválida.')
  return value
}
function amount(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,11}$/.test(value)) throw new PaymentError(400, 'Importe Stripe inválido.')
  return value
}
function siteOrigin(value, environment) {
  let url
  try { url = new URL(value) } catch { throw new PaymentError(503, 'URL de retorno Stripe pendiente de configurar.') }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(environment === 'test' && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) throw new PaymentError(503, 'URL de retorno Stripe inválida.')
  return url.origin
}
export function stripeSession(data, environment) {
  providerId(data?.id, 'cs')
  if (data.object !== 'checkout.session' || data.mode !== 'payment' || data.currency !== 'mxn' || data.livemode !== (environment === 'live') || !Number.isSafeInteger(data.amount_total) || data.amount_total < 1 || !['open','complete','expired'].includes(data.status) || !['paid','unpaid','no_payment_required'].includes(data.payment_status) || !Array.isArray(data.payment_method_types) || data.payment_method_types.length !== 1 || data.payment_method_types[0] !== 'card' || !Number.isSafeInteger(data.expires_at)) throw new PaymentError(502, 'Respuesta Stripe incompatible con el pedido.')
  const intent = typeof data.payment_intent === 'string' ? providerId(data.payment_intent,'pi') : null
  let url = null
  if (data.url) {
    const parsed = new URL(data.url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'checkout.stripe.com' || parsed.username || parsed.password) throw new PaymentError(502, 'Destino Stripe no autorizado.')
    url = data.url
  }
  return { id:data.id, orderId:data.metadata?.orderId ?? null, attemptId:data.metadata?.attemptId ?? null, amountCents:String(data.amount_total), currency:'MXN', status:data.status, paymentStatus:data.payment_status, paymentIntentId:intent, expiresAt:new Date(data.expires_at*1000), url }
}
export function createStripeClient({ secretKey, environment = 'test', siteUrl, fetchImpl = fetch }) {
  if (!['test','live'].includes(environment) || typeof secretKey !== 'string' || !secretKey.startsWith(`sk_${environment}_`) || /\s/.test(secretKey)) throw new PaymentError(503, 'Stripe pendiente de configurar para este entorno.')
  const origin = siteOrigin(siteUrl,environment)
  async function request(path, method = 'GET', fields, key) {
    // Fixed host and allowlisted methods; never accept a URL from the browser or provider.
    try {
      const response = await fetchImpl(`https://api.stripe.com/v1/${path}`, { method, redirect:'error', signal:AbortSignal.timeout(15000), headers:{ Authorization:`Bearer ${secretKey}`, 'Stripe-Version':'2025-09-30.clover', ...(fields ? {'Content-Type':'application/x-www-form-urlencoded'} : {}), ...(key ? {'Idempotency-Key':key} : {}) }, ...(fields ? {body:new URLSearchParams(fields).toString()} : {}) })
      if (!response.ok || !response.body) throw new Error('Proveedor no disponible')
      const reader=response.body.getReader(),chunks=[];let size=0
      try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();throw new Error('Respuesta excesiva')}chunks.push(value)} } finally {reader.releaseLock()}
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch { throw new PaymentError(503,'Stripe no respondió de forma concluyente. Conservamos el intento para reconciliarlo; vuelve a consultar su estado.') }
  }
  return Object.freeze({
    origin,
    environment,
    scope:createHash('sha256').update(secretKey).digest('hex'),
    async createSession(input) {
      paymentId(input.orderId);paymentId(input.attemptId);amount(input.amountCents)
      if (!Number.isInteger(input.expiresAtSeconds) || typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9:_-]{1,200}$/.test(input.idempotencyKey)) throw new PaymentError(400,'Intento Stripe inválido.')
      const fields={mode:'payment',locale:'es', 'payment_method_types[0]':'card', 'line_items[0][quantity]':'1', 'line_items[0][price_data][currency]':'mxn', 'line_items[0][price_data][unit_amount]':input.amountCents, 'line_items[0][price_data][product_data][name]':`Pedido ${input.orderNumber}`, 'metadata[orderId]':input.orderId,'metadata[attemptId]':input.attemptId,'payment_intent_data[metadata][orderId]':input.orderId,'payment_intent_data[metadata][attemptId]':input.attemptId, client_reference_id:input.orderId,expires_at:String(input.expiresAtSeconds),success_url:`${origin}/pago?pedido=${input.orderId}`,cancel_url:`${origin}/pago?pedido=${input.orderId}&cancelado=1`}
      return stripeSession(await request('checkout/sessions','POST',fields,input.idempotencyKey),environment)
    },
    async session(id) { providerId(id,'cs');return stripeSession(await request(`checkout/sessions/${id}`),environment) },
    async expire(id,key) {providerId(id,'cs');return stripeSession(await request(`checkout/sessions/${id}/expire`,'POST',{},key),environment)},
    async refund({paymentIntentId,amountCents,idempotencyKey}) {
      providerId(paymentIntentId,'pi');amount(amountCents)
      if(typeof idempotencyKey!=='string'||!/^[A-Za-z0-9:_-]{1,200}$/.test(idempotencyKey))throw new PaymentError(400,'Clave de reembolso inválida.')
      const data=await request('refunds','POST',{payment_intent:paymentIntentId,amount:amountCents},idempotencyKey)
      providerId(data.id,'re')
      if(data.payment_intent!==paymentIntentId||data.amount!==Number(amountCents)||data.currency!=='mxn'||!['succeeded','pending','failed','canceled','requires_action'].includes(data.status))throw new PaymentError(502,'Reembolso Stripe incompatible.')
      return{id:data.id,status:data.status,amountCents:String(data.amount),currency:'MXN'}
    },
    async refundStatus(id) {
      providerId(id,'re')
      const data=await request(`refunds/${id}`)
      if(data.id!==id||data.currency!=='mxn'||!Number.isSafeInteger(data.amount)||data.amount<1||!['succeeded','pending','failed','canceled','requires_action'].includes(data.status))throw new PaymentError(502,'Estado de reembolso Stripe incompatible.')
      return{id,status:data.status,amountCents:String(data.amount),currency:'MXN',paymentIntentId:providerId(data.payment_intent,'pi')}
    },
  })
}
export function verifyStripeEvent(raw, signature, secret, environment = 'test', now = Date.now()) {
  if(typeof secret!=='string'||!secret.startsWith('whsec_')||secret.length<12||!['test','live'].includes(environment))throw new PaymentError(503,'Webhook Stripe pendiente de configurar.')
  if(!Buffer.isBuffer(raw)||raw.length>1048576||typeof signature!=='string'||signature.length>4096)throw new PaymentError(400,'Webhook inválido.')
  const fields=signature.split(',').map(v=>v.trim().split('=')),times=fields.filter(f=>f[0]==='t'),signatures=fields.filter(f=>f[0]==='v1').map(f=>f[1])
  const time=Number(times[0]?.[1])
  if(times.length!==1||!/^\d+$/.test(times[0][1])||!Number.isSafeInteger(time)||Math.abs(Math.floor(now/1000)-time)>300)throw new PaymentError(400,'Firma webhook inválida o vencida.')
  const expected=createHmac('sha256',secret).update(`${time}.`).update(raw).digest()
  if(!signatures.some(s=>/^[a-f0-9]{64}$/.test(s??'')&&timingSafeEqual(expected,Buffer.from(s,'hex'))))throw new PaymentError(400,'Firma webhook inválida.')
  let event;try{event=JSON.parse(raw.toString('utf8'))}catch{throw new PaymentError(400,'Webhook inválido.')}
  providerId(event?.id,'evt')
  if(typeof event.type!=='string'||!Number.isSafeInteger(event.created)||event.created<0||event.created>time+300||event.livemode!==(environment==='live')||!event.data?.object)throw new PaymentError(400,'Evento Stripe inválido para este entorno.')
  return event
}
