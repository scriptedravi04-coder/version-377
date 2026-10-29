import React from 'react';
import { SUB_ADMIN_MODULES, PLATFORM_SETTINGS_SUBS, FULL_SETTINGS_KEY } from '../../lib/adminPermissions';

// v294 (Ravi): same picker in "create sub-admin" and User → Permissions.
// Platform Settings is split per tab so Banners / Promo popups can go to a designer alone.
export default function SubAdminPermissionPicker({ permissions, onChange }) {
  const set = (key, val) => onChange({ ...permissions, [key]: val });
  const full = !!permissions[FULL_SETTINGS_KEY];

  const Row = ({ item, checked, disabled, onToggle, small }) => (
    <label className={`flex items-start gap-3 ${small ? 'p-3' : 'p-3.5'} border rounded-2xl transition-all ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} ${checked ? 'border-purple-200 bg-purple-50/40' : 'border-gray-100 bg-white hover:bg-gray-50'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 mt-0.5 text-[#A855F7] rounded border-gray-300 focus:ring-[#A855F7]" />
      <div className="flex-1">
        <div className={`${small ? 'text-xs' : 'text-sm'} font-bold text-gray-900`}>{item.label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
      </div>
    </label>
  );

  return (
    <div className="space-y-4" data-testid="sub-admin-permission-picker">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SUB_ADMIN_MODULES.map((m) => (
          <Row key={m.key} item={m} checked={!!permissions[m.key]} onToggle={(v) => set(m.key, v)} />
        ))}
      </div>

      <div className="border border-gray-100 rounded-2xl p-3.5 bg-gray-50/40 space-y-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">Platform Settings</div>
          <div className="text-xs text-gray-500 mt-0.5">Pick only the tabs this person should see. Banners + Promo popups is enough for a designer.</div>
        </div>
        <Row item={{ label: 'All Platform Settings', desc: 'Every tab below, including fees, coupons and maintenance' }}
          checked={full} onToggle={(v) => set(FULL_SETTINGS_KEY, v)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {PLATFORM_SETTINGS_SUBS.map((s) => (
            <Row key={s.key} small item={s} checked={full || !!permissions[s.key]} disabled={full}
              onToggle={(v) => set(s.key, v)} />
          ))}
        </div>
      </div>
    </div>
  );
}
