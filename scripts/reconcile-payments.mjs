import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { createStripeClient } from '../server/features/payments/stripe-client.js'
import { createOrderPayments } from '../server/features/payments/order-payments.js'
const apply=process.argv.slice(2)
if(apply.length>1||(apply.length===1&&apply[0]!=='--apply'))throw new Error('Uso: node scripts/reconcile-payments.mjs [--apply]. Sin --apply solo informa conteos.')
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL,options:'-c timezone=UTC'})})
try{
  const where={appliedToOrder:false,reservationSet:{state:{in:['ACTIVE','RECONCILING']}},status:{in:['PENDING','SESSION_CREATED','PROCESSING','RECONCILING','SUCCEEDED']}}
  if(!apply.length){console.log(JSON.stringify({pending:await db.paymentAttempt.count({where})}));}
  else {
    if(process.env.NUXT_STRIPE_ENABLED!=='true')throw new Error('Stripe no habilitado.')
    const stripe=createStripeClient({secretKey:process.env.NUXT_STRIPE_SECRET_KEY,environment:process.env.NUXT_STRIPE_ENVIRONMENT??'test',siteUrl:process.env.NUXT_STRIPE_SITE_URL})
    const payments=createOrderPayments(db,stripe,null,{minimumCents:process.env.NUXT_STRIPE_MINIMUM_CENTS??'1000'})
    console.log(JSON.stringify(await payments.sweep()))
  }
}finally{await db.$disconnect()}
