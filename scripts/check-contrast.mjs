import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../app/assets/css/tokens.css', import.meta.url), 'utf8')
const definitions = new Map([...css.matchAll(/--t-([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value]))
function color(name, theme) {
  const value = definitions.get(name)
  if (!value) throw new Error(`Token desconocido: ${name}`)
  const alias = value.match(/^var\(--t-([\w-]+)\)$/)
  if (alias) return color(alias[1], theme)
  const pair = value.match(/^light-dark\((#[\da-f]+),\s*(#[\da-f]+)\)$/i)
  return pair ? pair[theme === 'light' ? 1 : 2] : value
}
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
function ratio(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}
const pairs = []
for (const bg of ['paper', 'surface', 'surface-2']) {
  for (const fg of ['ink', 'ink-2', 'ink-3', 'accent-text', 'ok', 'warn', 'off', 'crit']) pairs.push([fg, bg, 4.5])
  pairs.push(['border', bg, 3], ['accent-text', bg, 3])
}
for (const status of ['ok', 'warn', 'off', 'crit']) pairs.push([status, `${status}-soft`, 4.5])
pairs.push(['accent-ink', 'accent', 4.5], ['accent-text', 'accent-soft', 4.5])
for (const fg of ['on-ink', 'on-ink-2', 'on-ink-3', 'on-ink-accent']) pairs.push([fg, 'ink', 4.5])
for (const fg of ['packshot-ink', 'packshot-ink-2', 'packshot-ink-3', 'packshot-off']) pairs.push([fg, 'packshot', 4.5])
let failures = 0
for (const theme of ['light', 'dark']) {
  let minimum = Infinity
  for (const [fg, bg, target] of pairs) {
    const contrast = ratio(color(fg, theme), color(bg, theme))
    minimum = Math.min(minimum, contrast)
    if (contrast < target) {
      console.error(`${theme}: ${fg}/${bg} ${contrast.toFixed(2)}:1 < ${target}:1`)
      failures++
    }
  }
  console.log(`${theme}: ${pairs.length} pares; contraste mínimo ${minimum.toFixed(2)}:1`)
}
if (failures) process.exitCode = 1
