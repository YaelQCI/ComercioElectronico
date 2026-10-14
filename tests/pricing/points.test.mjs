import test from 'node:test'
import assert from 'node:assert/strict'
import { earnedTenths, availableTenths, pointsLabel } from '../../shared/features/loyalty/points.js'
test('ganancia por dinero elegible retenido, redondeo total y precisión de décimas', () => {
  assert.equal(earnedTenths('999'), '0'); assert.equal(earnedTenths('1000'), '10'); assert.equal(earnedTenths('1999'), '10')
  assert.equal(earnedTenths('2000','1'), '10'); assert.equal(earnedTenths('90071992547409930'), '900719925474090')
  assert.equal(availableTenths('-30','10'), '0'); assert.equal(availableTenths('100','99'), '1')
  assert.equal(pointsLabel('1'), '0.1'); assert.equal(pointsLabel('-11'), '-1.1')
  assert.throws(() => earnedTenths('100','101'))
})
