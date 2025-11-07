import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import SuperAdminLayout from '../components/SuperAdminLayout';

export default function SuperSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [adminInfo, setAdminInfo] = useState({
    username: '',
    email: '',
    id: ''
  });

  useEffect(() => {
    const isSuperAuth = localStorage.getItem('superAdminAuth');
    if (!isSuperAuth) {
      router.push('/super-login');
      return;
    }

    // Load admin info
    setAdminInfo({
      username: localStorage.getItem('superAdminUsername') || '',
      email: localStorage.getItem('superAdminEmail') || '',
      id: localStorage.getItem('superAdminId') || ''
    });
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setMessage('');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validation
    if (!formData.oldPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (formData.newPassword === formData.oldPassword) {
      setError('New password must be different from old password');
      return;
    }

    setLoading(true);

    try {
      const sessionToken = localStorage.getItem('superAdminToken');

      const response = await fetch('/api/super-admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'changePassword',
          sessionToken,
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to change password');
        return;
      }

      if (data.success) {
        setMessage('Password changed successfully! Please login again.');
        setFormData({
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        });

        // Logout after 2 seconds
        setTimeout(() => {
          localStorage.clear();
          router.push('/super-login');
        }, 2000);
      }
    } catch (err) {
      console.error('Password change error:', err);
      setError('Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SuperAdminLayout>
      <Head>
        <title>Super Admin Settings - Yegna Bingo</title>
      </Head>

      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Settings</h1>
          <p className="text-base text-gray-600 mt-2">Manage your super admin account</p>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-gray-600 w-24">Username:</span>
              <span className="font-semibold text-gray-900">{adminInfo.username}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-600 w-24">Email:</span>
              <span className="font-semibold text-gray-900">{adminInfo.email || 'Not set'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-600 w-24">Role:</span>
              <span className="font-semibold text-purple-600">👑 System Owner</span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
          
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
              {message}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Current Password
              </label>
              <input
                type="password"
                name="oldPassword"
                value={formData.oldPassword}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                required
                minLength={8}
              />
              <p className="text-sm text-gray-500 mt-1">
                Minimum 8 characters
              </p>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-medium py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
