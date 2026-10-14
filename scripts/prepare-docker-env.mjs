import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
const path=new URL('../.env.docker',import.meta.url)
try{
  await writeFile(path,`DOCKER_POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nDOCKER_AUTH_SECRET=${randomBytes(48).toString('hex')}\nDOCKER_APP_PORT=3001\n`,{flag:'wx',mode:0o600})
  console.log('.env.docker creado con credenciales locales aleatorias. No versionar ni compartir.')
}catch(e){if(e.code!=='EEXIST')throw e;console.log('.env.docker ya existe; se conserva sin cambiar credenciales.')}
