'use client';

import { useState } from 'react';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateEvent: (eventData: {
    name: string;
    description?: string;
    adminPassword: string;
    visitorPassword: string;
  }) => Promise<void>;
}

export default function CreateEventModal({
  isOpen,
  onClose,
  onCreateEvent,
}: CreateEventModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [visitorPassword, setVisitorPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (adminPassword.length !== 4 || !/^\d{4}$/.test(adminPassword)) {
      alert('Admin Password must be exactly 4 digits');
      return;
    }

    if (visitorPassword.length !== 4 || !/^\d{4}$/.test(visitorPassword)) {
      alert('Visitor Password must be exactly 4 digits');
      return;
    }

    if (adminPassword === visitorPassword) {
      alert('Admin Password and Visitor Password must be different');
      return;
    }

    setLoading(true);
    try {
      const eventData: any = {
        name,
        adminPassword,
        visitorPassword,
      };
      
      // Only add description if it has content
      if (description.trim()) {
        eventData.description = description.trim();
      }
      
      await onCreateEvent(eventData);
      
      // Reset form
      setName('');
      setDescription('');
      setAdminPassword('');
      setVisitorPassword('');
      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event');
    } finally {
      setLoading(false);
    }
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

        <h2 className="text-2xl font-bold mb-6 text-black">Create Event</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
              placeholder="Enter event name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black resize-none"
              placeholder="Describe your event (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Password (4 digits)
            </label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setAdminPassword(value);
              }}
              required
              maxLength={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
              placeholder="Enter 4-digit admin password"
            />
            <p className="text-xs text-gray-500 mt-1">
              Required to manage donations
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visitor Password (4 digits)
            </label>
            <input
              type="password"
              value={visitorPassword}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setVisitorPassword(value);
              }}
              required
              maxLength={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
              placeholder="Enter 4-digit visitor password"
            />
            <p className="text-xs text-gray-500 mt-1">
              Visitors can view donations only
            </p>
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
              disabled={loading}
              className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
