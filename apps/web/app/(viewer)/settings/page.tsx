'use client';

import { useState } from 'react';
import { User, Bell, Lock, Shield, Check } from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-12">
      <div className="border-b border-line pb-6 mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-polo-red">Preferences</span>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white mt-1">
          Account Settings
        </h1>
      </div>

      {saved && (
        <div className="mb-6 rounded-2xl bg-emerald-950/60 border border-emerald-800 p-4 text-xs text-emerald-200 flex items-center gap-2">
          <Check className="size-4 text-emerald-400" />
          <span>Your settings have been saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Details */}
        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 space-y-4">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <User className="size-4 text-polo-red" />
            Viewer Profile
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted mb-1.5">Full Name</label>
              <input
                type="text"
                defaultValue="Abebe Bikila"
                className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted mb-1.5">Email Address</label>
              <input
                type="email"
                defaultValue="viewer@feshtafest.com"
                className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Streaming & Notifications */}
        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 space-y-4">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Bell className="size-4 text-polo-red" />
            Stream Notifications
          </h2>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-polo-red size-4" />
              <span className="text-white">Email broadcast reminder 1 hour before stage show begins</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-polo-red size-4" />
              <span className="text-white">SMS alerts for newly scheduled Ethiopian concert tours</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="rounded-full bg-polo-red px-8 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-polo-red-dark transition-all shadow-xl"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
