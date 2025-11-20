// Professional Security Tab Component
// Import this into settings/page.tsx as: import SecurityTab from './settings-security-tab'

import { useState, useEffect } from 'react'
import { Lock, Users, Settings, Search, Plus, Save, Check, X, List } from 'lucide-react'
import { AdminTable } from '../components/AdminTable'
import { AdminEditModal } from '../components/AdminEditModal'
import { CreateAdminCard } from '../components/CreateAdminCard'

export function SecurityTab({
  isSuperAdmin,
  bypassEnabled,
  setBypass,
  wlUserIds,
  wlTgIds,
  wlUsernames,
  wlSearchTerm,
  setWlSearchTerm,
  wlResults,
  searchWhitelistUsers,
  addToWhitelist,
  removeFromWhitelist,
  saveWhitelist,
  wlSaving,
  admins,
  loadingAdmins,
  newAdmin,
  setNewAdmin,
  setAdmins,
  createAdmin,
  updateAdmin,
  admin,
}: any) {
  const [activeTab, setActiveTab] = useState<'profile' | 'bypass' | 'whitelist' | 'admins' | 'audit'>('profile')
  const [editingAdmin, setEditingAdmin] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  // Persist active tab to sessionStorage (current session only)
  const handleTabChange = (tab: 'profile' | 'bypass' | 'whitelist' | 'admins' | 'audit') => {
    setActiveTab(tab)
    try {
      sessionStorage.setItem('security_tab_active', tab)
    } catch (e) {
      console.warn('Failed to save security tab preference:', e)
    }
  }

  // Restore tab from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('security_tab_active')
      if (saved === 'profile' || saved === 'bypass' || saved === 'whitelist' || saved === 'admins' || saved === 'audit') {
        setActiveTab(saved)
      }
    } catch (e) {
      console.warn('Failed to restore security tab preference:', e)
    }
  }, [])

  // Central permission catalog (detailed)
  const PERMISSIONS: { key: string; label: string }[] = [
    { key: 'users_view', label: 'Users: View' },
    { key: 'users_manage', label: 'Users: Manage' },
    { key: 'games_view', label: 'Games: View' },
    { key: 'games_manage', label: 'Games: Manage' },
    { key: 'rooms_view', label: 'Rooms: View' },
    { key: 'rooms_manage', label: 'Rooms: Manage' },
    { key: 'banks_view', label: 'Banks: View' },
    { key: 'banks_manage', label: 'Banks: Manage' },
    { key: 'deposits_view', label: 'Deposits: View' },
    { key: 'deposits_manage', label: 'Deposits: Manage' },
    { key: 'withdrawals_view', label: 'Withdrawals: View' },
    { key: 'withdrawals_manage', label: 'Withdrawals: Manage' },
    { key: 'transactions_view', label: 'Transactions: View' },
    { key: 'broadcast_manage', label: 'Broadcast: Manage' },
    { key: 'settings_view', label: 'Settings: View' },
    { key: 'settings_manage', label: 'Settings: Manage' },
    { key: 'maintenance_toggle', label: 'Maintenance: Toggle' },
    { key: 'whitelist_manage', label: 'Whitelist: Manage' },
    { key: 'admin_manage', label: 'Admins: Manage' },
    { key: 'audit_view', label: 'Audit: View' },
  ]

  const PermissionChip = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
        active ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800/40 text-slate-300 border-slate-600 hover:bg-slate-700/40'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Security Settings</h2>
        <p className="text-slate-400">Manage maintenance mode, user access, and admin accounts</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-700 mb-6 overflow-x-auto">
        <button onClick={() => handleTabChange('profile')} className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-2 ${activeTab === 'profile' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Profile</span>
        </button>
        <button onClick={() => handleTabChange('bypass')} className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-2 ${activeTab === 'bypass' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
          <Lock className="w-4 h-4" />
          <span className="hidden sm:inline">Maintenance Bypass</span>
        </button>
        {isSuperAdmin && (
          <>
            <button onClick={() => handleTabChange('whitelist')} className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-2 ${activeTab === 'whitelist' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">User Whitelist</span>
            </button>
            <button onClick={() => handleTabChange('admins')} className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-2 ${activeTab === 'admins' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Admin Management</span>
            </button>
            <button onClick={() => handleTabChange('audit')} className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-2 ${activeTab === 'audit' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Audit Logs</span>
            </button>
          </>
        )}
      </div>

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 sm:p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-white mb-2">My Profile</h3>
            <p className="text-slate-400 mb-6">Update your own username or password</p>
            <MyProfileEditor
              admin={admin}
              onSave={(payload:any)=> updateAdmin({
                id: admin?.id,
                username: payload.username,
                role: admin?.role,
                old_password: payload.old_password,
                new_password: payload.new_password,
                confirm_password: payload.confirm_password,
              })}
            />
          </div>
        </div>
      )}

      {/* MAINTENANCE BYPASS TAB */}
      {activeTab === 'bypass' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 rounded-2xl border border-emerald-700/20 p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2">Browser Maintenance Bypass</h3>
                <p className="text-slate-400 mb-4">Enable this browser to access the app while maintenance mode is active. This sets a secure cookie on your device only.</p>
                <div className="inline-flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/30 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-emerald-300">Status: Ready to configure</span>
                </div>
              </div>
              <div className="flex gap-3 flex-col sm:flex-row">
                <button onClick={() => setBypass('enable')} className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-emerald-500/20 hover:shadow-xl">
                  ✓ Enable
                </button>
                <button onClick={() => setBypass('disable')} className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold transition-all duration-200 shadow-lg hover:shadow-slate-500/20 hover:shadow-xl">
                  ✕ Disable
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-3">How it works</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">→</span>
                <span>Click <strong>Enable</strong> to add a secure cookie to this browser</span>
              </li>
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">→</span>
                <span>You'll be able to use the app while other users see maintenance page</span>
              </li>
              <li className="flex gap-3">
                <span className="text-emerald-400 font-bold">→</span>
                <span>Cookie expires in 7 days or when you click <strong>Disable</strong></span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* USER WHITELIST TAB */}
      {activeTab === 'whitelist' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">User Whitelist</h3>
                <p className="text-slate-400">Users on this list bypass maintenance mode globally</p>
              </div>
              <button onClick={saveWhitelist} disabled={wlSaving} className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg whitespace-nowrap ${wlSaving ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700 text-white hover:shadow-cyan-500/20 hover:shadow-xl'}`}>
                {wlSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>

            {/* Search Section */}
            <div className="mb-6 bg-slate-900/40 border border-slate-700 rounded-xl p-4 sm:p-6">
              <label className="block text-sm font-semibold text-slate-300 mb-3">Search & Add Users</label>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input value={wlSearchTerm} onChange={e=>setWlSearchTerm(e.target.value)} onKeyDown={(e)=>{if((e as any).key==='Enter') searchWhitelistUsers()}} placeholder="Search by username or Telegram ID…" className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all text-sm" />
                <button onClick={searchWhitelistUsers} className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-blue-500/20 hover:shadow-xl whitespace-nowrap flex items-center justify-center gap-2">
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              </div>

              {/* Search Results */}
              {wlResults.length > 0 && (
                <div className="space-y-2">
                  {wlResults.map((u:any)=>(
                    <div key={u.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-800/50 hover:bg-slate-800/70 rounded-lg p-4 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white truncate">{u.username || '—'}</div>
                        <div className="text-xs text-slate-400 mt-1">Telegram: {u.telegram_id || 'N/A'} • ID: {String(u.id).slice(0,12)}</div>
                      </div>
                      <button onClick={()=>addToWhitelist(u)} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold transition-all duration-200 whitespace-nowrap flex items-center gap-1">
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Whitelist Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { type: 'uid' as const, title: 'User IDs', items: wlUserIds, count: wlUserIds.length },
                { type: 'tgid' as const, title: 'Telegram IDs', items: wlTgIds, count: wlTgIds.length },
                { type: 'uname' as const, title: 'Usernames', items: wlUsernames, count: wlUsernames.length },
              ].map(section => (
                <div key={section.type} className="bg-slate-900/40 border border-slate-700 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{section.title}</h4>
                    <span className="bg-cyan-600/20 text-cyan-300 text-xs font-bold px-2 py-1 rounded">{section.count}</span>
                  </div>
                  {section.count === 0 ? (
                    <div className="text-slate-500 text-sm py-4 text-center">No users added</div>
                  ) : (
                    <div className="space-y-2">
                      {section.items.map((v: any)=> (
                        <div key={v} className="flex items-center justify-between bg-slate-800/50 hover:bg-slate-800/70 rounded-lg px-3 py-2 transition-colors group">
                          <code className="text-xs text-slate-300 font-mono truncate">{section.type === 'uid' ? v.slice(0,12) : v}</code>
                          <button onClick={()=>removeFromWhitelist(section.type, v)} className="text-red-400 hover:text-red-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity ml-2">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MANAGEMENT TAB */}
      {activeTab === 'admins' && isSuperAdmin && (
        <div className="space-y-6">
          <CreateAdminCard
            newAdmin={newAdmin}
            setNewAdmin={setNewAdmin}
            onSubmit={createAdmin}
            PERMISSIONS={PERMISSIONS}
            PermissionChip={PermissionChip}
          />

          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 sm:p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-white mb-6">Manage Admins</h3>
            <AdminTable
              admins={admins}
              loading={loadingAdmins}
              onEdit={(admin: any) => {
                setEditingAdmin(admin)
                setShowEditModal(true)
              }}
              onResetPassword={(admin: any) => {
                setEditingAdmin(admin)
                setShowEditModal(true)
              }}
              onDelete={(admin: any) => {
                if (confirm(`Delete admin "${admin.username}"? This cannot be undone.`)) {
                  // TODO: Implement delete
                }
              }}
            />
          </div>

          <AdminEditModal
            admin={editingAdmin}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false)
              setEditingAdmin(null)
            }}
            onSave={async (updatedAdmin: any) => {
              await updateAdmin(updatedAdmin)
              setShowEditModal(false)
              setEditingAdmin(null)
            }}
            PERMISSIONS={PERMISSIONS}
            PermissionChip={PermissionChip}
          />
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'audit' && isSuperAdmin && (
        <AuditLogsTab adminIdHeader={admin?.id} />
      )}
    </div>
  )
}

// Small sub-component: My Profile Editor
function MyProfileEditor({ admin, onSave }: { admin: any; onSave: (p: any) => void }) {
  const [username, setUsername] = useState<string>(admin?.username || '')
  const [oldPassword, setOldPassword] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-3">Username</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" name="profile_username" className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all" />
      </div>

      <div className="space-y-4 border-t border-slate-700 pt-6">
        <h4 className="text-sm font-semibold text-slate-300">Change Password (Optional)</h4>
        
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Current Password</label>
          <div className="relative">
            <input value={oldPassword} onChange={e=>setOldPassword(e.target.value)} autoComplete="current-password" name="profile_current_password" type={showOld ? 'text' : 'password'} placeholder="Required to change password" className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all" />
            <button type="button" onClick={()=>setShowOld(!showOld)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-300">
              {showOld ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">New Password</label>
          <div className="relative">
            <input value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password" name="profile_new_password" type={showNew ? 'text' : 'password'} placeholder="Leave blank to keep current" className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all" />
            <button type="button" onClick={()=>setShowNew(!showNew)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-300">
              {showNew ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Confirm New Password</label>
          <div className="relative">
            <input value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" name="profile_confirm_password" type={showConfirm ? 'text' : 'password'} placeholder="Leave blank to keep current" className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all" />
            <button type="button" onClick={()=>setShowConfirm(!showConfirm)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-300">
              {showConfirm ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <button onClick={()=> onSave({ username, old_password: oldPassword, new_password: newPassword, confirm_password: confirmPassword })} className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all flex items-center gap-2">
        <Save className="w-4 h-4" />
        Save Changes
      </button>
    </div>
  )
}

// Sub-component: Audit Logs Tab
function AuditLogsTab({ adminIdHeader }: { adminIdHeader?: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const limit = 30

  async function fetchLogs() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (adminId) params.set('admin_id', adminId)
      if (action) params.set('action', action)
      params.set('limit', String(limit))
      const offset = (page - 1) * limit
      params.set('offset', String(offset))
      const headers: any = {}
      if (adminIdHeader) headers['x-admin-id'] = adminIdHeader
      const res = await fetch(`/api/admin/audit?${params.toString()}`, { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load audit logs')
      setLogs(data.data || [])
    } catch (e) {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, action, page])

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Filter by Admin ID</label>
              <input value={adminId} onChange={e=>setAdminId(e.target.value)} placeholder="UUID" className="w-full bg-slate-700/50 border border-slate-600 rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Filter by Action</label>
              <input value={action} onChange={e=>setAction(e.target.value)} placeholder="e.g., admin_update" className="w-full bg-slate-700/50 border border-slate-600 rounded px-3 py-2 text-white" />
            </div>
            <div className="flex items-end">
              <button onClick={fetchLogs} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium inline-flex items-center gap-2">
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-700 rounded-xl">
        <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs text-slate-400 border-b border-slate-700">
          <div>Time</div>
          <div>Admin ID</div>
          <div>Action</div>
          <div>Path</div>
          <div>IP</div>
          <div>Details</div>
        </div>
        {loading ? (
          <div className="p-4 text-slate-400">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-4 text-slate-500">No logs</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {logs.map((l:any) => (
              <div key={l.id} className="grid grid-cols-6 gap-2 px-4 py-2 text-sm text-slate-200">
                <div className="truncate">{new Date(l.created_at).toLocaleString()}</div>
                <div className="truncate">{l.admin_id || '—'}</div>
                <div className="truncate">{l.action}</div>
                <div className="truncate">{l.path || '—'}</div>
                <div className="truncate">{l.ip || '—'}</div>
                <div className="truncate text-xs text-slate-300">{JSON.stringify(l.details || {})}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={()=> setPage(p => Math.max(1, p-1))} className="px-3 py-1 rounded bg-slate-700 text-slate-200">Prev</button>
        <div className="text-slate-400 text-sm">Page {page}</div>
        <button onClick={()=> setPage(p => p+1)} className="px-3 py-1 rounded bg-slate-700 text-slate-200">Next</button>
      </div>
    </div>
  )
}
