'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event } from '@/types';
import { CustomField } from '@/types/customFields';
import EventLayout from '@/components/EventLayout';

export default function DownloadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const role = sessionStorage.getItem(`event_${id}_role`);
      const auth = sessionStorage.getItem(`event_${id}_auth`);

      if (!auth || !role) {
        router.push('/');
        return;
      }

      setIsAdmin(role === 'admin');
      setLoading(false);
    };

    checkAuth();
  }, [id, router]);

  // Real-time listener for event data
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'events', id), (doc) => {
      if (doc.exists()) {
        setEvent({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        } as Event);
      }
    });

    return () => unsubscribe();
  }, [id]);

  // Real-time listener for donations
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(collection(db, 'events', id, 'donations'), (snapshot) => {
      const donationsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
      setDonations(donationsList.sort((a, b) => b.createdAt - a.createdAt));
    });

    return () => unsubscribe();
  }, [id]);

  // Real-time listener for custom fields
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'events', id, 'config', 'donorForm'), (doc) => {
      if (doc.exists()) {
        const fields = doc.data().fields || [];
        setCustomFields(fields);
      }
    });

    return () => unsubscribe();
  }, [id]);

  const downloadCSV = () => {
    const headers = ['Donor Name', 'Amount (INR)', ...customFields.map(f => f.label), 'Date'];
    const rows = donations.map(d => [
      d.donorName,
      d.amount,
      ...customFields.map(f => d.customFields?.[f.id] || ''),
      d.createdAt.toLocaleDateString('en-IN'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.name || 'donations'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    const data = {
      event: {
        name: event?.name,
        description: event?.description,
        totalAmount: donations.reduce((sum, d) => sum + d.amount, 0),
        totalDonors: donations.length,
      },
      customFields: customFields.map(f => ({
        id: f.id,
        label: f.label,
        fieldType: f.fieldType,
      })),
      donations: donations.map(d => ({
        donorName: d.donorName,
        amount: d.amount,
        customFields: d.customFields || {},
        date: d.createdAt.toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.name || 'donations'}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printReport = () => {
    // Add print-specific styles
    const printStyles = document.createElement('style');
    printStyles.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #printable-area {
          visibility: visible;
          display: block !important;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 20px;
        }
        #printable-area * {
          visibility: visible;
        }
        table {
          page-break-inside: auto;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        thead {
          display: table-header-group;
        }
        @page {
          margin: 1cm;
          size: A4;
        }
      }
    `;
    document.head.appendChild(printStyles);
    
    window.print();
    
    // Clean up
    setTimeout(() => {
      document.head.removeChild(printStyles);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!event) {
    return <div>Event not found</div>;
  }

  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);

  return (
    <EventLayout eventId={id} eventName={event.name} isAdmin={isAdmin}>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-black">Download Reports</h2>
          <p className="text-gray-600">Export donation data in various formats</p>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-black mb-4">Report Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Event Name</p>
              <p className="font-semibold text-black">{event.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Donations</p>
              <p className="font-semibold text-black">{donations.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="font-semibold text-black">₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Download Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={downloadCSV}
            disabled={donations.length === 0}
            className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-lg hover:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-12 h-12 text-black mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="font-semibold text-black mb-1">Download CSV</h3>
            <p className="text-sm text-gray-500 text-center">Excel compatible format</p>
          </button>

          <button
            onClick={downloadJSON}
            disabled={donations.length === 0}
            className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-lg hover:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-12 h-12 text-black mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="font-semibold text-black mb-1">Download JSON</h3>
            <p className="text-sm text-gray-500 text-center">Developer friendly format</p>
          </button>

          <button
            onClick={printReport}
            disabled={donations.length === 0}
            className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-lg hover:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-12 h-12 text-black mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <h3 className="font-semibold text-black mb-1">Print Report</h3>
            <p className="text-sm text-gray-500 text-center">Print or save as PDF</p>
          </button>
        </div>

        {/* Preview */}
        {donations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No donations to download yet</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-black mb-4">Data Preview</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="pb-2 text-left text-gray-500">#</th>
                    <th className="pb-2 text-left text-gray-500">Donor</th>
                    <th className="pb-2 text-left text-gray-500">Amount</th>
                    {customFields.map(field => (
                      <th key={field.id} className="pb-2 text-left text-gray-500">{field.label}</th>
                    ))}
                    <th className="pb-2 text-left text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {donations.slice(0, 5).map((donation, index) => (
                    <tr key={donation.id}>
                      <td className="py-2 text-gray-500">{index + 1}</td>
                      <td className="py-2 text-black">{donation.donorName}</td>
                      <td className="py-2 text-black">₹{donation.amount.toLocaleString('en-IN')}</td>
                      {customFields.map(field => (
                        <td key={field.id} className="py-2 text-gray-600">
                          {donation.customFields?.[field.id] || '-'}
                        </td>
                      ))}
                      <td className="py-2 text-gray-500">{donation.createdAt.toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {donations.length > 5 && (
                <p className="text-sm text-gray-500 mt-3 text-center">
                  And {donations.length - 5} more donations...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Printable Area - Hidden on screen, visible when printing */}
        <div id="printable-area" className="hidden print:block">
          {/* Print Header */}
          <div className="text-center mb-8 border-b-2 border-black pb-4">
            <h1 className="text-3xl font-bold text-black mb-2">{event.name}</h1>
            {event.description && (
              <p className="text-md font-medium text-black mt-2">{event.description}</p>
            )}
            <p className="text-lg text-gray-700 mb-1">Donation Report</p>
            <p className="text-sm text-gray-600">
              Generated on: {new Date().toLocaleDateString('en-IN', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
            
          </div>

          {/* Summary Section */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="border border-gray-300 p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Total Donations</p>
              <p className="text-xl font-bold text-black">{donations.length}</p>
            </div>
            <div className="border border-gray-300 p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Total Amount</p>
              <p className="text-xl font-bold text-black">₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Donations Table */}
          <div className="mb-4">
            <h2 className="text-lg font-bold text-black mb-3">Donation Details</h2>
            <table className="w-full border-collapse border border-gray-300 text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-2 text-left font-semibold">#</th>
                  <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Donor Name</th>
                  
                  {customFields.map(field => (
                    <th key={field.id} className="border border-gray-300 px-2 py-2 text-left font-semibold">
                      {field.label}
                    </th>
                  ))}
                  <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Date</th>
                  <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((donation, index) => (
                  <tr key={donation.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-2 py-2">{index + 1}</td>
                    <td className="border border-gray-300 px-2 py-2 font-medium">{donation.donorName}</td>
                    
                    {customFields.map(field => (
                      <td key={field.id} className="border border-gray-300 px-2 py-2">
                        {donation.customFields?.[field.id] || '-'}
                      </td>
                    ))}
                    <td className="border border-gray-300 px-2 py-2">
                      {donation.createdAt.toLocaleDateString('en-IN')}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 font-semibold">
                      ₹{donation.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-200 font-bold">
                  <td colSpan={customFields.length + 3} className="border border-gray-300 px-2 py-2 text-right">Total:</td>
                  <td className="border border-gray-300 px-2 py-2">₹{totalAmount.toLocaleString('en-IN')}</td>                 
                </tr>
              </tfoot>
            </table>
          </div>         
        </div>
      </div>
    </EventLayout>
  );
}
