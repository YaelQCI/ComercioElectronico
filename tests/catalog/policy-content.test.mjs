import test from 'node:test'
import assert from 'node:assert/strict'
import { policyContent } from '../../shared/features/policies/policy-content.js'
import { initialPolicies } from '../../server/features/policies/initial-policies.js'
test('contenido de políticas admite párrafos, tabulaciones y normaliza saltos de Windows', () => {
  assert.equal(policyContent('  Primer párrafo\r\n\r\nSegundo\rTercero\n\tLista  '), 'Primer párrafo\n\nSegundo\nTercero\n\tLista')
  for (const policy of initialPolicies) assert.equal(policyContent(policy.content), policy.content)
  assert.equal(policyContent('<script>texto sin interpretar</script>'), '<script>texto sin interpretar</script>')
  assert.equal(policyContent('a'.repeat(50000)).length, 50000)
})
test('rechaza texto vacío, exceso de longitud, tipos incorrectos y otros controles', () => {
  for (const value of [null, {}, 123, '', ' \r\n\t ']) assert.throws(() => policyContent(value), /Escribe/)
  assert.throws(() => policyContent('a'.repeat(50001)), /50,000/)
  for (const code of [0, 1, 8, 11, 12, 14, 31, 127]) assert.throws(() => policyContent(`Texto${String.fromCharCode(code)}otra línea`), /control/)
})
