import test from 'node:test'
import assert from 'node:assert/strict'
import { imagesForVariant } from '../../shared/features/catalog/product-images.js'
test('medios específicos sustituyen genéricos del mismo tipo y nunca usan otra presentación', () => {
  const images = [{ id: 'generic-front', kind: 'FRONT', variantId: null }, { id: 'generic-nutrition', kind: 'NUTRITION', variantId: null }, { id: 'specific-front', kind: 'FRONT', variantId: 'a' }, { id: 'other-nutrition', kind: 'NUTRITION', variantId: 'b' }, { id: 'generic-gallery', kind: 'GALLERY', variantId: null }]
  assert.deepEqual(imagesForVariant(images, 'a').map(i => i.id), ['generic-nutrition', 'specific-front', 'generic-gallery'])
  assert.deepEqual(imagesForVariant(images, '').map(i => i.id), [])
})
