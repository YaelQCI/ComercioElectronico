import { spawnSync } from 'node:child_process'
const url=process.env.TEST_DATABASE_URL
if(!url||new URL(url).pathname!=='/fitness_migration_test_docker'||process.env.DATABASE_URL!==url)throw Error('Pruebas Docker requieren su base aislada.')
const migration=spawnSync('npm',['run','db:deploy'],{stdio:'inherit'})
if(migration.error)throw migration.error
if(migration.status!==0)process.exit(migration.status??1)
// Las pruebas existentes requieren almacén base: solo en la DB sintética aislada.
const {PrismaClient}=await import('../generated/prisma/client.ts')
const {PrismaPg}=await import('@prisma/adapter-pg')
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url,options:'-c timezone=UTC'})})
try{
  await db.warehouse.upsert({where:{singletonKey:1},update:{},create:{name:'Almacén sintético Docker; no comercial',recipientName:'Fixture',contactName:'Fixture',phone:'0000000000',postalCode:'01000',state:'CX',city:'Fixture',district:'Fixture',street:'Fixture',exteriorNumber:'1'}})
  await db.$queryRaw`SELECT initialize_demo_catalog_stock()`
  await db.$queryRaw`SELECT initialize_demo_customers_orders_reviews()`
}finally{await db.$disconnect()}
for(const [command,args] of [
  ['node',['--test','tests/catalog/*.test.mjs','tests/pricing/*.test.mjs','tests/payments/*.test.mjs','tests/accounts/*.test.mjs','tests/appearance/*.test.mjs']],
  ['npm',['run','test:database']],
]){
  const result=spawnSync(command,args,{stdio:'inherit'})
  if(result.error)throw result.error
  if(result.status!==0)process.exit(result.status??1)
}
