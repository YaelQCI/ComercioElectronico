BEGIN;

-- Catálogo de DEMOSTRACIÓN solicitado por el propietario: 4 artículos por cada una de las 7 categorías base.
-- Precios, composición, medidas e ilustraciones son ficticios. No genera stock, lotes, certificados ni reseñas.
-- Se aplica una vez mediante migrate deploy; reiniciar no repone ni republica artículos editados por el administrador.
DO $demo$
DECLARE item jsonb; brand_id uuid; category_id uuid; inserted_id uuid; created_ids uuid[] := '{}';
BEGIN
  INSERT INTO "Brand" (id,name,slug,"updatedAt") VALUES ('4a5900ea-cc4c-46d6-a894-39125025eca7','TFS · Demostración académica','tfs-demostracion-academica',CURRENT_TIMESTAMP)
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO STRICT brand_id FROM "Brand" WHERE slug='tfs-demostracion-academica';

  FOR item IN SELECT value FROM jsonb_array_elements($products$[
  {
    "code": "proteina-1",
    "categorySlug": "proteina",
    "categoryName": "Proteína",
    "label": "PROTEINA",
    "color": "#987246",
    "container": "jar",
    "index": 1,
    "slug": "demo-proteina-1",
    "name": "Proteína de suero chocolate · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Proteína de suero chocolate, presentación de 900 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Concentrado de proteína de suero, cacao y saborizante ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Contiene leche en este ejemplo. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-PROTEINA-01",
    "flavor": "Chocolate",
    "presentationLabel": "900 g",
    "contentAmount": "900",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "30",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Proteínas",
          "amount": "23",
          "unit": "g"
        },
        {
          "name": "Hidratos de carbono",
          "amount": "3",
          "unit": "g"
        },
        {
          "name": "Grasas totales",
          "amount": "2",
          "unit": "g"
        },
        {
          "name": "Contenido energético",
          "amount": "122",
          "unit": "kcal"
        }
      ]
    },
    "priceCents": "79900",
    "compareAtPriceCents": null,
    "weightGrams": 1050,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/proteina-1.webp",
    "imageAlt": "Ilustración de demostración de Proteína de suero chocolate; no es una fotografía de un producto real.",
    "relatedSlug": "demo-proteina-2",
    "crossSellSlug": "demo-creatina-1",
    "id": "0ac17dff-b0b8-485e-a960-70acf5e6aebe",
    "variantId": "40741d90-cde2-4f9d-ac48-4e85e5672bc5",
    "assetId": "84a0b104-18b9-4ed5-aa37-6d1dfa0a2976",
    "mediaId": "5d650d9a-d9a8-4212-a671-b8b953d9c129",
    "byteSize": 11166,
    "checksum": "54464fef10b7b345680536a8add65822bdd7c429168578b6adc545983450fe1b"
  },
  {
    "code": "proteina-2",
    "categorySlug": "proteina",
    "categoryName": "Proteína",
    "label": "PROTEINA",
    "color": "#987246",
    "container": "jar",
    "index": 2,
    "slug": "demo-proteina-2",
    "name": "Proteína aislada vainilla · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Proteína aislada vainilla, presentación de 750 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Aislado de proteína de suero y saborizante de vainilla ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Contiene leche en este ejemplo. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-PROTEINA-02",
    "flavor": "Vainilla",
    "presentationLabel": "750 g",
    "contentAmount": "750",
    "contentUnit": "g",
    "servings": "25",
    "servingAmount": "30",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Proteínas",
          "amount": "25",
          "unit": "g"
        },
        {
          "name": "Hidratos de carbono",
          "amount": "1",
          "unit": "g"
        },
        {
          "name": "Grasas totales",
          "amount": "0.5",
          "unit": "g"
        },
        {
          "name": "Contenido energético",
          "amount": "109",
          "unit": "kcal"
        }
      ]
    },
    "priceCents": "94900",
    "compareAtPriceCents": "104900",
    "weightGrams": 900,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/proteina-2.webp",
    "imageAlt": "Ilustración de demostración de Proteína aislada vainilla; no es una fotografía de un producto real.",
    "relatedSlug": "demo-proteina-3",
    "crossSellSlug": "demo-creatina-1",
    "id": "fd808239-5384-4405-ab1e-6b70c9d12f45",
    "variantId": "6095bbb4-4cae-4fe9-ab96-022e9e1f1127",
    "assetId": "da8aad21-84f6-4ae5-af1c-5eccdd15c4e5",
    "mediaId": "edcdf854-6ce0-4916-abcd-64031ade6d40",
    "byteSize": 11106,
    "checksum": "e8fb90137c01bdd4f771e9e2c54f21416aa35dc01075fe6abdf7c258e2dea2d1"
  },
  {
    "code": "proteina-3",
    "categorySlug": "proteina",
    "categoryName": "Proteína",
    "label": "PROTEINA",
    "color": "#987246",
    "container": "jar",
    "index": 3,
    "slug": "demo-proteina-3",
    "name": "Proteína vegetal cacao · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Proteína vegetal cacao, presentación de 600 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Proteínas de chícharo y arroz, cacao y saborizante ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Posibles trazas no verificadas; consultar una etiqueta real. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-PROTEINA-03",
    "flavor": "Cacao",
    "presentationLabel": "600 g",
    "contentAmount": "600",
    "contentUnit": "g",
    "servings": "20",
    "servingAmount": "30",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Proteínas",
          "amount": "21",
          "unit": "g"
        },
        {
          "name": "Hidratos de carbono",
          "amount": "4",
          "unit": "g"
        },
        {
          "name": "Grasas totales",
          "amount": "2",
          "unit": "g"
        },
        {
          "name": "Contenido energético",
          "amount": "118",
          "unit": "kcal"
        }
      ]
    },
    "priceCents": "68900",
    "compareAtPriceCents": null,
    "weightGrams": 750,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/proteina-3.webp",
    "imageAlt": "Ilustración de demostración de Proteína vegetal cacao; no es una fotografía de un producto real.",
    "relatedSlug": "demo-proteina-4",
    "crossSellSlug": "demo-creatina-1",
    "id": "b6869794-63d5-45e5-af00-2b0f597af49c",
    "variantId": "4b06a586-bdf3-4638-ae60-6c0c939e0a12",
    "assetId": "03c0068a-83cd-4cb6-ac27-3dc47d780815",
    "mediaId": "3375ad7f-3b58-4a9a-abb9-d7ffaa26cfbe",
    "byteSize": 10936,
    "checksum": "dee3646eb41543173d1da343406c0c4b30b003fa19a01cc4956ffda7c272fdc4"
  },
  {
    "code": "proteina-4",
    "categorySlug": "proteina",
    "categoryName": "Proteína",
    "label": "PROTEINA",
    "color": "#987246",
    "container": "jar",
    "index": 4,
    "slug": "demo-proteina-4",
    "name": "Proteína de suero fresa · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Proteína de suero fresa, presentación de 1200 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Concentrado de proteína de suero y saborizante de fresa ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Contiene leche en este ejemplo. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-PROTEINA-04",
    "flavor": "Fresa",
    "presentationLabel": "1200 g",
    "contentAmount": "1200",
    "contentUnit": "g",
    "servings": "40",
    "servingAmount": "30",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Proteínas",
          "amount": "22",
          "unit": "g"
        },
        {
          "name": "Hidratos de carbono",
          "amount": "4",
          "unit": "g"
        },
        {
          "name": "Grasas totales",
          "amount": "2",
          "unit": "g"
        },
        {
          "name": "Contenido energético",
          "amount": "122",
          "unit": "kcal"
        }
      ]
    },
    "priceCents": "99900",
    "compareAtPriceCents": null,
    "weightGrams": 1350,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/proteina-4.webp",
    "imageAlt": "Ilustración de demostración de Proteína de suero fresa; no es una fotografía de un producto real.",
    "relatedSlug": "demo-proteina-1",
    "crossSellSlug": "demo-creatina-1",
    "id": "57abe908-333b-4722-aa5b-f817afd9c643",
    "variantId": "bbbc2de5-3ffd-45b3-a6d1-c20df9af57bd",
    "assetId": "c6aa0ca6-040b-46b6-a1e7-fba0cd8f21d0",
    "mediaId": "87b96799-c00c-44e6-a630-72e70cc8ce35",
    "byteSize": 10914,
    "checksum": "9651634fc2006d3e3b6193be729fd871de2032a202caf65da918b3cfed484898"
  },
  {
    "code": "creatina-1",
    "categorySlug": "creatina",
    "categoryName": "Creatina",
    "label": "CREATINA",
    "color": "#218582",
    "container": "jar",
    "index": 1,
    "slug": "demo-creatina-1",
    "name": "Creatina monohidratada natural · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Creatina monohidratada natural, presentación de 300 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Creatina monohidratada ilustrativa.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-CREATINA-01",
    "flavor": "Natural",
    "presentationLabel": "300 g",
    "contentAmount": "300",
    "contentUnit": "g",
    "servings": "60",
    "servingAmount": "5",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Creatina monohidratada",
          "amount": "5",
          "unit": "g"
        }
      ]
    },
    "priceCents": "44900",
    "compareAtPriceCents": null,
    "weightGrams": 450,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/creatina-1.webp",
    "imageAlt": "Ilustración de demostración de Creatina monohidratada natural; no es una fotografía de un producto real.",
    "relatedSlug": "demo-creatina-2",
    "crossSellSlug": "demo-pre-entreno-1",
    "id": "4a73fe54-4d30-4d89-a740-53dad6ab18a2",
    "variantId": "0e6aa6db-5116-48f5-ac1b-0e25697a048c",
    "assetId": "b90befb0-727c-420d-a8cb-e0e718b04155",
    "mediaId": "4b5f69b0-4fea-4df5-ac71-d23e362e2d0b",
    "byteSize": 11344,
    "checksum": "0cde6d66a3c25271d6f07f0ba8c13b2bd5fc3126acb8c4c46b93189021c31435"
  },
  {
    "code": "creatina-2",
    "categorySlug": "creatina",
    "categoryName": "Creatina",
    "label": "CREATINA",
    "color": "#218582",
    "container": "jar",
    "index": 2,
    "slug": "demo-creatina-2",
    "name": "Creatina micronizada natural · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Creatina micronizada natural, presentación de 500 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Creatina monohidratada micronizada ilustrativa.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-CREATINA-02",
    "flavor": "Natural",
    "presentationLabel": "500 g",
    "contentAmount": "500",
    "contentUnit": "g",
    "servings": "100",
    "servingAmount": "5",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Creatina monohidratada",
          "amount": "5",
          "unit": "g"
        }
      ]
    },
    "priceCents": "64900",
    "compareAtPriceCents": "74900",
    "weightGrams": 650,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/creatina-2.webp",
    "imageAlt": "Ilustración de demostración de Creatina micronizada natural; no es una fotografía de un producto real.",
    "relatedSlug": "demo-creatina-3",
    "crossSellSlug": "demo-pre-entreno-1",
    "id": "9871d4ae-ee5a-4485-a7ea-286c02d65117",
    "variantId": "5e19eb78-86f8-40e1-a624-0aaa23200d5d",
    "assetId": "77f99404-9dea-4150-a546-ab6d34f1ef86",
    "mediaId": "5b5ef5c4-7976-4d1e-aa5b-ef6555913da2",
    "byteSize": 11392,
    "checksum": "e19bc0d85925d37f21c8682a24cfa0c314c6f0d0daefa2af3ac06dacae56b9da"
  },
  {
    "code": "creatina-3",
    "categorySlug": "creatina",
    "categoryName": "Creatina",
    "label": "CREATINA",
    "color": "#218582",
    "container": "jar",
    "index": 3,
    "slug": "demo-creatina-3",
    "name": "Creatina sabor limón · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Creatina sabor limón, presentación de 360 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Creatina monohidratada, ácido cítrico y saborizante ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-CREATINA-03",
    "flavor": "Limón",
    "presentationLabel": "360 g",
    "contentAmount": "360",
    "contentUnit": "g",
    "servings": "60",
    "servingAmount": "6",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Creatina monohidratada",
          "amount": "5",
          "unit": "g"
        },
        {
          "name": "Hidratos de carbono",
          "amount": "0.5",
          "unit": "g"
        }
      ]
    },
    "priceCents": "49900",
    "compareAtPriceCents": null,
    "weightGrams": 510,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/creatina-3.webp",
    "imageAlt": "Ilustración de demostración de Creatina sabor limón; no es una fotografía de un producto real.",
    "relatedSlug": "demo-creatina-4",
    "crossSellSlug": "demo-pre-entreno-1",
    "id": "7f40e9af-9830-416b-a2eb-19edd583b957",
    "variantId": "0837236f-7e7c-432c-a73a-263be960fa26",
    "assetId": "15907f1a-65d4-4ffa-ade5-fc88bd746489",
    "mediaId": "bebea793-e6e1-4c2f-a491-dd1e2ea69c94",
    "byteSize": 11158,
    "checksum": "72c361b6b5d3c72e1387c4aed53afbc99ca324c6d278fe8faecc6d00506b53e5"
  },
  {
    "code": "creatina-4",
    "categorySlug": "creatina",
    "categoryName": "Creatina",
    "label": "CREATINA",
    "color": "#218582",
    "container": "jar",
    "index": 4,
    "slug": "demo-creatina-4",
    "name": "Creatina sabor frutos rojos · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Creatina sabor frutos rojos, presentación de 180 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Creatina monohidratada y saborizante de frutos rojos ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-CREATINA-04",
    "flavor": "Frutos rojos",
    "presentationLabel": "180 g",
    "contentAmount": "180",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "6",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Creatina monohidratada",
          "amount": "5",
          "unit": "g"
        },
        {
          "name": "Hidratos de carbono",
          "amount": "0.5",
          "unit": "g"
        }
      ]
    },
    "priceCents": "32900",
    "compareAtPriceCents": null,
    "weightGrams": 330,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/creatina-4.webp",
    "imageAlt": "Ilustración de demostración de Creatina sabor frutos rojos; no es una fotografía de un producto real.",
    "relatedSlug": "demo-creatina-1",
    "crossSellSlug": "demo-pre-entreno-1",
    "id": "1e26479a-c6f8-4a55-a193-e0bae404913e",
    "variantId": "51bc1ca6-ab57-4ec9-a0ca-96f221c55378",
    "assetId": "5bfb5f9c-96a7-42d8-aad1-2742128e4b4f",
    "mediaId": "67e5e347-28f8-4d3b-a18f-652f199fce92",
    "byteSize": 11772,
    "checksum": "ba2743f717e5488608dd692e92f080e33771b0774c831b982e61728b3300d16b"
  },
  {
    "code": "pre-entreno-1",
    "categorySlug": "pre-entreno",
    "categoryName": "Pre-entreno",
    "label": "PRE ENTRENO",
    "color": "#8c527f",
    "container": "jar",
    "index": 1,
    "slug": "demo-pre-entreno-1",
    "name": "Pre-entreno sabor cítrico · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Pre-entreno sabor cítrico, presentación de 300 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Mezcla ilustrativa de citrulina, beta-alanina, cafeína y saborizante.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Composición simulada con cafeína. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-PRE-ENTRENO-01",
    "flavor": "Cítrico",
    "presentationLabel": "300 g",
    "contentAmount": "300",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "10",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "L-citrulina",
          "amount": "4",
          "unit": "g"
        },
        {
          "name": "Beta-alanina",
          "amount": "2",
          "unit": "g"
        },
        {
          "name": "Cafeína",
          "amount": "150",
          "unit": "mg"
        }
      ]
    },
    "priceCents": "59900",
    "compareAtPriceCents": null,
    "weightGrams": 450,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/pre-entreno-1.webp",
    "imageAlt": "Ilustración de demostración de Pre-entreno sabor cítrico; no es una fotografía de un producto real.",
    "relatedSlug": "demo-pre-entreno-2",
    "crossSellSlug": "demo-electrolitos-1",
    "id": "e3a00bd7-d7cd-46aa-aea0-d9db4c5c3d4b",
    "variantId": "5b0c6989-e416-44c4-ad91-304c3e67dba9",
    "assetId": "8b498728-56e1-4513-a9f0-766c86f80357",
    "mediaId": "1fd70d4c-14ea-47c8-a805-be65e9b4eeea",
    "byteSize": 11100,
    "checksum": "d3f2c21fcb2e007b1e1074d096be00a3dd9116d5c3ceccc9e4d2f9d61e6a385d"
  },
  {
    "code": "pre-entreno-2",
    "categorySlug": "pre-entreno",
    "categoryName": "Pre-entreno",
    "label": "PRE ENTRENO",
    "color": "#8c527f",
    "container": "jar",
    "index": 2,
    "slug": "demo-pre-entreno-2",
    "name": "Pre-entreno sin cafeína mango · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Pre-entreno sin cafeína mango, presentación de 300 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Mezcla ilustrativa de citrulina, beta-alanina y saborizante, sin cafeína declarada en este ejemplo.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-PRE-ENTRENO-02",
    "flavor": "Mango",
    "presentationLabel": "300 g",
    "contentAmount": "300",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "10",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "L-citrulina",
          "amount": "4",
          "unit": "g"
        },
        {
          "name": "Beta-alanina",
          "amount": "2",
          "unit": "g"
        }
      ]
    },
    "priceCents": "57900",
    "compareAtPriceCents": "67900",
    "weightGrams": 450,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/pre-entreno-2.webp",
    "imageAlt": "Ilustración de demostración de Pre-entreno sin cafeína mango; no es una fotografía de un producto real.",
    "relatedSlug": "demo-pre-entreno-3",
    "crossSellSlug": "demo-electrolitos-1",
    "id": "bcf92174-acdd-460c-ad8f-aba00bc1555c",
    "variantId": "1e855474-70f9-4597-af1a-6af9332da577",
    "assetId": "07fbbdf0-f06c-4716-a828-d6ba58ae0b6e",
    "mediaId": "c3820426-562f-455b-add2-33c7eb9056c4",
    "byteSize": 10998,
    "checksum": "30318ffdb708ff408a67b95787191843151d58a1879c8cb5b78fd893833f732c"
  },
  {
    "code": "pre-entreno-3",
    "categorySlug": "pre-entreno",
    "categoryName": "Pre-entreno",
    "label": "PRE ENTRENO",
    "color": "#8c527f",
    "container": "jar",
    "index": 3,
    "slug": "demo-pre-entreno-3",
    "name": "Pre-entreno sabor uva · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Pre-entreno sabor uva, presentación de 240 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Mezcla ilustrativa de citrulina, beta-alanina, cafeína y saborizante.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Composición simulada con cafeína. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-PRE-ENTRENO-03",
    "flavor": "Uva",
    "presentationLabel": "240 g",
    "contentAmount": "240",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "8",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "L-citrulina",
          "amount": "3",
          "unit": "g"
        },
        {
          "name": "Beta-alanina",
          "amount": "2",
          "unit": "g"
        },
        {
          "name": "Cafeína",
          "amount": "100",
          "unit": "mg"
        }
      ]
    },
    "priceCents": "54900",
    "compareAtPriceCents": null,
    "weightGrams": 390,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/pre-entreno-3.webp",
    "imageAlt": "Ilustración de demostración de Pre-entreno sabor uva; no es una fotografía de un producto real.",
    "relatedSlug": "demo-pre-entreno-4",
    "crossSellSlug": "demo-electrolitos-1",
    "id": "ae8e3639-262f-4b8b-ad2b-dff08f1a394a",
    "variantId": "6e798c6d-a14e-47a8-ab01-05c650a31561",
    "assetId": "b53c3e86-af53-4ef5-a3c7-1ae0647efa4a",
    "mediaId": "5f9bac0f-f317-4726-aa08-2aa1beeeb2db",
    "byteSize": 10786,
    "checksum": "7316c0664867be539206c577586b151e1694342cb55be1d3bc78df4ca77a9b79"
  },
  {
    "code": "pre-entreno-4",
    "categorySlug": "pre-entreno",
    "categoryName": "Pre-entreno",
    "label": "PRE ENTRENO",
    "color": "#8c527f",
    "container": "jar",
    "index": 4,
    "slug": "demo-pre-entreno-4",
    "name": "Pre-entreno sin cafeína sandía · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Pre-entreno sin cafeína sandía, presentación de 360 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Mezcla ilustrativa de citrulina, beta-alanina y saborizante.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-PRE-ENTRENO-04",
    "flavor": "Sandía",
    "presentationLabel": "360 g",
    "contentAmount": "360",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "12",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "L-citrulina",
          "amount": "5",
          "unit": "g"
        },
        {
          "name": "Beta-alanina",
          "amount": "2",
          "unit": "g"
        }
      ]
    },
    "priceCents": "62900",
    "compareAtPriceCents": null,
    "weightGrams": 510,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/pre-entreno-4.webp",
    "imageAlt": "Ilustración de demostración de Pre-entreno sin cafeína sandía; no es una fotografía de un producto real.",
    "relatedSlug": "demo-pre-entreno-1",
    "crossSellSlug": "demo-electrolitos-1",
    "id": "85d67a90-0dfa-4ef1-ad5f-793e248905c4",
    "variantId": "4a4f4256-3016-4f13-a8ba-274f7a012382",
    "assetId": "adf27b1b-d15d-4ede-a59c-245525d63e73",
    "mediaId": "9e99db52-a02c-4775-aed0-9cf09327482c",
    "byteSize": 11050,
    "checksum": "a106e3689e08955274f56daa99fc48c88ae2c6434c6c970e4610d0e8401a6dba"
  },
  {
    "code": "electrolitos-1",
    "categorySlug": "electrolitos",
    "categoryName": "Electrolitos",
    "label": "ELECTROLITOS",
    "color": "#416aa0",
    "container": "pouch",
    "index": 1,
    "slug": "demo-electrolitos-1",
    "name": "Electrolitos sabor limón · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Electrolitos sabor limón, presentación de 300 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Sales de sodio, potasio y magnesio, y saborizante ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-ELECTROLITOS-01",
    "flavor": "Limón",
    "presentationLabel": "300 g",
    "contentAmount": "300",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "10",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Sodio",
          "amount": "250",
          "unit": "mg"
        },
        {
          "name": "Potasio",
          "amount": "150",
          "unit": "mg"
        },
        {
          "name": "Magnesio",
          "amount": "50",
          "unit": "mg"
        }
      ]
    },
    "priceCents": "34900",
    "compareAtPriceCents": null,
    "weightGrams": 450,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/electrolitos-1.webp",
    "imageAlt": "Ilustración de demostración de Electrolitos sabor limón; no es una fotografía de un producto real.",
    "relatedSlug": "demo-electrolitos-2",
    "crossSellSlug": "demo-vitaminas-1",
    "id": "cda93d48-98ce-44bd-a8b9-a7571139d427",
    "variantId": "e368165e-7c00-4a1b-ae05-d4f479abd203",
    "assetId": "c80419a3-c982-4c52-a526-b027283a0c6b",
    "mediaId": "03d1ab7a-3577-4c7a-a8ff-04a613b41b8f",
    "byteSize": 12766,
    "checksum": "11cc52dec588959cc787eac07f14303c2b51b93c59742e58f54bbd20a1f4b8f2"
  },
  {
    "code": "electrolitos-2",
    "categorySlug": "electrolitos",
    "categoryName": "Electrolitos",
    "label": "ELECTROLITOS",
    "color": "#416aa0",
    "container": "pouch",
    "index": 2,
    "slug": "demo-electrolitos-2",
    "name": "Electrolitos sabor naranja · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Electrolitos sabor naranja, presentación de 200 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Sales minerales y saborizante de naranja ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-ELECTROLITOS-02",
    "flavor": "Naranja",
    "presentationLabel": "200 g",
    "contentAmount": "200",
    "contentUnit": "g",
    "servings": "20",
    "servingAmount": "10",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Sodio",
          "amount": "200",
          "unit": "mg"
        },
        {
          "name": "Potasio",
          "amount": "120",
          "unit": "mg"
        },
        {
          "name": "Magnesio",
          "amount": "40",
          "unit": "mg"
        }
      ]
    },
    "priceCents": "25900",
    "compareAtPriceCents": "35900",
    "weightGrams": 350,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/electrolitos-2.webp",
    "imageAlt": "Ilustración de demostración de Electrolitos sabor naranja; no es una fotografía de un producto real.",
    "relatedSlug": "demo-electrolitos-3",
    "crossSellSlug": "demo-vitaminas-1",
    "id": "6cfc7ea8-f08c-4ec7-a872-e374b58794cf",
    "variantId": "1dac563a-15b6-4984-a254-1084781d44c1",
    "assetId": "39a7865e-b61a-4907-a139-87f51919a6f0",
    "mediaId": "fc55c1e0-f33e-40bb-a1e1-b1b4e769530a",
    "byteSize": 13086,
    "checksum": "04c8295215bb88c4e7ed51e1b4ee0a865bb087610f2c41f2cba1ce604402ba28"
  },
  {
    "code": "electrolitos-3",
    "categorySlug": "electrolitos",
    "categoryName": "Electrolitos",
    "label": "ELECTROLITOS",
    "color": "#416aa0",
    "container": "pouch",
    "index": 3,
    "slug": "demo-electrolitos-3",
    "name": "Electrolitos sabor frutos rojos · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Electrolitos sabor frutos rojos, presentación de 360 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Sales minerales y saborizante de frutos rojos ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-ELECTROLITOS-03",
    "flavor": "Frutos rojos",
    "presentationLabel": "360 g",
    "contentAmount": "360",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "12",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Sodio",
          "amount": "300",
          "unit": "mg"
        },
        {
          "name": "Potasio",
          "amount": "180",
          "unit": "mg"
        },
        {
          "name": "Magnesio",
          "amount": "60",
          "unit": "mg"
        }
      ]
    },
    "priceCents": "38900",
    "compareAtPriceCents": null,
    "weightGrams": 510,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/electrolitos-3.webp",
    "imageAlt": "Ilustración de demostración de Electrolitos sabor frutos rojos; no es una fotografía de un producto real.",
    "relatedSlug": "demo-electrolitos-4",
    "crossSellSlug": "demo-vitaminas-1",
    "id": "8c739020-62ee-4f31-ac72-eb1da939c1f4",
    "variantId": "ad37fe29-893c-464f-a9c8-27221f6a45ad",
    "assetId": "58c10285-841c-48ae-a753-0d14d80a3db5",
    "mediaId": "2fa482a7-31e1-4be5-a7c0-bbf31283ef0d",
    "byteSize": 13472,
    "checksum": "cf3942e35e2512ae2b1a5e08447e9d47c0f6ef152aa5cf614b2048aca3e2fe30"
  },
  {
    "code": "electrolitos-4",
    "categorySlug": "electrolitos",
    "categoryName": "Electrolitos",
    "label": "ELECTROLITOS",
    "color": "#416aa0",
    "container": "pouch",
    "index": 4,
    "slug": "demo-electrolitos-4",
    "name": "Electrolitos sabor pepino · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Electrolitos sabor pepino, presentación de 240 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Sales minerales y saborizante de pepino ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-ELECTROLITOS-04",
    "flavor": "Pepino",
    "presentationLabel": "240 g",
    "contentAmount": "240",
    "contentUnit": "g",
    "servings": "24",
    "servingAmount": "10",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Sodio",
          "amount": "250",
          "unit": "mg"
        },
        {
          "name": "Potasio",
          "amount": "150",
          "unit": "mg"
        },
        {
          "name": "Magnesio",
          "amount": "50",
          "unit": "mg"
        }
      ]
    },
    "priceCents": "31900",
    "compareAtPriceCents": null,
    "weightGrams": 390,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/electrolitos-4.webp",
    "imageAlt": "Ilustración de demostración de Electrolitos sabor pepino; no es una fotografía de un producto real.",
    "relatedSlug": "demo-electrolitos-1",
    "crossSellSlug": "demo-vitaminas-1",
    "id": "f3e535c0-55fb-4f7a-aa97-068b39768b96",
    "variantId": "72e5d0e2-03b2-4030-a286-60b92d9c4c74",
    "assetId": "e3556207-fb66-4600-a24a-3040608fc24a",
    "mediaId": "36c57521-54e5-4892-a65c-03f94bec0c24",
    "byteSize": 12958,
    "checksum": "5cb1756353ce7a6fd25facec8123f2dbb2c2191b91e04962149bcd1a30da2604"
  },
  {
    "code": "vitaminas-1",
    "categorySlug": "vitaminas",
    "categoryName": "Vitaminas",
    "label": "VITAMINAS",
    "color": "#638652",
    "container": "bottle",
    "index": 1,
    "slug": "demo-vitaminas-1",
    "name": "Multivitamínico en cápsulas · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Multivitamínico en cápsulas, presentación de 60 cápsulas. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Vitaminas y excipientes ilustrativos en cápsula vegetal.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Excipientes y trazas no verificados. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-VITAMINAS-01",
    "flavor": "Sin sabor",
    "presentationLabel": "60 cápsulas",
    "contentAmount": "60",
    "contentUnit": "cápsulas",
    "servings": "60",
    "servingAmount": "1",
    "servingUnit": "cápsula",
    "nutritionData": {
      "rows": [
        {
          "name": "Vitamina C",
          "amount": "60",
          "unit": "mg"
        },
        {
          "name": "Vitamina B12",
          "amount": "2.4",
          "unit": "µg"
        },
        {
          "name": "Zinc",
          "amount": "8",
          "unit": "mg"
        }
      ]
    },
    "priceCents": "29900",
    "compareAtPriceCents": null,
    "weightGrams": 150,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 130,
    "imagePath": "/images/catalog/demo/vitaminas-1.webp",
    "imageAlt": "Ilustración de demostración de Multivitamínico en cápsulas; no es una fotografía de un producto real.",
    "relatedSlug": "demo-vitaminas-2",
    "crossSellSlug": "demo-aminoacidos-1",
    "id": "6ca72796-c31f-4751-ac1c-52d6e59e57c2",
    "variantId": "e6a8806b-c5ff-4d6d-a83b-f3b3ddd149d7",
    "assetId": "38131b61-9eed-4655-a633-389168b2d63b",
    "mediaId": "2d5275a6-64e7-4364-a68e-44918c24bea9",
    "byteSize": 11620,
    "checksum": "012caf3c992add1f1b24d7ba9afc2c4cb7b056aaacc47cfd43c8ee2b8571404a"
  },
  {
    "code": "vitaminas-2",
    "categorySlug": "vitaminas",
    "categoryName": "Vitaminas",
    "label": "VITAMINAS",
    "color": "#638652",
    "container": "bottle",
    "index": 2,
    "slug": "demo-vitaminas-2",
    "name": "Vitamina C en cápsulas · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Vitamina C en cápsulas, presentación de 90 cápsulas. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Ácido ascórbico y excipientes ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Excipientes y trazas no verificados. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-VITAMINAS-02",
    "flavor": "Sin sabor",
    "presentationLabel": "90 cápsulas",
    "contentAmount": "90",
    "contentUnit": "cápsulas",
    "servings": "90",
    "servingAmount": "1",
    "servingUnit": "cápsula",
    "nutritionData": {
      "rows": [
        {
          "name": "Vitamina C",
          "amount": "250",
          "unit": "mg"
        }
      ]
    },
    "priceCents": "24900",
    "compareAtPriceCents": "34900",
    "weightGrams": 150,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 130,
    "imagePath": "/images/catalog/demo/vitaminas-2.webp",
    "imageAlt": "Ilustración de demostración de Vitamina C en cápsulas; no es una fotografía de un producto real.",
    "relatedSlug": "demo-vitaminas-3",
    "crossSellSlug": "demo-aminoacidos-1",
    "id": "cf4967f1-5fe2-404a-a041-3ed92c23accf",
    "variantId": "28316366-5eb4-4722-a1f5-949f44958487",
    "assetId": "90f9c877-5eec-42ce-a6ec-a5373873fbbb",
    "mediaId": "c3c29dc9-9873-4e5b-a550-a35bec7ecc14",
    "byteSize": 11680,
    "checksum": "9142221e0c142775a3bbdf252dac99f59ba944024ab07819255d4e9363ab703e"
  },
  {
    "code": "vitaminas-3",
    "categorySlug": "vitaminas",
    "categoryName": "Vitaminas",
    "label": "VITAMINAS",
    "color": "#638652",
    "container": "bottle",
    "index": 3,
    "slug": "demo-vitaminas-3",
    "name": "Vitamina D en cápsulas · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Vitamina D en cápsulas, presentación de 60 cápsulas. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Colecalciferol y excipientes ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Excipientes y trazas no verificados. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-VITAMINAS-03",
    "flavor": "Sin sabor",
    "presentationLabel": "60 cápsulas",
    "contentAmount": "60",
    "contentUnit": "cápsulas",
    "servings": "60",
    "servingAmount": "1",
    "servingUnit": "cápsula",
    "nutritionData": {
      "rows": [
        {
          "name": "Vitamina D",
          "amount": "10",
          "unit": "µg"
        }
      ]
    },
    "priceCents": "22900",
    "compareAtPriceCents": null,
    "weightGrams": 150,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 130,
    "imagePath": "/images/catalog/demo/vitaminas-3.webp",
    "imageAlt": "Ilustración de demostración de Vitamina D en cápsulas; no es una fotografía de un producto real.",
    "relatedSlug": "demo-vitaminas-4",
    "crossSellSlug": "demo-aminoacidos-1",
    "id": "0fce5e8a-d3e4-4237-afa7-003ae70b95f1",
    "variantId": "87955bcf-2e1c-4105-a599-43a840a304a7",
    "assetId": "58419790-d469-49ff-a4d4-d75daf9cf28d",
    "mediaId": "9f8acc2b-c375-4c5a-ac97-863a0447aec8",
    "byteSize": 11668,
    "checksum": "41d014949524afc06e445733e7ad57cbce05191caad1478fe840630bf1c9d316"
  },
  {
    "code": "vitaminas-4",
    "categorySlug": "vitaminas",
    "categoryName": "Vitaminas",
    "label": "VITAMINAS",
    "color": "#638652",
    "container": "bottle",
    "index": 4,
    "slug": "demo-vitaminas-4",
    "name": "Complejo B en cápsulas · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Complejo B en cápsulas, presentación de 120 cápsulas. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Vitaminas del complejo B y excipientes ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Excipientes y trazas no verificados. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-VITAMINAS-04",
    "flavor": "Sin sabor",
    "presentationLabel": "120 cápsulas",
    "contentAmount": "120",
    "contentUnit": "cápsulas",
    "servings": "120",
    "servingAmount": "1",
    "servingUnit": "cápsula",
    "nutritionData": {
      "rows": [
        {
          "name": "Vitamina B1",
          "amount": "1.2",
          "unit": "mg"
        },
        {
          "name": "Vitamina B6",
          "amount": "1.3",
          "unit": "mg"
        },
        {
          "name": "Vitamina B12",
          "amount": "2.4",
          "unit": "µg"
        }
      ]
    },
    "priceCents": "32900",
    "compareAtPriceCents": null,
    "weightGrams": 150,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 130,
    "imagePath": "/images/catalog/demo/vitaminas-4.webp",
    "imageAlt": "Ilustración de demostración de Complejo B en cápsulas; no es una fotografía de un producto real.",
    "relatedSlug": "demo-vitaminas-1",
    "crossSellSlug": "demo-aminoacidos-1",
    "id": "c6f32a2f-4701-4cd9-a3e6-619c24adaa25",
    "variantId": "88072d92-7630-4d42-a218-18695c9b7c9e",
    "assetId": "a67d9c28-3d64-40fd-a9a0-55ff592770fd",
    "mediaId": "da69b8d7-8ff3-4928-ae12-24c9533d4a3f",
    "byteSize": 11738,
    "checksum": "f4717d7c76d7d6158d0101ab78ac336945ef23fded5238be23be15a36baecdd4"
  },
  {
    "code": "aminoacidos-1",
    "categorySlug": "aminoacidos",
    "categoryName": "Aminoácidos",
    "label": "AMINOACIDOS",
    "color": "#ae6256",
    "container": "jar",
    "index": 1,
    "slug": "demo-aminoacidos-1",
    "name": "BCAA sabor frutos rojos · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. BCAA sabor frutos rojos, presentación de 300 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. L-leucina, L-isoleucina, L-valina y saborizante ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-AMINOACIDOS-01",
    "flavor": "Frutos rojos",
    "presentationLabel": "300 g",
    "contentAmount": "300",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "10",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "L-leucina",
          "amount": "2.5",
          "unit": "g"
        },
        {
          "name": "L-isoleucina",
          "amount": "1.25",
          "unit": "g"
        },
        {
          "name": "L-valina",
          "amount": "1.25",
          "unit": "g"
        }
      ]
    },
    "priceCents": "47900",
    "compareAtPriceCents": null,
    "weightGrams": 450,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/aminoacidos-1.webp",
    "imageAlt": "Ilustración de demostración de BCAA sabor frutos rojos; no es una fotografía de un producto real.",
    "relatedSlug": "demo-aminoacidos-2",
    "crossSellSlug": "demo-accesorios-1",
    "id": "ab9c303c-0aca-4bfb-a885-7495883579f2",
    "variantId": "9eb30823-c11a-4e85-a9d4-1f84d53a7f57",
    "assetId": "5294b42d-e136-4f5b-a1b5-fa684d3d21e7",
    "mediaId": "76791667-089e-4085-a872-82766f7b180c",
    "byteSize": 11958,
    "checksum": "1296994facb22e8665e165f03030bac3ace103d9c5ff7f20606b44c5e91e940c"
  },
  {
    "code": "aminoacidos-2",
    "categorySlug": "aminoacidos",
    "categoryName": "Aminoácidos",
    "label": "AMINOACIDOS",
    "color": "#ae6256",
    "container": "jar",
    "index": 2,
    "slug": "demo-aminoacidos-2",
    "name": "Aminoácidos esenciales limón · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Aminoácidos esenciales limón, presentación de 360 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Mezcla ilustrativa de aminoácidos esenciales y saborizante.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-AMINOACIDOS-02",
    "flavor": "Limón",
    "presentationLabel": "360 g",
    "contentAmount": "360",
    "contentUnit": "g",
    "servings": "30",
    "servingAmount": "12",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "Aminoácidos esenciales totales",
          "amount": "8",
          "unit": "g"
        }
      ]
    },
    "priceCents": "54900",
    "compareAtPriceCents": "64900",
    "weightGrams": 510,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/aminoacidos-2.webp",
    "imageAlt": "Ilustración de demostración de Aminoácidos esenciales limón; no es una fotografía de un producto real.",
    "relatedSlug": "demo-aminoacidos-3",
    "crossSellSlug": "demo-accesorios-1",
    "id": "3fbf47d1-0b4d-4427-a54f-a1ea56433805",
    "variantId": "d71aa3ac-8ad9-4c71-a8ec-13671328a2fd",
    "assetId": "3a7f4f36-9ad0-4c9f-a0c5-b4f580e8a244",
    "mediaId": "7f3cf48b-00b7-46bf-ac47-51aea81499e0",
    "byteSize": 11430,
    "checksum": "75d505d0cdd3c0cc091d1339104a4226ac545c77ccf4bdcf0bf12cbbc789836e"
  },
  {
    "code": "aminoacidos-3",
    "categorySlug": "aminoacidos",
    "categoryName": "Aminoácidos",
    "label": "AMINOACIDOS",
    "color": "#ae6256",
    "container": "jar",
    "index": 3,
    "slug": "demo-aminoacidos-3",
    "name": "Glutamina natural · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Glutamina natural, presentación de 300 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. L-glutamina ilustrativa.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-AMINOACIDOS-03",
    "flavor": "Natural",
    "presentationLabel": "300 g",
    "contentAmount": "300",
    "contentUnit": "g",
    "servings": "60",
    "servingAmount": "5",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "L-glutamina",
          "amount": "5",
          "unit": "g"
        }
      ]
    },
    "priceCents": "39900",
    "compareAtPriceCents": null,
    "weightGrams": 450,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/aminoacidos-3.webp",
    "imageAlt": "Ilustración de demostración de Glutamina natural; no es una fotografía de un producto real.",
    "relatedSlug": "demo-aminoacidos-4",
    "crossSellSlug": "demo-accesorios-1",
    "id": "fe856a06-6765-4f6b-ad53-f0d52b6bfee3",
    "variantId": "efd8a181-2126-422f-a837-ee8343dde4a8",
    "assetId": "8a7bf5c6-87e0-400b-ac16-2a05fa838848",
    "mediaId": "57dacb65-16cb-4b26-ac65-d45de571fd0a",
    "byteSize": 11638,
    "checksum": "dc8db8171657226dc64d97137e74351fe4bb1d1f5dcc827167aada97fc6b550f"
  },
  {
    "code": "aminoacidos-4",
    "categorySlug": "aminoacidos",
    "categoryName": "Aminoácidos",
    "label": "AMINOACIDOS",
    "color": "#ae6256",
    "container": "jar",
    "index": 4,
    "slug": "demo-aminoacidos-4",
    "name": "BCAA sabor mango · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. BCAA sabor mango, presentación de 240 g. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. L-leucina, L-isoleucina, L-valina y saborizante ilustrativos.",
    "usageInstructions": "DEMOSTRACIÓN. El tamaño de porción sirve únicamente para probar la ficha y el cálculo de costo. No es una dosis ni una pauta de consumo. Consultar la etiqueta real y a un profesional antes de utilizar un suplemento.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Sin declaración de alérgenos verificada. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-AMINOACIDOS-04",
    "flavor": "Mango",
    "presentationLabel": "240 g",
    "contentAmount": "240",
    "contentUnit": "g",
    "servings": "24",
    "servingAmount": "10",
    "servingUnit": "g",
    "nutritionData": {
      "rows": [
        {
          "name": "L-leucina",
          "amount": "2.5",
          "unit": "g"
        },
        {
          "name": "L-isoleucina",
          "amount": "1.25",
          "unit": "g"
        },
        {
          "name": "L-valina",
          "amount": "1.25",
          "unit": "g"
        }
      ]
    },
    "priceCents": "42900",
    "compareAtPriceCents": null,
    "weightGrams": 390,
    "lengthMm": 130,
    "widthMm": 130,
    "heightMm": 180,
    "imagePath": "/images/catalog/demo/aminoacidos-4.webp",
    "imageAlt": "Ilustración de demostración de BCAA sabor mango; no es una fotografía de un producto real.",
    "relatedSlug": "demo-aminoacidos-1",
    "crossSellSlug": "demo-accesorios-1",
    "id": "1d4dce9e-9456-44ca-a231-21d43b9e85c0",
    "variantId": "ebdadd94-026d-4cc5-a74c-02e9d5072334",
    "assetId": "5955e042-e59e-4751-aa02-775eda4b1665",
    "mediaId": "7f32cc53-4091-4620-affa-d16e3b275ef9",
    "byteSize": 11420,
    "checksum": "c05eb98d3924f98a006c5f140d8e980bff3ef4262b620582159d37766c503bfb"
  },
  {
    "code": "accesorios-1",
    "categorySlug": "accesorios",
    "categoryName": "Accesorios",
    "label": "ACCESORIOS",
    "color": "#64728b",
    "container": "accessory",
    "index": 1,
    "slug": "demo-accesorios-1",
    "name": "Shaker mezclador · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Shaker mezclador, presentación de 600 ml. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Material de ejemplo: polipropileno; capacidad ilustrativa de 600 ml.",
    "usageInstructions": "DEMOSTRACIÓN. Información de cuidado ilustrativa: limpiar y secar antes de guardar. Consultar las instrucciones reales del fabricante antes de utilizar un artículo equivalente.",
    "allergenInformation": "DATOS ILUSTRATIVOS. No aplica: accesorio no comestible. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-ACCESORIOS-01",
    "flavor": "No aplica",
    "presentationLabel": "600 ml",
    "contentAmount": "600",
    "contentUnit": "ml",
    "servings": null,
    "servingAmount": null,
    "servingUnit": null,
    "nutritionData": null,
    "priceCents": "14900",
    "compareAtPriceCents": null,
    "weightGrams": 180,
    "lengthMm": 100,
    "widthMm": 100,
    "heightMm": 220,
    "imagePath": "/images/catalog/demo/accesorios-1.webp",
    "imageAlt": "Ilustración de demostración de Shaker mezclador; no es una fotografía de un producto real.",
    "relatedSlug": "demo-accesorios-2",
    "crossSellSlug": "demo-proteina-1",
    "id": "924d2c9a-92c4-4316-ac02-2e82eeb5e3d4",
    "variantId": "4b3bf174-6d00-4e96-a019-6a710b4f1334",
    "assetId": "fd7c7cdb-f949-40fe-a8e8-f3a77a8d352a",
    "mediaId": "af7507f8-d3bf-43f8-a109-f774de897e01",
    "byteSize": 11286,
    "checksum": "4b270ffd938a8e2c7da50179251bd06ae567c00e4a19db35dc34de8af7e7c75b"
  },
  {
    "code": "accesorios-2",
    "categorySlug": "accesorios",
    "categoryName": "Accesorios",
    "label": "ACCESORIOS",
    "color": "#64728b",
    "container": "accessory",
    "index": 2,
    "slug": "demo-accesorios-2",
    "name": "Botella deportiva · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Botella deportiva, presentación de 750 ml. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Material de ejemplo: acero inoxidable; capacidad ilustrativa de 750 ml.",
    "usageInstructions": "DEMOSTRACIÓN. Información de cuidado ilustrativa: limpiar y secar antes de guardar. Consultar las instrucciones reales del fabricante antes de utilizar un artículo equivalente.",
    "allergenInformation": "DATOS ILUSTRATIVOS. No aplica: accesorio no comestible. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-ACCESORIOS-02",
    "flavor": "No aplica",
    "presentationLabel": "750 ml",
    "contentAmount": "750",
    "contentUnit": "ml",
    "servings": null,
    "servingAmount": null,
    "servingUnit": null,
    "nutritionData": null,
    "priceCents": "19900",
    "compareAtPriceCents": "29900",
    "weightGrams": 300,
    "lengthMm": 90,
    "widthMm": 90,
    "heightMm": 250,
    "imagePath": "/images/catalog/demo/accesorios-2.webp",
    "imageAlt": "Ilustración de demostración de Botella deportiva; no es una fotografía de un producto real.",
    "relatedSlug": "demo-accesorios-3",
    "crossSellSlug": "demo-proteina-1",
    "id": "67eaf987-9389-4a3f-aefe-0abb3d990aba",
    "variantId": "f9ceab76-6659-4377-a93a-5c1a60888a4b",
    "assetId": "19f012c9-0fac-4df9-a130-2bd26691bbbc",
    "mediaId": "a25397df-fb78-4c3b-a8f2-7175634ce812",
    "byteSize": 11340,
    "checksum": "72941417f92d83dadb7032cc3382762f561301ab5750860152128e26eee09cf8"
  },
  {
    "code": "accesorios-3",
    "categorySlug": "accesorios",
    "categoryName": "Accesorios",
    "label": "ACCESORIOS",
    "color": "#64728b",
    "container": "accessory",
    "index": 3,
    "slug": "demo-accesorios-3",
    "name": "Toalla deportiva · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Toalla deportiva, presentación de 1 piezas. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Material de ejemplo: microfibra; medidas ilustrativas de 40 × 80 cm.",
    "usageInstructions": "DEMOSTRACIÓN. Información de cuidado ilustrativa: limpiar y secar antes de guardar. Consultar las instrucciones reales del fabricante antes de utilizar un artículo equivalente.",
    "allergenInformation": "DATOS ILUSTRATIVOS. No aplica: accesorio no comestible. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-ACCESORIOS-03",
    "flavor": "No aplica",
    "presentationLabel": "1 piezas",
    "contentAmount": "1",
    "contentUnit": "piezas",
    "servings": null,
    "servingAmount": null,
    "servingUnit": null,
    "nutritionData": null,
    "priceCents": "12900",
    "compareAtPriceCents": null,
    "weightGrams": 120,
    "lengthMm": 220,
    "widthMm": 160,
    "heightMm": 40,
    "imagePath": "/images/catalog/demo/accesorios-3.webp",
    "imageAlt": "Ilustración de demostración de Toalla deportiva; no es una fotografía de un producto real.",
    "relatedSlug": "demo-accesorios-4",
    "crossSellSlug": "demo-proteina-1",
    "id": "c5293885-f4d0-42f0-a8ab-0cef4802a34b",
    "variantId": "0cc227cd-e21b-48d4-a4e4-b72f7f7bf971",
    "assetId": "10ba85d5-b7f1-499a-ac75-2c86ca8c3c15",
    "mediaId": "82208135-6ba1-4491-aca1-7c98e9689954",
    "byteSize": 10660,
    "checksum": "625cd0af4937c5e17ff12ca44b9d15839eb435090e5dc34f95751b48bede75a5"
  },
  {
    "code": "accesorios-4",
    "categorySlug": "accesorios",
    "categoryName": "Accesorios",
    "label": "ACCESORIOS",
    "color": "#64728b",
    "container": "accessory",
    "index": 4,
    "slug": "demo-accesorios-4",
    "name": "Bandas de resistencia · DEMO",
    "description": "ARTÍCULO DE DEMOSTRACIÓN. Bandas de resistencia, presentación de 3 piezas. Datos, precio, composición y medidas simulados para explorar el catálogo académico; no corresponden a una marca ni a una etiqueta comercial verificada. No representan existencias reales.",
    "ingredients": "DATOS ILUSTRATIVOS. Material de ejemplo: elastómero; juego ilustrativo de tres bandas.",
    "usageInstructions": "DEMOSTRACIÓN. Información de cuidado ilustrativa: limpiar y secar antes de guardar. Consultar las instrucciones reales del fabricante antes de utilizar un artículo equivalente.",
    "allergenInformation": "DATOS ILUSTRATIVOS. Ejemplo con posible látex; verificar composición real. Esta ficha no acredita ausencia de alérgenos.",
    "sku": "DEMO-ACCESORIOS-04",
    "flavor": "No aplica",
    "presentationLabel": "3 piezas",
    "contentAmount": "3",
    "contentUnit": "piezas",
    "servings": null,
    "servingAmount": null,
    "servingUnit": null,
    "nutritionData": null,
    "priceCents": "24900",
    "compareAtPriceCents": null,
    "weightGrams": 200,
    "lengthMm": 160,
    "widthMm": 120,
    "heightMm": 50,
    "imagePath": "/images/catalog/demo/accesorios-4.webp",
    "imageAlt": "Ilustración de demostración de Bandas de resistencia; no es una fotografía de un producto real.",
    "relatedSlug": "demo-accesorios-1",
    "crossSellSlug": "demo-proteina-1",
    "id": "cc7d3bd7-91f1-466a-aefa-099b5413847f",
    "variantId": "3657462e-205b-42e7-ac68-8493aadfba7f",
    "assetId": "f30c2084-06af-4ad6-a829-5ae0a10a866a",
    "mediaId": "064bcc9e-ab46-4947-adc8-ce95bc7ca852",
    "byteSize": 14626,
    "checksum": "729ca219336c8050b045900f122b437826609092edf43e9476cfadaa7cc35773"
  }
]$products$::jsonb)
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
  FOR item IN SELECT value FROM jsonb_array_elements($relations$[{"id":"0ac17dff-b0b8-485e-a960-70acf5e6aebe","relatedSlug":"demo-proteina-2","crossSellSlug":"demo-creatina-1"},{"id":"fd808239-5384-4405-ab1e-6b70c9d12f45","relatedSlug":"demo-proteina-3","crossSellSlug":"demo-creatina-1"},{"id":"b6869794-63d5-45e5-af00-2b0f597af49c","relatedSlug":"demo-proteina-4","crossSellSlug":"demo-creatina-1"},{"id":"57abe908-333b-4722-aa5b-f817afd9c643","relatedSlug":"demo-proteina-1","crossSellSlug":"demo-creatina-1"},{"id":"4a73fe54-4d30-4d89-a740-53dad6ab18a2","relatedSlug":"demo-creatina-2","crossSellSlug":"demo-pre-entreno-1"},{"id":"9871d4ae-ee5a-4485-a7ea-286c02d65117","relatedSlug":"demo-creatina-3","crossSellSlug":"demo-pre-entreno-1"},{"id":"7f40e9af-9830-416b-a2eb-19edd583b957","relatedSlug":"demo-creatina-4","crossSellSlug":"demo-pre-entreno-1"},{"id":"1e26479a-c6f8-4a55-a193-e0bae404913e","relatedSlug":"demo-creatina-1","crossSellSlug":"demo-pre-entreno-1"},{"id":"e3a00bd7-d7cd-46aa-aea0-d9db4c5c3d4b","relatedSlug":"demo-pre-entreno-2","crossSellSlug":"demo-electrolitos-1"},{"id":"bcf92174-acdd-460c-ad8f-aba00bc1555c","relatedSlug":"demo-pre-entreno-3","crossSellSlug":"demo-electrolitos-1"},{"id":"ae8e3639-262f-4b8b-ad2b-dff08f1a394a","relatedSlug":"demo-pre-entreno-4","crossSellSlug":"demo-electrolitos-1"},{"id":"85d67a90-0dfa-4ef1-ad5f-793e248905c4","relatedSlug":"demo-pre-entreno-1","crossSellSlug":"demo-electrolitos-1"},{"id":"cda93d48-98ce-44bd-a8b9-a7571139d427","relatedSlug":"demo-electrolitos-2","crossSellSlug":"demo-vitaminas-1"},{"id":"6cfc7ea8-f08c-4ec7-a872-e374b58794cf","relatedSlug":"demo-electrolitos-3","crossSellSlug":"demo-vitaminas-1"},{"id":"8c739020-62ee-4f31-ac72-eb1da939c1f4","relatedSlug":"demo-electrolitos-4","crossSellSlug":"demo-vitaminas-1"},{"id":"f3e535c0-55fb-4f7a-aa97-068b39768b96","relatedSlug":"demo-electrolitos-1","crossSellSlug":"demo-vitaminas-1"},{"id":"6ca72796-c31f-4751-ac1c-52d6e59e57c2","relatedSlug":"demo-vitaminas-2","crossSellSlug":"demo-aminoacidos-1"},{"id":"cf4967f1-5fe2-404a-a041-3ed92c23accf","relatedSlug":"demo-vitaminas-3","crossSellSlug":"demo-aminoacidos-1"},{"id":"0fce5e8a-d3e4-4237-afa7-003ae70b95f1","relatedSlug":"demo-vitaminas-4","crossSellSlug":"demo-aminoacidos-1"},{"id":"c6f32a2f-4701-4cd9-a3e6-619c24adaa25","relatedSlug":"demo-vitaminas-1","crossSellSlug":"demo-aminoacidos-1"},{"id":"ab9c303c-0aca-4bfb-a885-7495883579f2","relatedSlug":"demo-aminoacidos-2","crossSellSlug":"demo-accesorios-1"},{"id":"3fbf47d1-0b4d-4427-a54f-a1ea56433805","relatedSlug":"demo-aminoacidos-3","crossSellSlug":"demo-accesorios-1"},{"id":"fe856a06-6765-4f6b-ad53-f0d52b6bfee3","relatedSlug":"demo-aminoacidos-4","crossSellSlug":"demo-accesorios-1"},{"id":"1d4dce9e-9456-44ca-a231-21d43b9e85c0","relatedSlug":"demo-aminoacidos-1","crossSellSlug":"demo-accesorios-1"},{"id":"924d2c9a-92c4-4316-ac02-2e82eeb5e3d4","relatedSlug":"demo-accesorios-2","crossSellSlug":"demo-proteina-1"},{"id":"67eaf987-9389-4a3f-aefe-0abb3d990aba","relatedSlug":"demo-accesorios-3","crossSellSlug":"demo-proteina-1"},{"id":"c5293885-f4d0-42f0-a8ab-0cef4802a34b","relatedSlug":"demo-accesorios-4","crossSellSlug":"demo-proteina-1"},{"id":"cc7d3bd7-91f1-466a-aefa-099b5413847f","relatedSlug":"demo-accesorios-1","crossSellSlug":"demo-proteina-1"}]$relations$::jsonb)
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
