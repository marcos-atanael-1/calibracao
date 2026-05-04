export const ROLE_ACCESS = {
  super_admin: ['dashboard', 'certificates', 'templates', 'queue', 'settings', 'users', 'ai_setup', 'notifications'],
  admin: ['dashboard', 'certificates', 'settings', 'users', 'notifications'],
  tecnico: ['dashboard', 'certificates', 'notifications'],
}

export function canAccessModule(role, moduleKey) {
  if (!role) return false
  return (ROLE_ACCESS[role] || []).includes(moduleKey)
}
