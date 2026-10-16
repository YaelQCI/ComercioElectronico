BEGIN;

-- Stock ficticio autorizado para los artículos DEMO; no altera mercancía real.
-- Se difiere hasta registrar el almacén si la instalación todavía no tiene uno.
CREATE FUNCTION initialize_demo_catalog_stock() RETURNS integer LANGUAGE plpgsql AS $stock$
DECLARE warehouse_id uuid; item record; variant_id uuid; product_id uuid; lot_id uuid; created_count integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(34160500);
  SELECT id INTO warehouse_id FROM "Warehouse" WHERE "singletonKey"=1;
  IF warehouse_id IS NULL THEN RETURN 0; END IF;
  FOR item IN
    SELECT category, n, quantities[n] AS quantity FROM (VALUES
      ('proteina', ARRAY[2,6,18,40]),
      ('creatina', ARRAY[5,24,3,60]),
      ('pre-entreno', ARRAY[12,2,30,8]),
      ('electrolitos', ARRAY[45,15,4,28]),
      ('vitaminas', ARRAY[20,50,7,3]),
      ('aminoacidos', ARRAY[4,16,35,9]),
      ('accesorios', ARRAY[25,5,48,2])
    ) AS profiles(category, quantities) CROSS JOIN generate_series(1,4) AS n
  LOOP
    SELECT v.id,p.id INTO variant_id,product_id
    FROM "ProductVariant" v JOIN "Product" p ON p.id=v."productId" JOIN "Brand" b ON b.id=p."brandId"
    WHERE p.slug='demo-' || item.category || '-' || item.n
      AND v.sku='DEMO-' || upper(item.category) || '-' || lpad(item.n::text,2,'0')
      AND b.slug='tfs-demostracion-academica'
      AND v."deletedAt" IS NULL AND p."deletedAt" IS NULL AND p."publishedAt" IS NOT NULL
      AND EXISTS (SELECT 1 FROM "AuditEvent" a WHERE a."entityId"=p.id AND a.action='INITIALIZE_DEMO_CATALOG')
      AND NOT EXISTS (SELECT 1 FROM "InventoryMovement" m WHERE m."idempotencyKey"='demo-catalog-stock-v1:' || v.id::text);
    IF variant_id IS NULL THEN CONTINUE; END IF;
    INSERT INTO "InventoryLot" (id,"variantId","warehouseId","lotCode",origin,"updatedAt")
    VALUES (gen_random_uuid(),variant_id,warehouse_id,'DEMO-INICIAL-01','DEMOSTRACIÓN ACADÉMICA: stock ficticio, procedencia no acreditada.',CURRENT_TIMESTAMP)
    ON CONFLICT ("variantId","warehouseId","lotCode") DO NOTHING RETURNING id INTO lot_id;
    -- Un lote existente nunca se rellena: preserva ventas, ajustes, reservas y agotados.
    IF lot_id IS NULL THEN CONTINUE; END IF;
    INSERT INTO "InventoryMovement" (id,"lotId",kind,"onHandDelta",reason,"actorType","idempotencyKey")
    VALUES (gen_random_uuid(),lot_id,'RECEIPT',item.quantity,'Entrada inicial de DEMOSTRACIÓN autorizada por el propietario; no es inventario físico.','SYSTEM','demo-catalog-stock-v1:' || variant_id::text);
    INSERT INTO "AuditEvent" (id,"actorType","entityType","entityId",action,reason,"safeAfter","correlationId")
    VALUES (gen_random_uuid(),'SYSTEM','InventoryLot',lot_id,'INITIALIZE_DEMO_STOCK','Stock ficticio del catálogo académico autorizado por el propietario.',jsonb_build_object('productId',product_id,'variantId',variant_id,'quantity',item.quantity,'demo',true),gen_random_uuid());
    created_count := created_count + 1;
  END LOOP;
  RETURN created_count;
END;
$stock$;

SELECT initialize_demo_catalog_stock();

COMMIT;
