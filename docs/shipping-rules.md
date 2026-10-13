# Envío y empaque (#18)

`shippingProgress` trabaja con centavos exactos y la base de productos después de ofertas/cupón, antes de puntos. Desde 149900 el cargo cliente es cero y la tienda absorbe la tarifa real cotizada; debajo del umbral se cobra exactamente la tarifa elegida. Sin cotización, cargo y subsidio siguen siendo desconocidos, incluso si se alcanza el umbral. No se simula cobertura ni costo cero por ausencia de tarifa.

El código postal exige texto con cinco dígitos, conservando ceros iniciales. La vista del carrito muestra progreso/faltante con la misma base del resumen y explica que cobertura/cotización siguen pendientes. No publica $149 fijos, corte 18:00 ni promesa 24–48 horas.

`choosePackage` agrega componentes/unidades por variante y usa pesos/dimensiones de cada presentación, capacidad interna, dimensiones externas, tara y límite bruto de cajas activas. Prueba una distribución geométrica conservadora en cuboides disjuntos con seis orientaciones. Cada bloque contiene una rejilla de unidades y registra cantidad/coordenadas/dimensiones; celdas finales libres no se reutilizan. No basta comparar volumen. Una caja confirmada incluye todas las unidades y peso del empaque. Cantidades repetidas se ubican por bloques, sin iterar una vez por pieza ni imponer un tope comercial de diez.

La heurística puede rechazar una combinación físicamente posible si no encuentra esta distribución; no afirma un óptimo ni divide el pedido. Falta de configuración/capacidad devuelve error recuperable. Asume cajas y productos medidos como envolventes rectangulares con rotación permitida; el operador debe introducir medidas reales, incluyendo espacio protector, y validar físicamente la configuración antes de habilitarla. Solo se cotizarán paquetes comprobados.

Validación: cuatro pruebas puras verifican 149899/149900/superior, CP, cargo/subsidio sin recargo, tara, límites de peso, rotación, mil piezas, volumen engañoso y ausencia de superposición. Build Nuxt aprobado antes del commit.

Pendiente: conectar CP/destino y cotización persistente de Envia.com en #44, recotizar y exigir aceptación de cambios al iniciar pago (#24), calendario/estimaciones reales y validación visual. El propietario confirmó que no existen medidas/productos definitivos; no se inventaron almacén, cajas, tarifas ni fechas. Envia.com se limitará a cotizaciones, nunca generación de guías.
