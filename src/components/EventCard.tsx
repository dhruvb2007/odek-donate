'use client';

import { Event } from '@/types';

interface EventCardProps {
  event: Event;
  onClick: () => void;
}

export default function EventCard({ event, onClick }: EventCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <h3 className="text-xl font-bold text-black mb-2">{event.name}</h3>
      {event.description && (
        <p className="text-gray-600 mb-4 text-sm">{event.description}</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <div>
          <p className="text-sm text-gray-500">Total Visitors</p>
          <p className="text-lg font-bold text-black">{event.totalVisitors}</p>
        </div>
      </div>
    </div>
  );
}
