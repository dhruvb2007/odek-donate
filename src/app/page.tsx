'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event } from '@/types';
import EventCard from '@/components/EventCard';
import CreateEventModal from '@/components/CreateEventModal';
import EventAuthModal from '@/components/EventAuthModal';

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time listener for events
  useEffect(() => {
    setLoading(true);
    
    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Event[];

      setEvents(eventsList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching events:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateEvent = async (eventData: {
    name: string;
    description?: string;
    adminPassword: string;
    visitorPassword: string;
  }) => {
    try {
      const eventsCollection = collection(db, 'events');
      
      // Prepare data object, only include description if it has a value
      const eventDoc: any = {
        name: eventData.name,
        adminPassword: eventData.adminPassword,
        visitorPassword: eventData.visitorPassword,
        currentAmount: 0,
        totalVisitors: 0,
        createdAt: Timestamp.now(),
      };
      
      // Only add description if it exists and is not empty
      if (eventData.description && eventData.description.trim()) {
        eventDoc.description = eventData.description.trim();
      }
      
      await addDoc(eventsCollection, eventDoc);

    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-black">ODEK | Dhruv</h1>
              <p className="text-sm text-gray-600">Donate</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Create Event
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-black mb-2">Active Events</h2>
          <p className="text-gray-600">
            Browse and support ongoing donation events
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-4">No events yet</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Create First Event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                onClick={() => {
                  setSelectedEvent(event);
                  setIsAuthModalOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </main>
    
      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateEvent={handleCreateEvent}
      />

      {/* Event Auth Modal */}
      {selectedEvent && (
        <EventAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            setIsAuthModalOpen(false);
            setSelectedEvent(null);
          }}
          eventId={selectedEvent.id}
          eventName={selectedEvent.name}
          adminPassword={selectedEvent.adminPassword}
          visitorPassword={selectedEvent.visitorPassword}
        />
      )}
    </div>
  );
}
