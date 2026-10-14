# Decisiones de base de datos

Fuente de reglas confirmadas: [modelo revisado](database-model-source.md), issues #33 y funcionales. Esta página orienta la entrega; no sustituye el diccionario ni autoriza promociones adicionales.

- Conservar unicidad de correo/SKU/códigos tras soft delete y referencias históricas; nunca reutilizar identidades.
- Centavos y décimas de punto enteros; mayores restos con desempate estable para repartos. Descontar reintegros ya comprometidos por unidad y medio.
- Reservar inventario, cupón y canje por treinta minutos; comprobar proveedor antes de liberar. Incertidumbre conserva recursos; cobro no aplicado requiere compensación independiente.
- Confirmar pedido cero en transacción sin Stripe; crédito de puntos único al entregar y vincular, ajustable con saldo negativo.
- FEFO sobre lotes vigentes/no bloqueados; devolución vendible solo tras inspección apta. Conservar entradas no vendibles y movimientos append-only.
- Envío gratis desde 149900 centavos de productos después de cupón y antes de puntos; una caja/paquete y cotización aceptada. Envia nunca emite guías.
- Autorización por cuenta/credencial privada; invitados no recuperan acceso mediante correo o número público. La renovación/verificación por correo sigue pendiente de proveedor.
- SQL adicional a Prisma conserva pertenencia, estados, ledger y topes transaccionales. Versionar nuevas migraciones; no modificar aplicadas ni reiniciar bases existentes.

Dirección de almacén, cajas, catálogo, certificados, políticas, contacto, Stripe/correo y recursos AWS deben configurarse con datos documentados. No considerar su ausencia una autorización para inventarlos. Estado y pruebas: [modelo físico](modelo-base-de-datos.md), [auditoría](acceptance-audit.md), [entrega](technical-delivery.md).
