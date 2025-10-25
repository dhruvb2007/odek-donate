'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EventAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  adminPassword: string;
  visitorPassword: string;
}

export default function EventAuthModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  adminPassword,
  visitorPassword,
}: EventAuthModalProps) {
  const [role, setRole] = useState<'admin' | 'visitor' | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!role) {
      setError('Please select a role');
      return;
    }

    const correctPassword = role === 'admin' ? adminPassword : visitorPassword;

    if (password !== correctPassword) {
      setError('Incorrect password');
      return;
    }

    // Store session info
    sessionStorage.setItem(`event_${eventId}_role`, role);
    sessionStorage.setItem(`event_${eventId}_auth`, 'true');

    // Navigate to event page
    router.push(`/event/${eventId}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-black text-2xl"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold mb-2 text-black">{eventName}</h2>
        <p className="text-gray-600 mb-6">Select your role and enter password</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setRole('visitor');
                  setError('');
                }}
                className={`px-4 py-3 border-2 rounded-lg transition-all ${
                  role === 'visitor'
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 text-black hover:border-gray-400'
                }`}
              >
                <div className="text-sm font-medium">Visitor</div>
                <div className="text-xs opacity-80">View Only</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('admin');
                  setError('');
                }}
                className={`px-4 py-3 border-2 rounded-lg transition-all ${
                  role === 'admin'
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 text-black hover:border-gray-400'
                }`}
              >
                <div className="text-sm font-medium">Admin</div>
                <div className="text-xs opacity-80">Manage</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {role ? `${role.charAt(0).toUpperCase() + role.slice(1)} Password` : 'Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPassword(value);
                setError('');
              }}
              required
              maxLength={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
              placeholder="Enter 4-digit password"
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-black"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Enter Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
