import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHmac}from'node:crypto'
import{createStripeClient,verifyStripeEvent}from'../../server/features/payments/stripe-client.js'
const base={orderId:randomUUID(),attemptId:randomUUID(),amountCents:'2500',orderNumber:'FIXTURE',expiresAtSeconds:Math.floor(Date.now()/1000)+1860,idempotencyKey:'fixture:key'}
const response=(overrides={})=>({id:'cs_test_fixture',object:'checkout.session',mode:'payment',currency:'mxn',livemode:false,amount_total:2500,status:'open',payment_status:'unpaid',payment_method_types:['card'],expires_at:base.expiresAtSeconds,payment_intent:null,metadata:{orderId:base.orderId,attemptId:base.attemptId},url:'https://checkout.stripe.com/c/pay/fixture',...overrides})
test('Checkout solo tarjetas/MXN, claves estables, URLs propias y operaciones fijas',async()=>{
  const calls=[],client=createStripeClient({secretKey:'sk_test_fixture',siteUrl:'http://localhost:3000',fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(response())}})
  await client.createSession(base);await client.createSession(base);await client.session('cs_test_fixture');await client.expire('cs_test_fixture','expire:fixture')
  const fields=new URLSearchParams(calls[0].options.body)
  assert.equal(fields.get('mode'),'payment');assert.equal(fields.get('payment_method_types[0]'),'card');assert.equal(fields.get('line_items[0][price_data][currency]'),'mxn');assert.equal(fields.get('line_items[0][price_data][unit_amount]'),'2500')
  assert.equal(fields.get('allow_promotion_codes'),null);assert.match(fields.get('success_url'),/^http:\/\/localhost:3000\/pago\?pedido=/)
  assert.equal(calls[0].options.body,calls[1].options.body);assert.equal(calls[0].options.headers['Idempotency-Key'],'fixture:key')
  assert.equal(calls[0].options.headers['Stripe-Version'],'2025-09-30.clover')
  assert.ok(calls.every(c=>c.url.startsWith('https://api.stripe.com/v1/checkout/sessions')))
  await assert.rejects(client.session('https://example.invalid'))
  assert.throws(()=>createStripeClient({secretKey:'sk_live_fixture',environment:'test',siteUrl:'https://example.invalid'}))
  assert.throws(()=>createStripeClient({secretKey:'sk_live_fixture',environment:'live',siteUrl:'http://localhost:3000'}))
  assert.throws(()=>createStripeClient({secretKey:'sk_test_fixture',siteUrl:'https://example.invalid/path'}))
})
test('respuestas/errores no exponen secretos ni habilitan otros métodos o destinos',async()=>{
  for(const overrides of [{currency:'usd'},{livemode:true},{payment_method_types:['card','paypal']},{url:'https://example.invalid/pay'},{amount_total:1.1}]){
    const client=createStripeClient({secretKey:'sk_test_fixture',siteUrl:'http://localhost:3000',fetchImpl:async()=>Response.json(response(overrides))})
    await assert.rejects(client.createSession(base))
  }
  const client=createStripeClient({secretKey:'sk_test_SECRET',siteUrl:'http://localhost:3000',fetchImpl:async()=>{throw Error('sk_test_SECRET provider data')}})
  await assert.rejects(client.createSession(base),e=>e.status===503&&!e.message.includes('SECRET'))
})
test('firma sobre bytes originales, rotación, replay, cuerpo alterado y separación de entorno',()=>{
  const secret='whsec_fixture_secret',now=Date.now(),time=Math.floor(now/1000),event={id:'evt_fixture',type:'checkout.session.completed',created:time,livemode:false,data:{object:{id:'cs_test_fixture'}}},raw=Buffer.from(JSON.stringify(event))
  const sign=t=>createHmac('sha256',secret).update(`${t}.`).update(raw).digest('hex'),signature=`t=${time},v1=${sign(time)}`
  assert.equal(verifyStripeEvent(raw,signature,secret,'test',now).id,'evt_fixture')
  assert.equal(verifyStripeEvent(raw,`t=${time},v1=${'0'.repeat(64)},v1=${sign(time)}`,secret,'test',now).id,'evt_fixture')
  assert.throws(()=>verifyStripeEvent(Buffer.concat([raw,Buffer.from(' ')]),signature,secret,'test',now))
  assert.throws(()=>verifyStripeEvent(raw,`t=${time-301},v1=${sign(time-301)}`,secret,'test',now))
  assert.throws(()=>verifyStripeEvent(raw,signature,secret,'live',now))
  assert.throws(()=>verifyStripeEvent(raw,`t=${time},t=${time},v1=${sign(time)}`,secret,'test',now))
})
test('reembolso exige referencia, cantidad exacta y clave; conserva estado pendiente',async()=>{
  let fields,key
  const client=createStripeClient({secretKey:'sk_test_fixture',siteUrl:'http://localhost:3000',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.stripe.com/v1/refunds');fields=new URLSearchParams(options.body);key=options.headers['Idempotency-Key'];return Response.json({id:'re_fixture',payment_intent:'pi_fixture',amount:1000,currency:'mxn',status:'pending'})}})
  const result=await client.refund({paymentIntentId:'pi_fixture',amountCents:'1000',idempotencyKey:'refund:fixture'})
  assert.equal(result.status,'pending');assert.equal(fields.get('amount'),'1000');assert.equal(key,'refund:fixture')
})
test('consulta reembolso pendiente por su referencia sin crear un segundo reintegro',async()=>{
  const client=createStripeClient({secretKey:'sk_test_fixture',siteUrl:'http://localhost:3000',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.stripe.com/v1/refunds/re_fixture');assert.equal(options.method,'GET');return Response.json({id:'re_fixture',payment_intent:'pi_fixture',amount:1000,currency:'mxn',status:'succeeded'})}})
  const result=await client.refundStatus('re_fixture');assert.equal(result.status,'succeeded');assert.equal(result.paymentIntentId,'pi_fixture')
})
