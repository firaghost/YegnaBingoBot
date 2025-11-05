import React from 'react';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}) {
  if (!isOpen) return null;

  const colors = {
    warning: {
      bg: 'from-yellow-500 to-orange-500',
      icon: '⚠️',
      button: 'bg-yellow-500 hover:bg-yellow-600'
    },
    danger: {
      bg: 'from-red-500 to-pink-500',
      icon: '🚨',
      button: 'bg-red-500 hover:bg-red-600'
    },
    info: {
      bg: 'from-blue-500 to-indigo-500',
      icon: 'ℹ️',
      button: 'bg-blue-500 hover:bg-blue-600'
    }
  };

  const color = colors[type] || colors.warning;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
        <div className={`bg-gradient-to-r ${color.bg} p-6 text-center`}>
          <div className="text-6xl mb-3">{color.icon}</div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
        </div>

        <div className="p-6">
          <p className="text-gray-700 text-center text-lg leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-xl transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 ${color.button} text-white font-semibold py-4 px-6 rounded-xl transition-all active:scale-95 shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
