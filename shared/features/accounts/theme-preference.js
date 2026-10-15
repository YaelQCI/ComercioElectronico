export const themePreferences = ['light', 'dark', 'system']
export function validThemePreference(value) {
  return typeof value === 'string' && themePreferences.includes(value)
}
