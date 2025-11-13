"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
  
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_holder: '',
    branch: '',
    swift_code: '',
    is_active: true
  })

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
    if (!confirm('Are you sure you want to delete this bank account? This action cannot be undone.')) {
      return
    }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/mgmt-portal-x7k9p2" className="text-2xl text-white hover:opacity-70">←</Link>
              <h1 className="text-2xl font-bold text-white">Bank Account Management</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border animate-slide-in ${
            notification.type === 'success'
              ? 'bg-green-500/90 border-green-400 text-white'
              : 'bg-red-500/90 border-red-400 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
              }`}>
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {notification.type === 'success' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
              </div>
              <span className="font-medium">{notification.message}</span>
            </div>
          </div>
        )}

        {/* Create Bank Button */}
        <div className="mb-6">
          <button
            onClick={handleCreateBank}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            + Add Bank Account
          </button>
        </div>

        {/* Banks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-400">
              Loading bank accounts...
            </div>
          ) : banks.length === 0 ? (
            <div className="col-span-full bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-400">
              No bank accounts found
            </div>
          ) : (
            banks.map((bank) => (
              <div key={bank.id} className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{bank.bank_name}</h3>
                    <p className="text-gray-400 text-sm">{bank.account_holder}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    bank.is_active ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {bank.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Account Number:</span>
                    <span className="font-mono text-white">{bank.account_number}</span>
                  </div>
                  {bank.branch && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Branch:</span>
                      <span className="text-white">{bank.branch}</span>
                    </div>
                  )}
                  {bank.swift_code && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">SWIFT Code:</span>
                      <span className="font-mono text-white">{bank.swift_code}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleEditBank(bank)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleBankStatus(bank.id, bank.is_active)}
                    className={`py-2 rounded-lg font-semibold transition-colors text-sm ${
                      bank.is_active
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {bank.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteBank(bank.id)}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Bank Name *</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="Commercial Bank of Ethiopia"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Account Number *</label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="1000123456789"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Account Holder *</label>
                <input
                  type="text"
                  value={formData.account_holder}
                  onChange={(e) => setFormData({...formData, account_holder: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="BingoX Gaming Ltd"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Branch</label>
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => setFormData({...formData, branch: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="Addis Ababa Main Branch"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">SWIFT Code</label>
                <input
                  type="text"
                  value={formData.swift_code}
                  onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="CBETETAA"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-gray-300">Active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  {editingBank ? 'Update Bank' : 'Add Bank'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
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
