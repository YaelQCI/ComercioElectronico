BEGIN;

-- Historial académico ficticio autorizado: sin Stripe, correos ni guías reales.
CREATE FUNCTION initialize_demo_customers_orders_reviews() RETURNS integer LANGUAGE plpgsql AS $demo$
DECLARE
  i integer; n integer; j integer; step integer; created_count integer := 0;
  customer_id uuid; new_customer_id uuid; warehouse_id uuid; order_id uuid; line_id uuid; component_id uuid; unit_id uuid; lot_id uuid; quote_id uuid; reservation_id uuid; stock_id uuid;
  email_value text; order_number text; customer_name text; final_status "OrderStatus"; previous_status "OrderStatus"; next_status "OrderStatus";
  order_time timestamptz; transition_time timestamptz; before_cents bigint; discounted boolean; selected_skus text[]; row_data record;
  skus text[] := ARRAY['DEMO-PROTEINA-02','DEMO-CREATINA-04','DEMO-ELECTROLITOS-01','DEMO-VITAMINAS-02','DEMO-AMINOACIDOS-03','DEMO-ACCESORIOS-03','DEMO-PRE-ENTRENO-03'];
  statuses "OrderStatus"[] := ARRAY['CONFIRMED','PREPARING','SHIPPED','DELIVERED']::"OrderStatus"[];
  note jsonb := '{"demo":true,"notice":"DEMOSTRACIÓN ACADÉMICA. Sin transacción monetaria ni envío físico."}'::jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(34160600);
  FOR i IN 1..6 LOOP
    email_value := 'cliente' || lpad(i::text,2,'0') || '@demo.example.invalid';
    INSERT INTO "User" (id,email,"emailNormalized","passwordHash","displayName",role,"updatedAt")
    VALUES (md5('tfs-demo-customer-v1:' || i)::uuid,email_value,email_value,'DEMO_ACCOUNT_WITHOUT_LOGIN','Cliente DEMO ' || lpad(i::text,2,'0'),'CUSTOMER',CURRENT_TIMESTAMP)
    ON CONFLICT ("emailNormalized") DO NOTHING RETURNING id INTO new_customer_id;
    IF new_customer_id IS NOT NULL THEN
      INSERT INTO "AuditEvent" (id,"actorType","entityType","entityId",action,reason,"safeAfter","correlationId")
      VALUES (gen_random_uuid(),'SYSTEM','User',new_customer_id,'INITIALIZE_DEMO_CUSTOMER','Cliente ficticio autorizado, sin contraseña utilizable ni datos personales reales.',note,gen_random_uuid());
    END IF;
  END LOOP;
  SELECT id INTO warehouse_id FROM "Warehouse" WHERE "singletonKey"=1;
  IF warehouse_id IS NULL THEN RETURN 0; END IF;

  FOR n IN 1..12 LOOP
    order_number := 'DEMO-PEDIDO-' || lpad(n::text,3,'0');
    IF EXISTS (SELECT 1 FROM "Order" WHERE "orderNumber"=order_number) THEN CONTINUE; END IF;
    email_value := 'cliente' || lpad(((n-1)%6+1)::text,2,'0') || '@demo.example.invalid';
    SELECT u.id,u."displayName" INTO customer_id,customer_name FROM "User" u
      WHERE u."emailNormalized"=email_value AND u.role='CUSTOMER' AND u."deletedAt" IS NULL
      AND EXISTS (SELECT 1 FROM "AuditEvent" a WHERE a."entityId"=u.id AND a.action='INITIALIZE_DEMO_CUSTOMER');
    IF customer_id IS NULL THEN CONTINUE; END IF;
    selected_skus := ARRAY[skus[(n-1)%7+1],skus[n%7+1]];
    SELECT sum(v."priceCents") INTO before_cents FROM "ProductVariant" v JOIN "Product" p ON p.id=v."productId"
      WHERE v.sku=ANY(selected_skus) AND v."deletedAt" IS NULL AND p."deletedAt" IS NULL AND p."publishedAt" IS NOT NULL
      AND EXISTS (SELECT 1 FROM "AuditEvent" a WHERE a."entityId"=p.id AND a.action='INITIALIZE_DEMO_CATALOG')
      HAVING count(*)=2;
    IF before_cents IS NULL THEN CONTINUE; END IF;
    discounted := n<=10;
    final_status := CASE WHEN n<=6 THEN 'DELIVERED' WHEN n=7 THEN 'CONFIRMED' WHEN n IN (8,10) THEN 'PREPARING' WHEN n=9 THEN 'SHIPPED' ELSE 'PENDING_PAYMENT' END;
    order_time := CURRENT_TIMESTAMP - (20-n)*interval '1 day';
    order_id := gen_random_uuid();
    INSERT INTO "Order" (id,"orderNumber","userId","buyerEmail","buyerEmailNormalized","buyerName","goodsBeforeCouponCents","couponDiscountCents","goodsAfterCouponCents","pointsAppliedTenths","goodsMoneyCents","shippingQuotedCents","shippingChargedCents","shippingSubsidyCents","totalMoneyCents","couponSnapshot","policySnapshot","createdAt","updatedAt")
    VALUES (order_id,order_number,customer_id,email_value,email_value,customer_name,before_cents,CASE WHEN discounted THEN before_cents ELSE 0 END,CASE WHEN discounted THEN 0 ELSE before_cents END,0,CASE WHEN discounted THEN 0 ELSE before_cents END,0,0,0,CASE WHEN discounted THEN 0 ELSE before_cents END,CASE WHEN discounted THEN note || '{"code":"DEMO-BONIFICACION-TOTAL","percentageBasisPoints":10000}'::jsonb ELSE NULL END,note,order_time,order_time);
    INSERT INTO "OrderAddress" (id,"orderId","recipientName",phone,"postalCode",state,city,district,street,"exteriorNumber","references","updatedAt")
    VALUES (gen_random_uuid(),order_id,customer_name,'0000000000','00000','DEMO','Ciudad de demostración','Zona ficticia','Dirección DEMO: no enviar','S/N','Sin domicilio real. Registro exclusivo de demostración.',order_time);
    quote_id := gen_random_uuid();
    INSERT INTO "ShippingQuote" (id,"orderId","requestFingerprint",provider,"carrierCode","serviceCode","serviceName","quotedAmountCents","originSnapshot","destinationSnapshot","packageSnapshot","sanitizedResponse","quotedAt","updatedAt")
    VALUES (quote_id,order_id,order_number,'ENVIA','DEMO','SIN-ENVIO','Simulación sin envío físico',0,note,note,note,note,order_time,order_time);
    INSERT INTO "OrderStatusHistory" (id,"orderId","toStatus","actorType",reason,"eventKey","createdAt")
    VALUES (gen_random_uuid(),order_id,'PENDING_PAYMENT','SYSTEM','Pedido DEMO inicial, sin cobro.',order_number || ':pending',order_time);
    IF discounted THEN
      reservation_id := gen_random_uuid();
      INSERT INTO "ReservationSet" (id,"orderId","attemptNumber","expiresAt","acceptedQuoteId","checkoutFingerprint","acceptedCheckoutSnapshot","idempotencyKey","createdAt","updatedAt")
      VALUES (reservation_id,order_id,1,order_time+interval '29 minutes',quote_id,order_number,note,order_number || ':reservation',order_time,order_time);
      INSERT INTO "OrderPackage" (id,"orderId","quoteId","warehouseId","originSnapshot","packageCodeSnapshot","weightGrams","lengthMm","widthMm","heightMm","packingPlanSnapshot","carrierSnapshot","serviceSnapshot","deliveryEstimateSnapshot","acceptedAt","updatedAt")
      VALUES (gen_random_uuid(),order_id,quote_id,warehouse_id,note,'DEMO-NO-ENVIAR',1000,300,250,250,note,note,note,note,order_time,order_time);
    END IF;
    FOR j IN 1..2 LOOP
      SELECT v.*,p.name,p.id AS product_id,p.slug INTO STRICT row_data FROM "ProductVariant" v JOIN "Product" p ON p.id=v."productId" WHERE v.sku=selected_skus[j];
      line_id := gen_random_uuid(); component_id := gen_random_uuid(); unit_id := gen_random_uuid(); lot_id := NULL;
      IF discounted THEN
        -- Lote histórico dedicado: recepción y consumo se compensan. No toca el stock inicial disponible.
        lot_id := gen_random_uuid();
        INSERT INTO "InventoryLot" (id,"variantId","warehouseId","lotCode",origin,"createdAt","updatedAt")
        VALUES (lot_id,row_data.id,warehouse_id,order_number || '-HISTORICO','DEMOSTRACIÓN: historial ficticio, sin mercancía física.',order_time,order_time);
      END IF;
      INSERT INTO "OrderLine" (id,"orderId",position,"variantId",kind,quantity,"nameSnapshot","skuOrCodeSnapshot","unitPriceCents","lineBeforeCouponCents","couponDiscountCents","lineAfterCouponCents","updatedAt")
      VALUES (line_id,order_id,j-1,row_data.id,'VARIANT',1,row_data.name,row_data.sku,row_data."priceCents",row_data."priceCents",CASE WHEN discounted THEN row_data."priceCents" ELSE 0 END,CASE WHEN discounted THEN 0 ELSE row_data."priceCents" END,order_time);
      INSERT INTO "OrderComponent" (id,"orderId","orderLineId","variantId","quantityPerLineUnit","totalQuantity","productSnapshot","variantSnapshot","referenceUnitPriceCents","allocatedBaseCents","allocatedCouponCents","allocatedNetCents","updatedAt")
      VALUES (component_id,order_id,line_id,row_data.id,1,1,jsonb_build_object('id',row_data.product_id,'name',row_data.name,'demo',true),jsonb_build_object('sku',row_data.sku,'presentation',row_data."presentationLabel",'demo',true),row_data."priceCents",row_data."priceCents",CASE WHEN discounted THEN row_data."priceCents" ELSE 0 END,CASE WHEN discounted THEN 0 ELSE row_data."priceCents" END,order_time);
      INSERT INTO "OrderUnit" (id,"orderId","orderComponentId","variantId","unitOrdinal","lotId","lotSnapshot","baseCents","couponCents","netGoodsCents","pointsTenths","moneyCents","updatedAt")
      VALUES (unit_id,order_id,component_id,row_data.id,1,lot_id,CASE WHEN discounted THEN note ELSE NULL END,row_data."priceCents",CASE WHEN discounted THEN row_data."priceCents" ELSE 0 END,CASE WHEN discounted THEN 0 ELSE row_data."priceCents" END,0,CASE WHEN discounted THEN 0 ELSE row_data."priceCents" END,order_time);
      IF discounted THEN
        stock_id := gen_random_uuid();
        INSERT INTO "ReservationStock" (id,"reservationSetId","lotId",quantity,"updatedAt") VALUES (stock_id,reservation_id,lot_id,1,order_time);
        INSERT INTO "InventoryMovement" (id,"lotId",kind,"onHandDelta",reason,"actorType","idempotencyKey","createdAt")
        VALUES (gen_random_uuid(),lot_id,'RECEIPT',1,'Recepción histórica DEMO, no es mercancía real.','SYSTEM',order_number || ':' || j || ':receipt',order_time);
        INSERT INTO "InventoryMovement" (id,"lotId",kind,"reservedDelta","reservationStockId",reason,"actorType","idempotencyKey","createdAt")
        VALUES (gen_random_uuid(),lot_id,'RESERVE',1,stock_id,'Reserva histórica DEMO.','SYSTEM',order_number || ':' || j || ':reserve',order_time+interval '1 minute');
        INSERT INTO "InventoryMovement" (id,"lotId",kind,"onHandDelta","reservedDelta","reservationStockId","orderUnitId",reason,"actorType","idempotencyKey","createdAt")
        VALUES (gen_random_uuid(),lot_id,'SALE',-1,-1,stock_id,unit_id,'Consumo histórico DEMO; sin cobro ni entrega física.','SYSTEM',order_number || ':' || j || ':sale',order_time+interval '5 minutes');
      END IF;
    END LOOP;
    IF discounted THEN
      UPDATE "ReservationSet" SET state='CONSUMED',"resolvedAt"=order_time+interval '5 minutes',"resolutionReason"='Simulación histórica sin cobro.' WHERE id=reservation_id;
      previous_status := 'PENDING_PAYMENT';
      FOR step IN 1..array_position(statuses,final_status) LOOP
        next_status := statuses[step];
        transition_time := order_time + CASE step WHEN 1 THEN interval '5 minutes' WHEN 2 THEN interval '1 hour' WHEN 3 THEN interval '1 day' ELSE interval '3 days' END;
        INSERT INTO "OrderStatusHistory" (id,"orderId","fromStatus","toStatus","actorType",reason,"eventKey","createdAt")
        VALUES (gen_random_uuid(),order_id,previous_status,next_status,'SYSTEM','Transición ficticia de pedido DEMO. No acredita cobro ni entrega física.',order_number || ':' || next_status::text,transition_time);
        UPDATE "Order" SET status=next_status,"moneyStatus"='NOT_REQUIRED',"confirmedAt"=CASE WHEN step=1 THEN transition_time ELSE "confirmedAt" END,"shippedAt"=CASE WHEN step=3 THEN transition_time ELSE "shippedAt" END,"deliveredAt"=CASE WHEN step=4 THEN transition_time ELSE "deliveredAt" END,"updatedAt"=transition_time WHERE id=order_id;
        previous_status := next_status;
      END LOOP;
    END IF;
    IF n<=4 THEN
      FOR row_data IN SELECT u.id,v."productId" FROM "OrderUnit" u JOIN "ProductVariant" v ON v.id=u."variantId" WHERE u."orderId"=order_id ORDER BY u.id LOOP
        INSERT INTO "Review" (id,"userId","productId","verifiedOrderUnitId",rating,title,body,"createdAt","updatedAt")
        VALUES (gen_random_uuid(),customer_id,row_data."productId",row_data.id,CASE n WHEN 1 THEN 5 WHEN 2 THEN 4 WHEN 3 THEN 3 ELSE 5 END,'Reseña DEMO: ' || CASE n WHEN 1 THEN 'muy buena' WHEN 2 THEN 'buena' WHEN 3 THEN 'aceptable' ELSE 'excelente' END,'RESEÑA DE DEMOSTRACIÓN. Opinión ficticia para mostrar estrellas, distribución y compras entregadas en el proyecto académico. No es el testimonio de un comprador real.',order_time+interval '4 days',order_time+interval '4 days');
      END LOOP;
    END IF;
    INSERT INTO "AuditEvent" (id,"actorType","entityType","entityId",action,reason,"safeAfter","correlationId")
    VALUES (gen_random_uuid(),'SYSTEM','Order',order_id,'INITIALIZE_DEMO_ORDER','Pedido académico autorizado; no acredita venta, cobro ni envío real.',note || jsonb_build_object('number',order_number,'status',final_status),gen_random_uuid());
    created_count := created_count + 1;
  END LOOP;
  RETURN created_count;
END;
$demo$;

SELECT initialize_demo_customers_orders_reviews();

COMMIT;
