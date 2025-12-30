"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { Ban, Check, Eye, EyeOff, Pencil, Plus, Search, Trash2, X } from 'lucide-react'

interface BankAccount {
  id: string
  bank_name: string
  account_number: string
  account_holder: string
  branch?: string
  swift_code?: string
  is_active: boolean
  created_at: string
}

export default function BankManagement() {
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [telebirrLoading, setTelebirrLoading] = useState(false)
  const [telebirrSaving, setTelebirrSaving] = useState(false)
  const [telebirrEnabled, setTelebirrEnabled] = useState(false)
  const [telebirrApiKey, setTelebirrApiKey] = useState('')
  const [telebirrShowKey, setTelebirrShowKey] = useState(false)

  const { admin, loading: adminLoading } = useAdminAuth()
  
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_holder: '',
    branch: '',
    swift_code: '',
    is_active: true
  })

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'destructive'
    onConfirm?: () => void
  }>({ title: '', message: '' })

  useEffect(() => {
    fetchBanks()
  }, [])

  useEffect(() => {
    if (adminLoading) return
    if (!admin) return
    void loadTelebirrConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLoading, admin])

  const loadTelebirrConfig = async () => {
    if (!admin) return
    try {
      setTelebirrLoading(true)
      const res = await fetch('/api/admin/telebirr-config', {
        headers: { 'x-admin-id': admin.id },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to load Telebirr config')
      setTelebirrEnabled(Boolean(json?.data?.enabled))
      setTelebirrApiKey(String(json?.data?.apiKey || ''))
    } catch (e: any) {
      showNotification('error', e?.message || 'Failed to load Telebirr config')
    } finally {
      setTelebirrLoading(false)
    }
  }

  const saveTelebirrConfig = async () => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }
    try {
      setTelebirrSaving(true)
      const res = await fetch('/api/admin/telebirr-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({ enabled: telebirrEnabled, apiKey: telebirrApiKey }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to save Telebirr config')
      setTelebirrEnabled(Boolean(json?.data?.enabled))
      setTelebirrApiKey(String(json?.data?.apiKey || ''))
      showNotification('success', 'Telebirr configuration saved')
    } catch (e: any) {
      showNotification('error', e?.message || 'Failed to save Telebirr config')
    } finally {
      setTelebirrSaving(false)
    }
  }

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setBanks(data || [])
    } catch (error) {
      console.error('Error fetching banks:', error)
      showNotification('error', 'Failed to fetch bank accounts')
    } finally {
      setLoading(false)
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleCreateBank = () => {
    setEditingBank(null)
    setFormData({
      bank_name: '',
      account_number: '',
      account_holder: '',
      branch: '',
      swift_code: '',
      is_active: true
    })
    setShowCreateModal(true)
  }

  const handleEditBank = (bank: BankAccount) => {
    setEditingBank(bank)
    setFormData({
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      account_holder: bank.account_holder,
      branch: bank.branch || '',
      swift_code: bank.swift_code || '',
      is_active: bank.is_active
    })
    setShowCreateModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const bankData = {
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        account_holder: formData.account_holder,
        branch: formData.branch || null,
        swift_code: formData.swift_code || null,
        is_active: formData.is_active
      }

      if (editingBank) {
        const { error } = await supabase
          .from('bank_accounts')
          .update(bankData)
          .eq('id', editingBank.id)
        
        if (error) throw error
        showNotification('success', 'Bank account updated successfully!')
      } else {
        const { error } = await supabase
          .from('bank_accounts')
          .insert(bankData)
        
        if (error) throw error
        showNotification('success', 'Bank account created successfully!')
      }

      setShowCreateModal(false)
      fetchBanks()
    } catch (error: any) {
      console.error('Error saving bank:', error)
      showNotification('error', error.message || 'Failed to save bank account')
    }
  }

  const toggleBankStatus = async (bankId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: !currentStatus })
        .eq('id', bankId)

      if (error) throw error
      
      showNotification('success', `Bank account ${!currentStatus ? 'activated' : 'deactivated'} successfully!`)
      fetchBanks()
    } catch (error: any) {
      console.error('Error updating bank status:', error)
      showNotification('error', 'Failed to update bank status')
    }
  }

  const handleDeleteBank = async (bankId: string) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', bankId)

      if (error) throw error
      
      showNotification('success', 'Bank account deleted successfully!')
      fetchBanks()
    } catch (error: any) {
      console.error('Error deleting bank:', error)
      showNotification('error', 'Failed to delete bank account')
    }
  }

  const filteredBanks = banks.filter(bank =>
    bank.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bank.account_holder.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bank.account_number.includes(searchTerm)
  )

  return (
    <AdminShell title="Payment Configuration">
      <AdminConfirmModal
        open={confirmOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        cancelLabel={confirmConfig.cancelLabel}
        variant={confirmConfig.variant}
        onConfirm={() => {
          setConfirmOpen(false)
          confirmConfig.onConfirm?.()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-20 right-4 px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top border shadow-lg text-sm ${
          notification.type === 'success'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : 'bg-red-500/20 text-red-300 border-red-500/30'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <p className="text-white text-3xl font-extrabold tracking-tight">Banks &amp; Payments</p>
            <p className="text-[#A0A0A0] text-base font-medium">Configure gateways and manual transfer accounts.</p>
          </div>
          <button
            onClick={handleCreateBank}
            className="flex items-center gap-2 cursor-pointer justify-center overflow-hidden rounded-lg h-11 px-5 bg-[#d4af35] hover:bg-[#c29d2b] transition-colors text-[#1C1C1C] text-sm font-bold shadow-[0_4px_12px_rgba(212,175,53,0.2)]"
            type="button"
          >
            <Plus className="w-5 h-5" />
            <span className="truncate">Add New Bank</span>
          </button>
        </div>

        {/* Telebirr Configuration */}
        <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-[#333333] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-md size-8 flex items-center justify-center">
                <span className="text-black text-[12px] font-bold">TB</span>
              </div>
              <div>
                <h2 className="text-white font-bold text-base sm:text-lg">Telebirr Integration</h2>
                <p className="text-[#A0A0A0] text-xs sm:text-sm">Enable Telebirr and configure your API key.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm text-[#A0A0A0]">Status</span>
              <button
                type="button"
                onClick={() => setTelebirrEnabled((v) => !v)}
                disabled={telebirrLoading || !admin}
                className={`relative w-11 h-6 rounded-full transition-colors ${telebirrEnabled ? 'bg-[#d4af35]' : 'bg-[#333333]'} ${telebirrLoading || !admin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                aria-label="Toggle Telebirr"
              >
                <div className={`absolute top-[2px] left-[2px] bg-white border border-gray-300 rounded-full h-5 w-5 transition-transform ${telebirrEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-white text-sm font-medium">API Key</span>
                <div className="relative">
                  <input
                    className="w-full rounded-lg bg-[#1a1a1a] border border-[#333333] text-white text-sm px-4 py-3 focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] placeholder-[#666666] pr-12"
                    placeholder="TB_LIVE_xxxxxxxxx"
                    value={telebirrApiKey}
                    onChange={(e) => setTelebirrApiKey(e.target.value)}
                    type={telebirrShowKey ? 'text' : 'password'}
                    disabled={telebirrLoading || !admin}
                  />
                  <button
                    type="button"
                    onClick={() => setTelebirrShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] hover:text-white"
                    disabled={telebirrLoading || !admin}
                    title={telebirrShowKey ? 'Hide' : 'Show'}
                  >
                    {telebirrShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-xs text-[#A0A0A0]">We store this in admin configuration. Keep it private.</span>
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-white text-sm font-medium">Webhook URL</span>
                <input
                  className="w-full rounded-lg bg-[#1a1a1a]/50 border border-[#333333] text-[#A0A0A0] text-sm px-4 py-3"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/telebirr`}
                />
                <span className="text-xs text-[#A0A0A0]">Configure this webhook in Telebirr dashboard after you get the key.</span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={saveTelebirrConfig}
                disabled={telebirrSaving || telebirrLoading || !admin}
                className="bg-[#d4af35]/10 hover:bg-[#d4af35]/20 text-[#d4af35] border border-[#d4af35]/20 font-bold py-2.5 px-6 rounded-lg text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {telebirrSaving ? 'Saving…' : 'Save Credentials'}
              </button>
            </div>
          </div>
        </div>

        {/* Manual Banks */}
        <div className="flex flex-col gap-4">
          <h3 className="text-white text-xl font-bold">Manual Bank Accounts</h3>

          <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#333333] flex gap-4 flex-wrap items-center">
              <div className="relative flex-1 min-w-[240px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0b6a9] w-4 h-4" />
                <input
                  className="bg-[#1a1a1a] text-white text-sm rounded-lg pl-9 pr-4 py-2 border border-[#333333] focus:ring-1 focus:ring-[#d4af35] w-full placeholder-[#666666]"
                  placeholder="Search banks..."
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

          {loading ? (
            <div className="p-12 text-center text-[#a0b6a9]">
              <div className="w-8 h-8 border-4 border-[#3e5146] border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              Loading bank accounts...
            </div>
          ) : filteredBanks.length === 0 ? (
            <div className="p-12 text-center text-[#a0b6a9]">
              {searchTerm ? 'No accounts match your search' : 'No bank accounts found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1a1a1a] border-b border-[#333333]">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-[#a0b6a9] uppercase tracking-wider">Bank Name</th>
                    <th className="hidden sm:table-cell px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#a0b6a9] uppercase tracking-wider">Account Holder</th>
                    <th className="hidden md:table-cell px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#a0b6a9] uppercase tracking-wider">Account Number</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-[#a0b6a9] uppercase tracking-wider">Status</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-[#a0b6a9] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333333]">
                  {filteredBanks.map((bank) => (
                    <tr key={bank.id} className="hover:bg-[#2a2a2a] transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="font-semibold text-white text-xs sm:text-sm">{bank.bank_name}</div>
                        {bank.branch && <div className="text-xs text-[#a0b6a9] mt-1 hidden sm:block">{bank.branch}</div>}
                        <div className="text-xs text-[#a0b6a9] sm:hidden">{bank.account_holder}</div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 text-[#a0b6a9] text-sm">{bank.account_holder}</td>
                      <td className="hidden md:table-cell px-6 py-4">
                        <code className="bg-[#151a17] border border-[#3e5146] text-white px-2 py-1 rounded text-xs">{bank.account_number}</code>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          bank.is_active
                            ? 'bg-[#d4af35]/10 text-[#d4af35] border border-[#d4af35]/20'
                            : 'bg-[#a0b6a9]/10 text-[#a0b6a9] border border-[#a0b6a9]/20'
                        }`}>
                          {bank.is_active ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                        <div className="flex justify-end gap-1 sm:gap-2">
                          <button
                            onClick={() => handleEditBank(bank)}
                            className="p-2 text-[#a0b6a9] hover:text-white hover:bg-[#3e5146] rounded-lg transition-colors"
                            title="Edit account"
                            type="button"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleBankStatus(bank.id, bank.is_active)}
                            className={`p-2 rounded-lg transition-colors ${
                              bank.is_active
                                ? 'text-[#a0b6a9] hover:text-white hover:bg-[#3e5146]'
                                : 'text-[#d4af35] hover:text-white hover:bg-[#d4af35]/20'
                            }`}
                            title={bank.is_active ? 'Disable account' : 'Enable account'}
                            type="button"
                          >
                            {bank.is_active ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => {
                              setConfirmConfig({
                                title: 'Delete bank account',
                                message:
                                  'Are you sure you want to delete this bank account? This action cannot be undone.',
                                confirmLabel: 'Delete',
                                cancelLabel: 'Cancel',
                                variant: 'destructive',
                                onConfirm: () => {
                                  void handleDeleteBank(bank.id)
                                },
                              })
                              setConfirmOpen(true)
                            }}
                            className="p-2 text-[#a0b6a9] hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete account"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
                </h2>
                <p className="text-[#A0A0A0] text-sm mt-1">Configure manual transfer accounts shown to users.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#d4af35] transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Bank Name *</label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                    className="w-full bg-[#1a1a1a] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35] transition-colors"
                    placeholder="Commercial Bank of Ethiopia"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-medium mb-2">Account Holder *</label>
                  <input
                    type="text"
                    value={formData.account_holder}
                    onChange={(e) => setFormData({...formData, account_holder: e.target.value})}
                    className="w-full bg-[#1a1a1a] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35] transition-colors"
                    placeholder="BingoX Gaming Ltd"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Account Number *</label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                    className="w-full bg-[#1a1a1a] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35] transition-colors font-mono"
                    placeholder="1000123456789"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-medium mb-2">Branch</label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => setFormData({...formData, branch: e.target.value})}
                    className="w-full bg-[#1a1a1a] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35] transition-colors"
                    placeholder="Addis Ababa Main Branch"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">SWIFT Code</label>
                <input
                  type="text"
                  value={formData.swift_code}
                  onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                  className="w-full bg-[#1a1a1a] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35] transition-colors font-mono"
                  placeholder="CBETETAA"
                />
              </div>

              <div className="flex items-center justify-between gap-4 p-4 bg-[#1a1a1a] rounded-lg border border-[#333333]">
                <div>
                  <div className="text-white text-sm font-semibold">Active</div>
                  <div className="text-[#A0A0A0] text-xs mt-0.5">Show this account to users for manual transfers.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-[#d4af35]' : 'bg-[#333333]'}`}
                  aria-label="Toggle active"
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#333333]">
                <button
                  type="submit"
                  className="flex-1 bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] py-2.5 rounded-lg font-semibold transition-colors"
                >
                  {editingBank ? 'Update Account' : 'Add Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#333333] text-white py-2.5 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
