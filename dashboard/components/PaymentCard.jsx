import { useState } from 'react';

export default function PaymentCard({ payment, onApprove, onReject }) {
  const [amount, setAmount] = useState(payment.amount || '');
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setLoading(true);
    await onApprove(payment.id, parseFloat(amount));
    setLoading(false);
  };

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this payment?')) return;
    setLoading(true);
    await onReject(payment.id);
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            Receipt #{payment.receipt_number}
          </h3>
          <p className="text-sm text-gray-500">
            {new Date(payment.created_at).toLocaleString()}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          payment.status === 'approved' ? 'bg-green-100 text-green-800' :
          'bg-red-100 text-red-800'
        }`}>
          {payment.status}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-700">
          <span className="font-medium text-gray-900">User:</span> {payment.users?.username || 'Unknown'}
        </p>
        <p className="text-sm text-gray-700">
          <span className="font-medium text-gray-900">Telegram ID:</span> {payment.users?.telegram_id}
        </p>
        <p className="text-sm text-gray-700">
          <span className="font-medium text-gray-900">Current Balance:</span> {payment.users?.balance} Birr
        </p>
      </div>

      {payment.image_url && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Receipt Image:</p>
          <div className="bg-gray-100 p-2 rounded">
            <p className="text-xs text-gray-600">File ID: {payment.image_url}</p>
          </div>
        </div>
      )}

      {payment.status === 'pending' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (Birr)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              placeholder="Enter amount"
              min="0"
              step="0.01"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="btn btn-success flex-1"
            >
              {loading ? 'Processing...' : '✓ Approve'}
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="btn btn-danger flex-1"
            >
              {loading ? 'Processing...' : '✗ Reject'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
