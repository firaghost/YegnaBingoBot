"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top ${
          notification.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Link href="/mgmt-portal-x7k9p2" className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all hover:scale-110">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white">Bank Accounts</h1>
                <p className="text-slate-400 text-sm mt-1">Manage withdrawal bank accounts</p>
              </div>
            </div>
            <button
              onClick={handleCreateBank}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <span>+</span> Add Account
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by bank name, account holder, or account number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">Total Accounts</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{banks.length}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">Active Accounts</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-1">{banks.filter(b => b.is_active).length}</p>
          </div>
        </div>

        {/* Banks Table */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              Loading bank accounts...
            </div>
          ) : filteredBanks.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              {searchTerm ? 'No accounts match your search' : 'No bank accounts found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50 border-b border-slate-700">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-300">Bank Name</th>
                    <th className="hidden sm:table-cell px-6 py-4 text-left text-sm font-semibold text-slate-300">Account Holder</th>
                    <th className="hidden md:table-cell px-6 py-4 text-left text-sm font-semibold text-slate-300">Account Number</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-300">Status</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredBanks.map((bank) => (
                    <tr key={bank.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="font-semibold text-white text-xs sm:text-sm">{bank.bank_name}</div>
                        {bank.branch && <div className="text-xs text-slate-400 mt-1 hidden sm:block">{bank.branch}</div>}
                        <div className="text-xs text-slate-400 sm:hidden">{bank.account_holder}</div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 text-slate-300 text-sm">{bank.account_holder}</td>
                      <td className="hidden md:table-cell px-6 py-4">
                        <code className="bg-slate-700/50 text-cyan-400 px-2 py-1 rounded text-xs">{bank.account_number}</code>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          bank.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-600/20 text-slate-400 border border-slate-600/30'
                        }`}>
                          {bank.is_active ? '●' : '○'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                        <div className="flex justify-end gap-1 sm:gap-2">
                          <button
                            onClick={() => handleEditBank(bank)}
                            className="bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-600/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-semibold transition-colors text-xs"
                            title="Edit account"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => toggleBankStatus(bank.id, bank.is_active)}
                            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-semibold transition-colors text-xs border ${
                              bank.is_active
                                ? 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border-amber-600/30'
                                : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border-emerald-600/30'
                            }`}
                            title={bank.is_active ? 'Disable account' : 'Enable account'}
                          >
                            {bank.is_active ? '⊘' : '✓'}
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
                            className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-semibold transition-colors text-xs"
                            title="Delete account"
                          >
                            🗑
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

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-1">
              {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
            </h2>
            <p className="text-slate-400 text-sm mb-6">Manage bank account details</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Bank Name *</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="Commercial Bank of Ethiopia"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Account Number *</label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                  placeholder="1000123456789"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Account Holder *</label>
                <input
                  type="text"
                  value={formData.account_holder}
                  onChange={(e) => setFormData({...formData, account_holder: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="BingoX Gaming Ltd"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Branch</label>
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => setFormData({...formData, branch: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="Addis Ababa Main Branch"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">SWIFT Code</label>
                <input
                  type="text"
                  value={formData.swift_code}
                  onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                  placeholder="CBETETAA"
                />
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-700">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                <label htmlFor="is_active" className="text-slate-300 text-sm font-medium">Mark as active</label>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-semibold transition-colors"
                >
                  {editingBank ? 'Update Account' : 'Add Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
