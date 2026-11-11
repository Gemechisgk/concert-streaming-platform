'use client';

import { useState, useEffect } from 'react';
import { User, SystemRole } from '@concert/types';
import { Users, Search, Shield, Ban, CheckCircle } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/v1/admin/reports')
      .then(res => res.json())
      .then(data => {
        if (data.users) setUsers(data.users);
      });
  }, []);

  const toggleUserStatus = (userId: string) => {
    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, isActive: !u.isActive } : u))
    );
  };

  const filteredUsers = users.filter(
    u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            User Accounts & RBAC Roles
          </h1>
          <p className="text-xs text-muted mt-1">
            Manage system roles, viewer permissions, staff access, and account suspensions.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="size-4 absolute left-3.5 top-3 text-muted" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="rounded-full border border-line bg-surface pl-10 pr-4 py-2 text-xs text-white placeholder-muted focus:outline-none focus:border-polo-red w-64"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-muted uppercase text-[10px] font-bold">
                <th className="py-3 px-3">User Profile</th>
                <th className="py-3 px-3">Email Address</th>
                <th className="py-3 px-3">Assigned Roles</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-surface-raised/40 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-polo-red/20 text-polo-red font-black flex items-center justify-center text-xs">
                        {u.name.charAt(0)}
                      </div>
                      <span className="font-bold text-white">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-neutral-300 font-mono text-xs">{u.email}</td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map(r => (
                        <span
                          key={r}
                          className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-surface-raised border border-line text-neutral-200"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {u.isActive ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => toggleUserStatus(u.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        u.isActive
                          ? 'border border-red-800 text-red-400 hover:bg-red-950/40'
                          : 'border border-emerald-800 text-emerald-400 hover:bg-emerald-950/40'
                      }`}
                    >
                      {u.isActive ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
