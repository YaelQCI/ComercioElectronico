import test from 'node:test'
import assert from 'node:assert/strict'
import { searchQuery, foldSearch, searchPattern } from '../../shared/features/catalog/search.js'
test('búsqueda normaliza espacios, mayúsculas y acentos, incluyendo Unicode descompuesto', () => {
  assert.equal(searchQuery('  PROTEÍNA  whey '), 'PROTEÍNA whey')
  assert.equal(foldSearch('PROTEÍNA'), foldSearch('proteina'))
  assert.equal(foldSearch('Protei\u0301na'), 'proteina')
  assert.equal(searchQuery('  '), '')
})
test('comodines se buscan literalmente y consultas inválidas se rechazan', () => {
  assert.equal(searchPattern('50%_\\'), '%50\\%\\_\\\\%')
  for (const bad of [['a', 'b'], {}, 'x'.repeat(121), 'a\u0000b']) assert.throws(() => searchQuery(bad))
})
