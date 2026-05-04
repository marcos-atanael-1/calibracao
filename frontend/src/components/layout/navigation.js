import {
  LayoutDashboard,
  FileText,
  Settings,
  Bot,
  Users,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { canAccessModule } from '../../utils/access'

export const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, moduleKey: 'dashboard' },
  { to: '/certificates', label: 'Certificados', icon: FileText, moduleKey: 'certificates' },
  { to: '/templates', label: 'Templates', icon: Settings, moduleKey: 'templates' },
  { to: '/queue', label: 'Agente', icon: Bot, moduleKey: 'queue' },
  { to: '/settings', label: 'Configuracoes', icon: SlidersHorizontal, moduleKey: 'settings' },
  { to: '/users', label: 'Usuarios', icon: Users, moduleKey: 'users' },
  { to: '/ai-setup', label: 'IA Setup', icon: Sparkles, moduleKey: 'ai_setup' },
]

export function getVisibleNavItems(role) {
  return navItems.filter((item) => canAccessModule(role, item.moduleKey))
}
