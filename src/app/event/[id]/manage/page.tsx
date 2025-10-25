'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, deleteDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event } from '@/types';
import EventLayout from '@/components/EventLayout';

export default function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [visitorPassword, setVisitorPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const role = sessionStorage.getItem(`event_${id}_role`);
      const auth = sessionStorage.getItem(`event_${id}_auth`);

      if (!auth || role !== 'admin') {
        router.push('/');
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };

    checkAuth();
  }, [id, router]);

  // Real-time listener for event data
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'events', id), (doc) => {
      if (doc.exists()) {
        const eventData = {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        } as Event;
        setEvent(eventData);
        setName(eventData.name);
        setDescription(eventData.description || '');
        setAdminPassword(eventData.adminPassword);
        setVisitorPassword(eventData.visitorPassword);
      }
    });

    return () => unsubscribe();
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
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

    try {
      const eventRef = doc(db, 'events', id);
      const updateData: any = {
        name,
        adminPassword,
        visitorPassword,
      };

      if (description.trim()) {
        updateData.description = description.trim();
      }

      await updateDoc(eventRef, updateData);
      setIsEditing(false);
      alert('Event updated successfully');
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Failed to update event');
    }
  };

  const handleDelete = async () => {
    try {
      // Delete all donations first
      const donationsCollection = collection(db, 'events', id, 'donations');
      const donationsSnapshot = await getDocs(donationsCollection);
      const deletePromises = donationsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Delete event
      await deleteDoc(doc(db, 'events', id));

      // Clear session
      sessionStorage.removeItem(`event_${id}_role`);
      sessionStorage.removeItem(`event_${id}_auth`);

      alert('Event deleted successfully');
      router.push('/');
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!event || !isAdmin) {
    return <div>Access denied</div>;
  }

  return (
    <EventLayout eventId={id} eventName={event.name} isAdmin={isAdmin}>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-black">Manage Event</h2>
          <p className="text-gray-600">Update event settings and information</p>
        </div>

        {/* Event Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-black">Event Information</h3>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-black"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
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
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Password
                  </label>
                  <input
                    type="text"
                    value={adminPassword}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setAdminPassword(value);
                    }}
                    required
                    maxLength={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visitor Password
                  </label>
                  <input
                    type="text"
                    value={visitorPassword}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setVisitorPassword(value);
                    }}
                    required
                    maxLength={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Save Changes
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Event Name</p>
                <p className="font-semibold text-black">{event.name}</p>
              </div>
              {event.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="text-black">{event.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Admin Password</p>
                  <p className="font-semibold text-black">{event.adminPassword}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Visitor Password</p>
                  <p className="font-semibold text-black">{event.visitorPassword}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created On</p>
                <p className="text-black">{event.createdAt.toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-black mb-4">Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Raised</p>
              <p className="text-2xl font-bold text-black">
                ₹{event.currentAmount.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Visitors</p>
              <p className="text-2xl font-bold text-black">{event.totalVisitors}</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h3>
          <p className="text-sm text-red-700 mb-4">
            Once you delete an event, there is no going back. Please be certain.
          </p>
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Event
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-900">
                Are you absolutely sure? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, Delete Event
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </EventLayout>
  );
}
