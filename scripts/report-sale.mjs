// Lectura únicamente: no crea sesiones, cargos, reintegros ni movimientos.
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
const [orderId,...extra]=process.argv.slice(2)
if(extra.length||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(orderId??''))throw Error('Uso: node scripts/report-sale.mjs UUID_PEDIDO. Solo lectura.')
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL,options:'-c timezone=UTC'})})
try{
  const report=await db.$transaction(async tx=>{
    const order=await tx.order.findUnique({where:{id:orderId}})
    if(!order)throw Error('Pedido no disponible.')
    const payments=await tx.paymentAttempt.findMany({where:{orderId,appliedToOrder:true}}),units=await tx.orderUnit.findMany({where:{orderId}}),sales=await tx.inventoryMovement.findMany({where:{orderUnit:{orderId},kind:'SALE'}})
    const saleIds=new Set(sales.map(s=>s.orderUnitId))
    const consistent=payments.length===1&&payments[0].status==='SUCCEEDED'&&payments[0].amountCents===order.totalMoneyCents&&payments[0].currency===order.currency&&!!payments[0].providerPaymentIntentId&&units.length>0&&sales.length===units.length&&saleIds.size===units.length&&units.every(u=>saleIds.has(u.id))&&sales.every(s=>s.onHandDelta===-1&&s.reservedDelta===-1)&&['CONFIRMED','PREPARING','SHIPPED','DELIVERED'].includes(order.status)
    return{orderId,status:order.status,moneyStatus:order.moneyStatus,totalMoneyCents:order.totalMoneyCents.toString(),currency:order.currency,appliedPayments:payments.map(p=>({id:p.id,status:p.status,amountCents:p.amountCents.toString(),hasStripePaymentIntent:!!p.providerPaymentIntentId})),units:units.length,saleMovements:sales.length,consistentLocalRecords:consistent,livePaymentVerified:false,note:'La base por sí sola no acredita entorno live ni demostración. Verificar transacción en cuenta Stripe de producción y recorrido ejecutable con docente. Sin datos personales ni tarjeta.'}
  },{isolationLevel:'RepeatableRead'})
  console.log(JSON.stringify(report,null,2))
  if(!report.consistentLocalRecords)process.exitCode=1
}finally{await db.$disconnect()}
