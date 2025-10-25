'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event } from '@/types';
import { CustomField } from '@/types/customFields';
import EventLayout from '@/components/EventLayout';

export default function DonationsPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Get selector and radio fields for visualization
  const visualizableFields = customFields.filter(
    field => field.fieldType === 'selector' || field.fieldType === 'radio'
  );

  // Calculate data for charts
  const getChartData = (field: CustomField) => {
    const counts: Record<string, number> = {};
    const amounts: Record<string, number> = {};
    
    donations.forEach(donation => {
      const value = donation.customFields?.[field.id];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
        amounts[value] = (amounts[value] || 0) + donation.amount;
      }
    });

    return Object.entries(counts).map(([label, count]) => ({
      label,
      count,
      amount: amounts[label],
      percentage: ((count / donations.length) * 100).toFixed(1),
      amountPercentage: ((amounts[label] / totalAmount) * 100).toFixed(1)
    }));
  };

  // Vibrant colors for charts
  const chartColors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Orange
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316', // Dark Orange
  ];

  return (
    <EventLayout eventId={id} eventName={event.name} isAdmin={isAdmin}>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-black">View Donations</h2>
          <p className="text-gray-600">Complete list of all donations</p>
        </div>

        {/* Summary Card */}
        <div className="bg-black text-white p-6 rounded-lg mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-300 text-sm">Total Donations</p>
              <p className="text-3xl font-bold">{donations.length}</p>
            </div>
            <div>
              <p className="text-gray-300 text-sm">Total Amount</p>
              <p className="text-3xl font-bold">₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Data Visualization Charts */}
        {visualizableFields.length > 0 && donations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-black mb-4">Data Insights</h3>
            <div className="space-y-6">
              {visualizableFields.map(field => {
                const chartData = getChartData(field);
                const maxCount = Math.max(...chartData.map(d => d.count));
                const maxAmount = Math.max(...chartData.map(d => d.amount));
                
                return (
                  <div key={field.id} className="space-y-4">
                    <h4 className="font-semibold text-black text-lg">{field.label}</h4>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Donor Count Card */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-sm font-semibold text-gray-700">Donor Count Distribution</h5>
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {donations.length} Total Donors
                          </span>
                        </div>
                        
                        {/* Donor Count Bar Chart */}
                        <div className="space-y-3 mb-6">
                          {chartData.map((data, index) => (
                            <div key={index}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-700 font-medium">{data.label}</span>
                                <span className="text-gray-600">{data.count} ({data.percentage}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-3">
                                <div
                                  className="h-3 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${(data.count / maxCount) * 100}%`,
                                    backgroundColor: chartColors[index % chartColors.length]
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Donor Count Pie Chart */}
                        <div className="flex items-center justify-center gap-6">
                          <div className="relative w-32 h-32">
                            <div
                              className="absolute inset-0 rounded-full"
                              style={{
                                background: `conic-gradient(${chartData.map((data, index) => {
                                  const prevPercentages = chartData.slice(0, index).reduce((sum, d) => sum + parseFloat(d.percentage), 0);
                                  const currentPercentage = parseFloat(data.percentage);
                                  return `${chartColors[index % chartColors.length]} ${prevPercentages}% ${prevPercentages + currentPercentage}%`;
                                }).join(', ')})`,
                              }}
                            />
                            <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-gray-600">{donations.length}</span>
                            </div>
                          </div>
                          
                          {/* Legend */}
                          <div className="space-y-2">
                            {chartData.map((data, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-sm shrink-0"
                                  style={{ backgroundColor: chartColors[index % chartColors.length] }}
                                />
                                <span className="text-xs text-gray-700">{data.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Amount Distribution Card */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-sm font-semibold text-gray-700">Amount Distribution</h5>
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                            ₹{totalAmount.toLocaleString('en-IN')} Total
                          </span>
                        </div>
                        
                        {/* Amount Bar Chart */}
                        <div className="space-y-3 mb-6">
                          {chartData.map((data, index) => (
                            <div key={index}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-700 font-medium">{data.label}</span>
                                <span className="text-gray-600">₹{data.amount.toLocaleString('en-IN')} ({data.amountPercentage}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-3">
                                <div
                                  className="h-3 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${(data.amount / maxAmount) * 100}%`,
                                    backgroundColor: chartColors[index % chartColors.length]
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Amount Pie Chart */}
                        <div className="flex items-center justify-center gap-6">
                          <div className="relative w-32 h-32">
                            <div
                              className="absolute inset-0 rounded-full"
                              style={{
                                background: `conic-gradient(${chartData.map((data, index) => {
                                  const prevPercentages = chartData.slice(0, index).reduce((sum, d) => sum + parseFloat(d.amountPercentage), 0);
                                  const currentPercentage = parseFloat(data.amountPercentage);
                                  return `${chartColors[index % chartColors.length]} ${prevPercentages}% ${prevPercentages + currentPercentage}%`;
                                }).join(', ')})`,
                              }}
                            />
                            <div className="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center">
                              <span className="text-xs font-semibold text-gray-600">₹{(totalAmount / 1000).toFixed(0)}K</span>
                            </div>
                          </div>
                          
                          {/* Legend */}
                          <div className="space-y-2">
                            {chartData.map((data, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-sm shrink-0"
                                  style={{ backgroundColor: chartColors[index % chartColors.length] }}
                                />
                                <span className="text-xs text-gray-700">{data.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Donations Table */}
        {donations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No donations recorded yet</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Donor Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    {customFields.map(field => (
                      <th key={field.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                        {field.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {donations.map((donation) => (
                    <tr key={donation.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-black">
                        {donation.donorName}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-black">
                        ₹{donation.amount.toLocaleString('en-IN')}
                      </td>
                      {customFields.map(field => (
                        <td key={field.id} className="px-4 py-4 text-sm text-gray-600 hidden md:table-cell">
                          {donation.customFields?.[field.id] || '-'}
                        </td>
                      ))}
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {donation.createdAt.toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </EventLayout>
  );
}
