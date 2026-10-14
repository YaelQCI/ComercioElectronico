import assert from'node:assert/strict'
import{spawn}from'node:child_process'
import{randomUUID,randomBytes,createHmac}from'node:crypto'
import{PrismaClient}from'../generated/prisma/client.ts'
import{PrismaPg}from'@prisma/adapter-pg'
import{paymentFixture}from'../tests/database/payment-fixture.mjs'
const database=process.env.TEST_DATABASE_URL
if(!database||!new URL(database).pathname.startsWith('/fitness_migration_test'))throw Error('Usar base aislada TEST_DATABASE_URL.')
const origin='http://127.0.0.1:3052',secret='whsec_synthetic_http_only'
const db=new PrismaClient({adapter:new PrismaPg({connectionString:database,options:'-c timezone=UTC'})})
const server=spawn(process.execPath,['.output/server/index.mjs'],{windowsHide:true,stdio:'ignore',env:{...process.env,DATABASE_URL:database,NUXT_AUTH_SECRET:randomBytes(32).toString('base64'),NUXT_STRIPE_ENABLED:'true',NUXT_STRIPE_ENVIRONMENT:'test',NUXT_STRIPE_SECRET_KEY:'sk_test_not_a_real_key',NUXT_STRIPE_WEBHOOK_SECRET:secret,NUXT_STRIPE_SITE_URL:origin,NITRO_HOST:'127.0.0.1',NITRO_PORT:'3052'}})
async function post(path,body,headers={}){return fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)})}
try{
  let ready=false
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,200))}
  assert.ok(ready,'Servidor de pruebas no disponible')
  const orderId=randomUUID()
  assert.equal((await post('/api/payments/start',{orderId,acceptedTotalCents:'1000'},{Origin:'https://example.invalid'})).status,403)
  const status=await post('/api/payments/status',{orderId});assert.equal(status.status,404)
  const f=await paymentFixture(db)
  const own=await post('/api/payments/status',{orderId:f.prepared.orderId,guestToken:f.prepared.guestToken});assert.equal(own.status,200);assert.equal(own.headers.get('cache-control'),'no-store');assert.equal((await own.json()).moneyStatus,'PENDING')
  assert.equal((await post('/api/payments/start',{orderId,acceptedTotalCents:'1000'})).status,404)
  const time=Math.floor(Date.now()/1000),body={id:`evt_${randomUUID().replaceAll('-','')}`,type:'fixture.unsupported',created:time,livemode:false,data:{object:{id:'fixture'}}},raw=JSON.stringify(body)
  const signature=`t=${time},v1=${createHmac('sha256',secret).update(`${time}.${raw}`).digest('hex')}`
  assert.equal((await post('/api/payments/stripe/webhook',body,{'Stripe-Signature':'invalid'})).status,400)
  assert.equal((await post('/api/payments/stripe/webhook',body,{'Stripe-Signature':signature})).status,200)
  assert.equal((await post('/api/payments/stripe/webhook',body,{'Stripe-Signature':signature})).status,200)
  const altered=await fetch(origin+'/api/payments/stripe/webhook',{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':signature},body:raw+' '});assert.equal(altered.status,400)
  const page=await fetch(origin+`/pago?pedido=${orderId}`);assert.equal(page.status,200);assert.match(await page.text(),/Estado del pago/)
  console.log('HTTP: Origin, propiedad, no-store, firma sobre cuerpo original, duplicados y ruta SSR correctos; sin llamadas a Stripe.')
}finally{server.kill();await db.$disconnect()}
