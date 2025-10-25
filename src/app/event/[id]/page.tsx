'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, addDoc, getDocs, Timestamp, updateDoc, increment, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event } from '@/types';
import { CustomField } from '@/types/customFields';
import EventLayout from '@/components/EventLayout';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState<any[]>([]);
  const [showAddDonor, setShowAddDonor] = useState(false);
  const [donorName, setDonorName] = useState('પ્રજાપતિ ');
  const [donorAmount, setDonorAmount] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [selectorModes, setSelectorModes] = useState<Record<string, 'select' | 'input'>>({});
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, string>>({});
  const [editingDonor, setEditingDonor] = useState<any | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

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
      const donorsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
      setDonors(donorsList);
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
        
        // Initialize selector modes for all selector fields
        const modes: Record<string, 'select' | 'input'> = {};
        fields.forEach((field: CustomField) => {
          if (field.fieldType === 'selector') {
            modes[field.id] = 'select';
          }
        });
        setSelectorModes(modes);
      }
    });

    return () => unsubscribe();
  }, [id]);

  const handleAddNewOption = async (fieldId: string, newOption: string) => {
    if (!newOption.trim()) return;

    try {
      // Find the field and update its options
      const updatedFields = customFields.map(field => {
        if (field.id === fieldId && field.fieldType === 'selector') {
          const updatedOptions = [...(field.options || []), newOption.trim()];
          return { ...field, options: updatedOptions };
        }
        return field;
      });

      // Save to Firestore
      const formConfigRef = doc(db, 'events', id, 'config', 'donorForm');
      await setDoc(formConfigRef, { fields: updatedFields });

      // Update local state
      setCustomFields(updatedFields);
      
      // Set the new option as selected value
      setCustomFieldValues(prev => ({
        ...prev,
        [fieldId]: newOption.trim()
      }));

      // Clear the new option input
      setNewOptionInputs(prev => ({
        ...prev,
        [fieldId]: ''
      }));

      // Switch back to select mode
      setSelectorModes(prev => ({
        ...prev,
        [fieldId]: 'select'
      }));
    } catch (error) {
      console.error('Error adding new option:', error);
      alert('Failed to add new option');
    };
  };

  const handleAddDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate custom required fields
    for (const field of customFields) {
      if (field.required && !customFieldValues[field.id]) {
        alert(`Please fill in the required field: ${field.label}`);
        return;
      }
    }
    
    try {
      const donationsCollection = collection(db, 'events', id, 'donations');
      
      const donationData: any = {
        donorName,
        amount: parseFloat(donorAmount),
        customFields: customFieldValues,
        createdAt: Timestamp.now(),
      };
      
      await addDoc(donationsCollection, donationData);

      // Update event's current amount and visitor count
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, {
        currentAmount: increment(parseFloat(donorAmount)),
        totalVisitors: increment(1),
      });

      // Reset form
      setDonorName('પ્રજાપતિ');
      setDonorAmount('');
      setCustomFieldValues({});
      setNewOptionInputs({});
      
      // Reset selector modes to 'select'
      const resetModes: Record<string, 'select' | 'input'> = {};
      customFields.forEach(field => {
        if (field.fieldType === 'selector') {
          resetModes[field.id] = 'select';
        }
      });
      setSelectorModes(resetModes);
      
      setShowAddDonor(false);
    } catch (error) {
      console.error('Error adding donor:', error);
      alert('Failed to add donor');
    }
  };

  const handleEditDonor = (donor: any) => {
    setEditingDonor(donor);
    setDonorName(donor.donorName);
    setDonorAmount(donor.amount.toString());
    setCustomFieldValues(donor.customFields || {});
    setShowAddDonor(false); // Don't show the top form
  };

  const handleUpdateDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingDonor) return;
    
    // Validate custom required fields
    for (const field of customFields) {
      if (field.required && !customFieldValues[field.id]) {
        alert(`Please fill in the required field: ${field.label}`);
        return;
      }
    }
    
    try {
      const donorRef = doc(db, 'events', id, 'donations', editingDonor.id);
      
      const donationData: any = {
        donorName,
        amount: parseFloat(donorAmount),
        customFields: customFieldValues,
        updatedAt: Timestamp.now(),
      };
      
      await updateDoc(donorRef, donationData);

      // Update event's current amount (difference between old and new)
      const amountDifference = parseFloat(donorAmount) - editingDonor.amount;
      if (amountDifference !== 0) {
        const eventRef = doc(db, 'events', id);
        await updateDoc(eventRef, {
          currentAmount: increment(amountDifference),
        });
      }

      // Reset form
      setDonorName('પ્રજાપતિ');
      setDonorAmount('');
      setCustomFieldValues({});
      setNewOptionInputs({});
      setEditingDonor(null);
      
      // Reset selector modes
      const resetModes: Record<string, 'select' | 'input'> = {};
      customFields.forEach(field => {
        if (field.fieldType === 'selector') {
          resetModes[field.id] = 'select';
        }
      });
      setSelectorModes(resetModes);
      
      setShowAddDonor(false);
    } catch (error) {
      console.error('Error updating donor:', error);
      alert('Failed to update donor');
    }
  };

  const handleDeleteDonor = async (donor: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Donor',
      message: `Are you sure you want to delete ${donor.donorName}'s donation of ₹${donor.amount.toLocaleString('en-IN')}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          // Delete the donor
          await deleteDoc(doc(db, 'events', id, 'donations', donor.id));

          // Update event's current amount and visitor count
          const eventRef = doc(db, 'events', id);
          await updateDoc(eventRef, {
            currentAmount: increment(-donor.amount),
            totalVisitors: increment(-1),
          });

          // Close modal
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        } catch (error) {
          console.error('Error deleting donor:', error);
          alert('Failed to delete donor');
        }
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingDonor(null);
    setDonorName('પ્રજાપતિ');
    setDonorAmount('');
    setCustomFieldValues({});
    setNewOptionInputs({});
    
    // Reset selector modes
    const resetModes: Record<string, 'select' | 'input'> = {};
    customFields.forEach(field => {
      if (field.fieldType === 'selector') {
        resetModes[field.id] = 'select';
      }
    });
    setSelectorModes(resetModes);
    
    setShowAddDonor(false);
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

  return (
    <EventLayout eventId={id} eventName={event.name} isAdmin={isAdmin}>
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-black">Donors</h2>
            <p className="text-gray-600">Manage and view all donors</p>
          </div>
          {isAdmin && (
            <button
              onClick={async () => {
                if (!showAddDonor) {
                  // Just open the form, custom fields are already loaded via real-time listener
                } else {
                  // Cancel editing if closing
                  handleCancelEdit();
                  return;
                }
                setShowAddDonor(!showAddDonor);
              }}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              {showAddDonor ? 'Cancel' : 'Add Donor'}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Total Raised</p>
            <p className="text-2xl font-bold text-black">
              ₹{event.currentAmount.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Total Donors</p>
            <p className="text-2xl font-bold text-black">{donors.length}</p>
          </div>
        </div>

        {/* Add Donor Form */}
        {showAddDonor && isAdmin && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-black mb-4">
              {editingDonor ? 'Edit Donor' : 'Add New Donor'}
            </h3>
            <form onSubmit={editingDonor ? handleUpdateDonor : handleAddDonor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Donor Name
                </label>
                <input
                  type="text"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                  placeholder="Enter donor name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={donorAmount}
                  onChange={(e) => setDonorAmount(e.target.value)}
                  required
                  min="1"
                  step="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                  placeholder="Enter amount"
                />
              </div>
              
              {/* Custom Fields */}
              {customFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && <span className="text-red-600">*</span>}
                  </label>
                  
                  {field.fieldType === 'text' && (
                    <input
                      type="text"
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) => setCustomFieldValues({
                        ...customFieldValues,
                        [field.id]: e.target.value
                      })}
                      required={field.required}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  )}
                  
                  {field.fieldType === 'numeric' && (
                    <input
                      type="number"
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) => setCustomFieldValues({
                        ...customFieldValues,
                        [field.id]: e.target.value
                      })}
                      required={field.required}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  )}
                  
                  {field.fieldType === 'selector' && (
                    <div className="space-y-2">
                      {/* Mode toggle for admin only */}
                      {isAdmin && (
                        <div className="flex flex-col sm:flex-row gap-2 text-sm">
                          <button
                            type="button"
                            onClick={() => setSelectorModes(prev => ({ ...prev, [field.id]: 'select' }))}
                            className={`px-3 py-1 rounded ${
                              selectorModes[field.id] === 'select'
                                ? 'bg-black text-white'
                                : 'bg-gray-200 text-black hover:bg-gray-300'
                            }`}
                          >
                            Select Existing
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectorModes(prev => ({ ...prev, [field.id]: 'input' }))}
                            className={`px-3 py-1 rounded ${
                              selectorModes[field.id] === 'input'
                                ? 'bg-black text-white'
                                : 'bg-gray-200 text-black hover:bg-gray-300'
                            }`}
                          >
                            Add New Option
                          </button>
                        </div>
                      )}
                      
                      {/* Selector dropdown */}
                      {(!isAdmin || selectorModes[field.id] === 'select') && (
                        <select
                          value={customFieldValues[field.id] || ''}
                          onChange={(e) => setCustomFieldValues({
                            ...customFieldValues,
                            [field.id]: e.target.value
                          })}
                          required={field.required}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                        >
                          <option value="">Select an option</option>
                          {field.options?.map((option, i) => (
                            <option key={i} value={option}>{option}</option>
                          ))}
                        </select>
                      )}
                      
                      {/* New option input (admin only) */}
                      {isAdmin && selectorModes[field.id] === 'input' && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={newOptionInputs[field.id] || ''}
                            onChange={(e) => setNewOptionInputs(prev => ({
                              ...prev,
                              [field.id]: e.target.value
                            }))}
                            className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                            placeholder={`Enter new ${field.label.toLowerCase()}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddNewOption(field.id, newOptionInputs[field.id] || '')}
                            disabled={!newOptionInputs[field.id]?.trim()}
                            className="w-full sm:w-auto px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            Add & Select
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {field.fieldType === 'radio' && (
                    <div className="space-y-2">
                      {field.options?.map((option, i) => (
                        <label key={i} className="flex items-center">
                          <input
                            type="radio"
                            name={field.id}
                            value={option}
                            checked={customFieldValues[field.id] === option}
                            onChange={(e) => setCustomFieldValues({
                              ...customFieldValues,
                              [field.id]: e.target.value
                            })}
                            required={field.required}
                            className="mr-2"
                          />
                          <span className="text-sm text-black">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              <button
                type="submit"
                className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                {editingDonor ? 'Update Donor' : 'Add Donor'}
              </button>
            </form>
          </div>
        )}

        {/* Donors List */}
        <div className="space-y-3">
          {donors.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No donors yet</p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddDonor(true)}
                  className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Add First Donor
                </button>
              )}
            </div>
          ) : (
            donors.map((donor) => (
              <div key={donor.id}>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-black">{donor.donorName}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-black">
                        ₹{donor.amount.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Display Custom Fields */}
                  {donor.customFields && Object.keys(donor.customFields).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      {customFields.map((field) => {
                        const value = donor.customFields[field.id];
                        if (value) {
                          return (
                            <div key={field.id} className="flex gap-2 text-sm">
                              <span className="text-gray-500">{field.label}:</span>
                              <span className="text-black font-medium">{value}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      {donor.createdAt.toLocaleDateString('en-IN')}
                    </p>
                    
                    {/* Edit and Delete buttons for admin */}
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditDonor(donor)}
                          className="px-3 py-1 text-xs bg-gray-100 text-black rounded hover:bg-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDonor(donor)}
                          className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Form - Shows inline below the donor card */}
                {editingDonor?.id === donor.id && isAdmin && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-2">
                    <h3 className="text-lg font-bold text-black mb-4">Edit Donor</h3>
                    <form onSubmit={handleUpdateDonor} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Donor Name
                        </label>
                        <input
                          type="text"
                          value={donorName}
                          onChange={(e) => setDonorName(e.target.value)}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                          placeholder="Enter donor name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={donorAmount}
                          onChange={(e) => setDonorAmount(e.target.value)}
                          required
                          min="1"
                          step="1"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                          placeholder="Enter amount"
                        />
                      </div>
                      
                      {/* Custom Fields */}
                      {customFields.map((field) => (
                        <div key={field.id}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label} {field.required && <span className="text-red-600">*</span>}
                          </label>
                          
                          {field.fieldType === 'text' && (
                            <input
                              type="text"
                              value={customFieldValues[field.id] || ''}
                              onChange={(e) => setCustomFieldValues({
                                ...customFieldValues,
                                [field.id]: e.target.value
                              })}
                              required={field.required}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          )}
                          
                          {field.fieldType === 'numeric' && (
                            <input
                              type="number"
                              value={customFieldValues[field.id] || ''}
                              onChange={(e) => setCustomFieldValues({
                                ...customFieldValues,
                                [field.id]: e.target.value
                              })}
                              required={field.required}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          )}
                          
                          {field.fieldType === 'selector' && (
                            <div className="space-y-2">
                              {/* Mode toggle for admin only */}
                              {isAdmin && (
                                <div className="flex flex-col sm:flex-row gap-2 text-sm">
                                  <button
                                    type="button"
                                    onClick={() => setSelectorModes(prev => ({ ...prev, [field.id]: 'select' }))}
                                    className={`px-3 py-1 rounded ${
                                      selectorModes[field.id] === 'select'
                                        ? 'bg-black text-white'
                                        : 'bg-gray-200 text-black hover:bg-gray-300'
                                    }`}
                                  >
                                    Select Existing
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectorModes(prev => ({ ...prev, [field.id]: 'input' }))}
                                    className={`px-3 py-1 rounded ${
                                      selectorModes[field.id] === 'input'
                                        ? 'bg-black text-white'
                                        : 'bg-gray-200 text-black hover:bg-gray-300'
                                    }`}
                                  >
                                    Add New Option
                                  </button>
                                </div>
                              )}
                              
                              {/* Selector dropdown */}
                              {(!isAdmin || selectorModes[field.id] === 'select') && (
                                <select
                                  value={customFieldValues[field.id] || ''}
                                  onChange={(e) => setCustomFieldValues({
                                    ...customFieldValues,
                                    [field.id]: e.target.value
                                  })}
                                  required={field.required}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                                >
                                  <option value="">Select an option</option>
                                  {field.options?.map((option, i) => (
                                    <option key={i} value={option}>{option}</option>
                                  ))}
                                </select>
                              )}
                              
                              {/* New option input (admin only) */}
                              {isAdmin && selectorModes[field.id] === 'input' && (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input
                                    type="text"
                                    value={newOptionInputs[field.id] || ''}
                                    onChange={(e) => setNewOptionInputs(prev => ({
                                      ...prev,
                                      [field.id]: e.target.value
                                    }))}
                                    className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                                    placeholder={`Enter new ${field.label.toLowerCase()}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddNewOption(field.id, newOptionInputs[field.id] || '')}
                                    disabled={!newOptionInputs[field.id]?.trim()}
                                    className="w-full sm:w-auto px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                                  >
                                    Add & Select
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {field.fieldType === 'radio' && (
                            <div className="space-y-2">
                              {field.options?.map((option, i) => (
                                <label key={i} className="flex items-center">
                                  <input
                                    type="radio"
                                    name={field.id}
                                    value={option}
                                    checked={customFieldValues[field.id] === option}
                                    onChange={(e) => setCustomFieldValues({
                                      ...customFieldValues,
                                      [field.id]: e.target.value
                                    })}
                                    required={field.required}
                                    className="mr-2"
                                  />
                                  <span className="text-sm text-black">{option}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          Update Donor
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="flex-1 px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </EventLayout>
  );
}
