// Congela una migración y sus ilustraciones locales; nunca modifica una migración existente.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { demoCatalog } from '../server/features/catalog/demo-catalog.js'

const root = new URL('../', import.meta.url)
const migration = new URL('prisma/migrations/20261016040000_demo_catalog/migration.sql', root)
const writing = process.argv.includes('--write')
if (writing && await access(migration).then(() => true, () => false)) throw Error('La migración ya existe. No se permite sobrescribirla; crea otra para cambios futuros.')
const id = key => { const h = createHash('sha256').update(`tfs-demo-v1:${key}`).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}` }
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function illustration(product) {
  const color = product.color
  const shape = product.container === 'pouch' ? '<path d="M160 120H440L465 510Q300 545 135 510Z" fill="#f4f4f0" stroke="#bcc0c6" stroke-width="5"/><path d="M162 130H438" stroke="#29324c" stroke-width="18"/>'
    : product.container === 'accessory' && product.index === 3 ? `<rect x="145" y="160" width="310" height="330" rx="20" fill="${color}"/><path d="M175 190V460H425" fill="none" stroke="#c4ccd9" stroke-width="8"/>`
    : product.container === 'accessory' && product.index === 4 ? `<ellipse cx="260" cy="310" rx="100" ry="160" fill="none" stroke="${color}" stroke-width="36"/><ellipse cx="350" cy="335" rx="75" ry="135" fill="none" stroke="#e2b638" stroke-width="24"/>`
    : product.container === 'bottle' || product.container === 'accessory' ? '<rect x="220" y="110" width="160" height="65" rx="12" fill="#273047"/><rect x="195" y="167" width="210" height="350" rx="45" fill="#f4f4f0" stroke="#bcc0c6" stroke-width="5"/>'
    : '<rect x="148" y="115" width="304" height="72" rx="15" fill="#273047"/><rect x="153" y="180" width="294" height="345" rx="36" fill="#f4f4f0" stroke="#bcc0c6" stroke-width="5"/>'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="640" viewBox="0 0 600 640"><rect width="600" height="640" fill="#fff"/><ellipse cx="300" cy="540" rx="180" ry="15" fill="#e7e8ed"/>${shape}<rect x="167" y="255" width="266" height="180" rx="5" fill="${color}"/><text x="300" y="287" text-anchor="middle" font-family="sans-serif" font-size="14" letter-spacing="3" fill="#fff">TFS · CATÁLOGO ACADÉMICO</text><text x="300" y="332" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="#fff">${xml(product.label)}</text><text x="300" y="368" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#fff">${xml(product.flavor)}</text><text x="300" y="401" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#fff">${xml(product.presentationLabel)}</text><rect x="190" y="465" width="220" height="36" rx="4" fill="#f5c43b"/><text x="300" y="490" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="#16172d">DEMO ${product.index} / 4</text><text x="300" y="590" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#596174">ILUSTRACIÓN · NO ES UN PRODUCTO REAL</text></svg>`
}
const products = []
for (const product of demoCatalog) {
  const path = new URL(`public${product.imagePath}`, root)
  if (writing) { await mkdir(new URL('./', path), { recursive: true }); await sharp(Buffer.from(illustration(product))).webp({ quality: 90 }).toFile(fileURLToPath(path)) }
  const bytes = await readFile(path)
  products.push({ ...product, id: id(product.slug), variantId: id(`${product.slug}:variant`), assetId: id(`${product.slug}:asset`), mediaId: id(`${product.slug}:media`), byteSize: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex') })
}
const sql = `BEGIN;

-- Catálogo de DEMOSTRACIÓN solicitado por el propietario: 4 artículos por cada una de las 7 categorías base.
-- Precios, composición, medidas e ilustraciones son ficticios. No genera stock, lotes, certificados ni reseñas.
-- Se aplica una vez mediante migrate deploy; reiniciar no repone ni republica artículos editados por el administrador.
DO $demo$
DECLARE item jsonb; brand_id uuid; category_id uuid; inserted_id uuid; created_ids uuid[] := '{}';
BEGIN
  INSERT INTO "Brand" (id,name,slug,"updatedAt") VALUES ('${id('brand')}','TFS · Demostración académica','tfs-demostracion-academica',CURRENT_TIMESTAMP)
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO STRICT brand_id FROM "Brand" WHERE slug='tfs-demostracion-academica';

  FOR item IN SELECT value FROM jsonb_array_elements($products$${JSON.stringify(products, null, 2)}$products$::jsonb)
  LOOP
    SELECT id INTO STRICT category_id FROM "Category" WHERE slug=item->>'categorySlug';
    INSERT INTO "Product" (id,"brandId",name,slug,description,ingredients,"usageInstructions","allergenInformation","publishedAt","updatedAt")
    VALUES ((item->>'id')::uuid,brand_id,item->>'name',item->>'slug',item->>'description',item->>'ingredients',item->>'usageInstructions',item->>'allergenInformation',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT (slug) DO NOTHING RETURNING id INTO inserted_id;
    -- Preserva íntegramente un producto existente: ni precio, contenido, imágenes, estado ni asociaciones se reescriben.
    IF inserted_id IS NULL THEN CONTINUE; END IF;
    created_ids := array_append(created_ids,inserted_id);
    INSERT INTO "ProductCategory" ("productId","categoryId","isPrimary") VALUES (inserted_id,category_id,true);
    INSERT INTO "ProductVariant" (id,"productId",sku,flavor,"flavorNormalized","presentationLabel","presentationNormalized","contentAmount","contentUnit",servings,"servingAmount","servingUnit","nutritionData","priceCents","compareAtPriceCents","weightGrams","lengthMm","widthMm","heightMm","updatedAt")
    VALUES ((item->>'variantId')::uuid,inserted_id,item->>'sku',item->>'flavor',lower(btrim(item->>'flavor')),item->>'presentationLabel',lower(btrim(item->>'presentationLabel')),(item->>'contentAmount')::numeric,item->>'contentUnit',(item->>'servings')::numeric,(item->>'servingAmount')::numeric,item->>'servingUnit',NULLIF(item->'nutritionData','null'::jsonb),(item->>'priceCents')::bigint,(item->>'compareAtPriceCents')::bigint,(item->>'weightGrams')::integer,(item->>'lengthMm')::integer,(item->>'widthMm')::integer,(item->>'heightMm')::integer,CURRENT_TIMESTAMP);
    INSERT INTO "MediaAsset" (id,"storageKey","mimeType","byteSize",checksum,"originalName","updatedAt")
    VALUES ((item->>'assetId')::uuid,item->>'imagePath','image/webp',(item->>'byteSize')::bigint,item->>'checksum',item->>'code' || '.webp',CURRENT_TIMESTAMP);
    INSERT INTO "ProductMedia" (id,"productId","assetId",kind,"altText",position,"updatedAt")
    VALUES ((item->>'mediaId')::uuid,inserted_id,(item->>'assetId')::uuid,'FRONT',item->>'imageAlt',0,CURRENT_TIMESTAMP);
    INSERT INTO "AuditEvent" (id,"actorType","entityType","entityId",action,reason,"safeAfter","correlationId")
    VALUES (gen_random_uuid(),'SYSTEM','Product',inserted_id,'INITIALIZE_DEMO_CATALOG','Catálogo académico de demostración autorizado por el propietario; no corresponde a mercancía real.',jsonb_build_object('slug',item->>'slug','demo',true,'migration','20261016040000_demo_catalog'),gen_random_uuid());
  END LOOP;
  -- Relaciones solo para productos recién creados; deja intactas las decisiones posteriores de administración.
  FOR item IN SELECT value FROM jsonb_array_elements($relations$${JSON.stringify(products.map(p => ({ id: p.id, relatedSlug: p.relatedSlug, crossSellSlug: p.crossSellSlug })))}$relations$::jsonb)
  LOOP
    IF NOT (item->>'id')::uuid = ANY(created_ids) THEN CONTINUE; END IF;
    INSERT INTO "ProductRelation" ("sourceProductId","targetProductId",kind,position)
    SELECT (item->>'id')::uuid,id,'RELATED',0 FROM "Product" WHERE slug=item->>'relatedSlug' AND id<>(item->>'id')::uuid;
    INSERT INTO "ProductRelation" ("sourceProductId","targetProductId",kind,position)
    SELECT (item->>'id')::uuid,id,'CROSS_SELL',0 FROM "Product" WHERE slug=item->>'crossSellSlug' AND id<>(item->>'id')::uuid;
  END LOOP;
END;
$demo$;

COMMIT;
`
if (writing) { await mkdir(new URL('./', migration), { recursive: true }); await writeFile(migration, sql); console.log('28 artículos e ilustraciones de demostración preparados. Migración nueva; no se modificó ninguna base de datos.') }
else { if (await readFile(migration, 'utf8') !== sql) throw Error('La migración congelada no coincide con los datos o imágenes de referencia. No la edites si ya fue aplicada.'); console.log('Catálogo congelado e integridad de 28 imágenes correctos.') }
