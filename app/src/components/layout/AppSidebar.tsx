import React from 'react';
import {
  CalendarDays,
  Users,
  UserRoundCheck,
  Stethoscope,
  FileText,
  Bell,
  BarChart3,
  ShieldAlert,
  Settings,
  LayoutDashboard,
  Printer,
  UserCog,
  Trash2,
  X,
} from 'lucide-react';

export type NavItemKey =
  | 'dashboard'
  | 'appointments'
  | 'patients'
  | 'doctors'
  | 'treatments'
  | 'prescriptions'
  | 'reminders'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'staff'
  | 'trash';

export type NavSection = NavItemKey;

interface AppSidebarProps {
  currentTab?: NavItemKey;
  currentSection?: NavItemKey;
  onSelectTab?: (tab: NavItemKey) => void;
  onNavigate?: (tab: NavItemKey) => void;
  onOpenPrintCenter?: () => void;
  currentUser?: { name: string; role: string };
  // MOB-01: mobile drawer support
  isOpen?: boolean;
  onClose?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  currentSection,
  onSelectTab,
  onNavigate,
  onOpenPrintCenter,
  currentUser,
  isOpen = false,
  onClose,
}) => {
  const activeKey = currentSection || currentTab || 'dashboard';
  const handleSelect = onNavigate || onSelectTab || (() => {});

  const isAdmin = currentUser?.role === 'ADMIN';

  const navItems: { key: NavItemKey; label: string; icon: React.FC<{ className?: string; 'aria-hidden'?: boolean }> }[] = [
    { key: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
    { key: 'patients',      label: 'Patients',      icon: Users },
    { key: 'appointments',  label: 'Schedule',      icon: CalendarDays },
    { key: 'doctors',       label: 'Doctors',       icon: Stethoscope },
    { key: 'prescriptions', label: 'Prescriptions', icon: FileText },
    { key: 'treatments',    label: 'Treatments',    icon: UserRoundCheck },
    { key: 'reminders',     label: 'Reminders',     icon: Bell },
    { key: 'reports',       label: 'Reports',       icon: BarChart3 },
    // Audit logs are admin-only — hide the nav item for receptionists
    ...(isAdmin ? [{ key: 'audit' as NavItemKey, label: 'Audit Logs', icon: ShieldAlert }] : []),
    { key: 'settings',      label: 'Settings',      icon: Settings },
    { key: 'staff',         label: 'Staff Mgmt',    icon: UserCog },
    // Patient trash — visible to all authenticated users (ADMIN can empty, RECEPTIONIST can restore)
    { key: 'trash' as NavItemKey,  label: 'Patient Trash',  icon: Trash2 },
  ];

  return (
    // MOB-01: on mobile the sidebar is an absolute overlay (z-40) that slides
    // in from the left when isOpen=true. On md+ it is always visible (translate-x-0).
    <aside
      className={`
        fixed md:relative inset-y-0 left-0 z-40
        w-64 bg-navy-900 text-slate-200 flex flex-col shrink-0
        border-r border-black/30 select-none h-screen
        transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      style={{ backgroundColor: '#0a1628' }}
      aria-label="Main navigation"
    >
      {/* Brand Header + mobile close button */}
      <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-white font-black text-sm shadow-sm"
            style={{ backgroundColor: '#1e40af' }}
          >
            M
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-white font-black tracking-tight text-sm">MDS</span>
            <span className="text-slate-400 text-[10px] tracking-wide font-medium uppercase">Dental Clinic</span>
          </div>
        </div>
        {/* MOB-01: close button — only visible on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"
            style={{ hover: { backgroundColor: 'rgba(255,255,255,0.1)' } } as any}
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto" aria-label="Application sections">
        <div className="text-[10px] font-bold uppercase tracking-wider px-3 pb-2 pt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Navigation
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleSelect(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all text-left cursor-pointer ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={isActive
                ? { backgroundColor: '#1e40af' }
                : { backgroundColor: 'transparent' }
              }
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quick Print Center Action */}
      {onOpenPrintCenter && (
        <div className="px-4 pb-2">
          <button
            onClick={onOpenPrintCenter}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-300 hover:text-white rounded-md text-xs font-medium transition-colors border cursor-pointer"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Printer className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} aria-hidden="true" />
            <span>Print Center & Stationery</span>
          </button>
        </div>
      )}

      {/* User Profile Footer */}
      <div className="p-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div
          className="flex items-center gap-3 p-2 rounded-lg border"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="w-8 h-8 rounded-full text-white font-semibold flex items-center justify-center text-xs"
            style={{ backgroundColor: '#1e40af' }}
            aria-hidden="true"
          >
            {currentUser?.name?.charAt(0)?.toUpperCase() || 'R'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{currentUser?.name || 'Receptionist'}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{currentUser?.role || 'RECEPTIONIST'}</p>
          </div>
          <span
            className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
            role="img"
            aria-label="Online"
          ></span>
        </div>
      </div>
    </aside>
  );
};
