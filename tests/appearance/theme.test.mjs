import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validThemePreference } from '../../shared/features/accounts/theme-preference.js'

test('solo admite las tres preferencias de cuenta y rechaza valores no textuales', () => {
  for (const value of ['light', 'dark', 'system']) assert.equal(validThemePreference(value), true)
  for (const value of [null, undefined, '', 'LIGHT', 'automatic', '<script>', {}, ['dark'], 1]) assert.equal(validThemePreference(value), false)
})
