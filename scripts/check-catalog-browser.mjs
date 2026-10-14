import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
const database=process.env.TEST_DATABASE_URL
if(!database||!new URL(database).pathname.startsWith('/fitness_migration_test'))throw Error('Usar TEST_DATABASE_URL aislada fitness_migration_test*.')
const origin='http://127.0.0.1:3055'
const server=spawn(process.execPath,['.output/server/index.mjs'],{windowsHide:true,stdio:'ignore',env:{...process.env,DATABASE_URL:database,NUXT_AUTH_SECRET:randomBytes(32).toString('base64'),NUXT_STRIPE_ENABLED:'false',NITRO_HOST:'127.0.0.1',NITRO_PORT:'3055'}})
try{
  let ready=false
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,100))}
  if(!ready)throw Error('Servidor aislado no disponible.')
  const browser=spawn(process.execPath,['scripts/check-theme-browser.mjs'],{windowsHide:true,stdio:'inherit',env:{...process.env,TEST_HTTP_URL:origin,TEST_CATALOG_INTERACTIONS:'true',TEST_LAYOUT_AUDIT:'false'}})
  process.exitCode=await new Promise((resolve,reject)=>{browser.on('exit',code=>resolve(code??1));browser.on('error',reject)})
}finally{server.kill()}
