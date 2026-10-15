import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
const path=new URL('../.env.docker',import.meta.url)
try{
  await writeFile(path,`DOCKER_POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nDOCKER_AUTH_SECRET=${randomBytes(32).toString('base64')}\nDOCKER_APP_PORT=3001\n`,{flag:'wx',mode:0o600})
  console.log('.env.docker creado con credenciales locales aleatorias. No versionar ni compartir.')
}catch(e){
  if(e.code!=='EEXIST')throw e
  const existing = await readFile(path, 'utf8')
  const legacySecret = /^DOCKER_AUTH_SECRET=([a-f0-9]{96})\r?$/m
  if (legacySecret.test(existing)) {
    await writeFile(path, existing.replace(legacySecret, `DOCKER_AUTH_SECRET=${randomBytes(32).toString('base64')}`), { mode: 0o600 })
    console.log('Clave de autenticación antigua corregida a Base64 de 32 bytes. Credenciales PostgreSQL conservadas.')
  } else console.log('.env.docker ya existe; se conserva sin cambiar credenciales.')
}
