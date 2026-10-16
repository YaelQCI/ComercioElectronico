// Catálogo ilustrativo autorizado para la inicialización del proyecto académico.
// No representa inventario, marcas comerciales, etiquetas verificadas ni recomendaciones de consumo.
export const demoCatalogVersion = 1
const groups = [
  { slug: 'proteina', name: 'Proteína', label: 'PROTEINA', color: '#987246', container: 'jar', products: [
    ['Proteína de suero chocolate', 'Chocolate', 900, 30, 30, 79900, 'Concentrado de proteína de suero, cacao y saborizante ilustrativos.', [['Proteínas', '23', 'g'], ['Hidratos de carbono', '3', 'g'], ['Grasas totales', '2', 'g'], ['Contenido energético', '122', 'kcal']], 'Contiene leche en este ejemplo.'],
    ['Proteína aislada vainilla', 'Vainilla', 750, 25, 30, 94900, 'Aislado de proteína de suero y saborizante de vainilla ilustrativos.', [['Proteínas', '25', 'g'], ['Hidratos de carbono', '1', 'g'], ['Grasas totales', '0.5', 'g'], ['Contenido energético', '109', 'kcal']], 'Contiene leche en este ejemplo.'],
    ['Proteína vegetal cacao', 'Cacao', 600, 20, 30, 68900, 'Proteínas de chícharo y arroz, cacao y saborizante ilustrativos.', [['Proteínas', '21', 'g'], ['Hidratos de carbono', '4', 'g'], ['Grasas totales', '2', 'g'], ['Contenido energético', '118', 'kcal']], 'Posibles trazas no verificadas; consultar una etiqueta real.'],
    ['Proteína de suero fresa', 'Fresa', 1200, 40, 30, 99900, 'Concentrado de proteína de suero y saborizante de fresa ilustrativos.', [['Proteínas', '22', 'g'], ['Hidratos de carbono', '4', 'g'], ['Grasas totales', '2', 'g'], ['Contenido energético', '122', 'kcal']], 'Contiene leche en este ejemplo.'],
  ] },
  { slug: 'creatina', name: 'Creatina', label: 'CREATINA', color: '#218582', container: 'jar', products: [
    ['Creatina monohidratada natural', 'Natural', 300, 60, 5, 44900, 'Creatina monohidratada ilustrativa.', [['Creatina monohidratada', '5', 'g']], 'Sin declaración de alérgenos verificada.'],
    ['Creatina micronizada natural', 'Natural', 500, 100, 5, 64900, 'Creatina monohidratada micronizada ilustrativa.', [['Creatina monohidratada', '5', 'g']], 'Sin declaración de alérgenos verificada.'],
    ['Creatina sabor limón', 'Limón', 360, 60, 6, 49900, 'Creatina monohidratada, ácido cítrico y saborizante ilustrativos.', [['Creatina monohidratada', '5', 'g'], ['Hidratos de carbono', '0.5', 'g']], 'Sin declaración de alérgenos verificada.'],
    ['Creatina sabor frutos rojos', 'Frutos rojos', 180, 30, 6, 32900, 'Creatina monohidratada y saborizante de frutos rojos ilustrativos.', [['Creatina monohidratada', '5', 'g'], ['Hidratos de carbono', '0.5', 'g']], 'Sin declaración de alérgenos verificada.'],
  ] },
  { slug: 'pre-entreno', name: 'Pre-entreno', label: 'PRE ENTRENO', color: '#8c527f', container: 'jar', products: [
    ['Pre-entreno sabor cítrico', 'Cítrico', 300, 30, 10, 59900, 'Mezcla ilustrativa de citrulina, beta-alanina, cafeína y saborizante.', [['L-citrulina', '4', 'g'], ['Beta-alanina', '2', 'g'], ['Cafeína', '150', 'mg']], 'Composición simulada con cafeína.'],
    ['Pre-entreno sin cafeína mango', 'Mango', 300, 30, 10, 57900, 'Mezcla ilustrativa de citrulina, beta-alanina y saborizante, sin cafeína declarada en este ejemplo.', [['L-citrulina', '4', 'g'], ['Beta-alanina', '2', 'g']], 'Sin declaración de alérgenos verificada.'],
    ['Pre-entreno sabor uva', 'Uva', 240, 30, 8, 54900, 'Mezcla ilustrativa de citrulina, beta-alanina, cafeína y saborizante.', [['L-citrulina', '3', 'g'], ['Beta-alanina', '2', 'g'], ['Cafeína', '100', 'mg']], 'Composición simulada con cafeína.'],
    ['Pre-entreno sin cafeína sandía', 'Sandía', 360, 30, 12, 62900, 'Mezcla ilustrativa de citrulina, beta-alanina y saborizante.', [['L-citrulina', '5', 'g'], ['Beta-alanina', '2', 'g']], 'Sin declaración de alérgenos verificada.'],
  ] },
  { slug: 'electrolitos', name: 'Electrolitos', label: 'ELECTROLITOS', color: '#416aa0', container: 'pouch', products: [
    ['Electrolitos sabor limón', 'Limón', 300, 30, 10, 34900, 'Sales de sodio, potasio y magnesio, y saborizante ilustrativos.', [['Sodio', '250', 'mg'], ['Potasio', '150', 'mg'], ['Magnesio', '50', 'mg']], 'Sin declaración de alérgenos verificada.'],
    ['Electrolitos sabor naranja', 'Naranja', 200, 20, 10, 25900, 'Sales minerales y saborizante de naranja ilustrativos.', [['Sodio', '200', 'mg'], ['Potasio', '120', 'mg'], ['Magnesio', '40', 'mg']], 'Sin declaración de alérgenos verificada.'],
    ['Electrolitos sabor frutos rojos', 'Frutos rojos', 360, 30, 12, 38900, 'Sales minerales y saborizante de frutos rojos ilustrativos.', [['Sodio', '300', 'mg'], ['Potasio', '180', 'mg'], ['Magnesio', '60', 'mg']], 'Sin declaración de alérgenos verificada.'],
    ['Electrolitos sabor pepino', 'Pepino', 240, 24, 10, 31900, 'Sales minerales y saborizante de pepino ilustrativos.', [['Sodio', '250', 'mg'], ['Potasio', '150', 'mg'], ['Magnesio', '50', 'mg']], 'Sin declaración de alérgenos verificada.'],
  ] },
  { slug: 'vitaminas', name: 'Vitaminas', label: 'VITAMINAS', color: '#638652', container: 'bottle', products: [
    ['Multivitamínico en cápsulas', 'Sin sabor', 60, 60, 1, 29900, 'Vitaminas y excipientes ilustrativos en cápsula vegetal.', [['Vitamina C', '60', 'mg'], ['Vitamina B12', '2.4', 'µg'], ['Zinc', '8', 'mg']], 'Excipientes y trazas no verificados.'],
    ['Vitamina C en cápsulas', 'Sin sabor', 90, 90, 1, 24900, 'Ácido ascórbico y excipientes ilustrativos.', [['Vitamina C', '250', 'mg']], 'Excipientes y trazas no verificados.'],
    ['Vitamina D en cápsulas', 'Sin sabor', 60, 60, 1, 22900, 'Colecalciferol y excipientes ilustrativos.', [['Vitamina D', '10', 'µg']], 'Excipientes y trazas no verificados.'],
    ['Complejo B en cápsulas', 'Sin sabor', 120, 120, 1, 32900, 'Vitaminas del complejo B y excipientes ilustrativos.', [['Vitamina B1', '1.2', 'mg'], ['Vitamina B6', '1.3', 'mg'], ['Vitamina B12', '2.4', 'µg']], 'Excipientes y trazas no verificados.'],
  ] },
  { slug: 'aminoacidos', name: 'Aminoácidos', label: 'AMINOACIDOS', color: '#ae6256', container: 'jar', products: [
    ['BCAA sabor frutos rojos', 'Frutos rojos', 300, 30, 10, 47900, 'L-leucina, L-isoleucina, L-valina y saborizante ilustrativos.', [['L-leucina', '2.5', 'g'], ['L-isoleucina', '1.25', 'g'], ['L-valina', '1.25', 'g']], 'Sin declaración de alérgenos verificada.'],
    ['Aminoácidos esenciales limón', 'Limón', 360, 30, 12, 54900, 'Mezcla ilustrativa de aminoácidos esenciales y saborizante.', [['Aminoácidos esenciales totales', '8', 'g']], 'Sin declaración de alérgenos verificada.'],
    ['Glutamina natural', 'Natural', 300, 60, 5, 39900, 'L-glutamina ilustrativa.', [['L-glutamina', '5', 'g']], 'Sin declaración de alérgenos verificada.'],
    ['BCAA sabor mango', 'Mango', 240, 24, 10, 42900, 'L-leucina, L-isoleucina, L-valina y saborizante ilustrativos.', [['L-leucina', '2.5', 'g'], ['L-isoleucina', '1.25', 'g'], ['L-valina', '1.25', 'g']], 'Sin declaración de alérgenos verificada.'],
  ] },
  { slug: 'accesorios', name: 'Accesorios', label: 'ACCESORIOS', color: '#64728b', container: 'accessory', products: [
    ['Shaker mezclador', 'No aplica', 600, null, null, 14900, 'Material de ejemplo: polipropileno; capacidad ilustrativa de 600 ml.', null, 'No aplica: accesorio no comestible.'],
    ['Botella deportiva', 'No aplica', 750, null, null, 19900, 'Material de ejemplo: acero inoxidable; capacidad ilustrativa de 750 ml.', null, 'No aplica: accesorio no comestible.'],
    ['Toalla deportiva', 'No aplica', 1, null, null, 12900, 'Material de ejemplo: microfibra; medidas ilustrativas de 40 × 80 cm.', null, 'No aplica: accesorio no comestible.'],
    ['Bandas de resistencia', 'No aplica', 3, null, null, 24900, 'Material de ejemplo: elastómero; juego ilustrativo de tres bandas.', null, 'Ejemplo con posible látex; verificar composición real.'],
  ] },
]
export const demoCatalog = groups.flatMap((group, groupIndex) => group.products.map((row, index) => {
  const [name, flavor, amount, servings, servingAmount, priceCents, ingredients, nutrients, allergens] = row
  const code = `${group.slug}-${index + 1}`, accessory = group.slug === 'accesorios', capsules = group.slug === 'vitaminas'
  const contentUnit = capsules ? 'cápsulas' : accessory ? index < 2 ? 'ml' : 'piezas' : 'g'
  return {
    code, categorySlug: group.slug, categoryName: group.name, label: group.label, color: group.color, container: group.container, index: index + 1,
    slug: `demo-${code}`, name: `${name} · DEMO`,
    description: `ARTÍCULO DE DEMOSTRACIÓN. ${name}, presentación de ${amount} ${contentUnit}. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.`,
    ingredients: `DATOS ILUSTRATIVOS. ${ingredients}`,
    usageInstructions: accessory ? 'DEMOSTRACIÓN. Información de cuidado ilustrativa: limpiar y secar antes de guardar. Consultar las instrucciones reales del fabricante antes de utilizar un artículo equivalente.' : 'DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.',
    allergenInformation: `DATOS ILUSTRATIVOS. ${allergens} Esta ficha no acredita ausencia de alérgenos.`,
    sku: `DEMO-${group.slug.toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
    flavor, presentationLabel: `${amount} ${contentUnit}`, contentAmount: String(amount), contentUnit,
    servings: servings == null ? null : String(servings), servingAmount: servingAmount == null ? null : String(servingAmount), servingUnit: servingAmount == null ? null : capsules ? 'cápsula' : 'g',
    nutritionData: nutrients ? { rows: nutrients.map(([name, amount, unit]) => ({ name, amount, unit })) } : null,
    priceCents: String(priceCents), compareAtPriceCents: index === 1 ? String(priceCents + 10000) : null,
    weightGrams: accessory ? [180, 300, 120, 200][index] : capsules ? 150 : amount + 150,
    lengthMm: accessory ? [100, 90, 220, 160][index] : 130,
    widthMm: accessory ? [100, 90, 160, 120][index] : 130,
    heightMm: accessory ? [220, 250, 40, 50][index] : capsules ? 130 : 180,
    imagePath: `/images/catalog/demo/${code}.webp`,
    imageAlt: `Ilustración de demostración de ${name}; no es una fotografía de un producto real.`,
    relatedSlug: `demo-${group.slug}-${(index + 1) % 4 + 1}`,
    crossSellSlug: `demo-${groups[(groupIndex + 1) % groups.length].slug}-1`,
  }
}))
