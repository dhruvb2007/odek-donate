'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event } from '@/types';
import { CustomField, FieldType } from '@/types/customFields';
import EventLayout from '@/components/EventLayout';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function ManageDonorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showAddField, setShowAddField] = useState(false);

  // New field form state
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [editingOptionIndex, setEditingOptionIndex] = useState<{ fieldId: string; index: number } | null>(null);
  const [editingOptionValue, setEditingOptionValue] = useState('');
  const [addingOptionToField, setAddingOptionToField] = useState<string | null>(null);
  const [newOptionInput, setNewOptionInput] = useState('');
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
        setEvent({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        } as Event);
      }
    });

    return () => unsubscribe();
  }, [id]);

  // Real-time listener for custom fields
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'events', id, 'config', 'donorForm'), (doc) => {
      if (doc.exists()) {
        setCustomFields(doc.data().fields || []);
      }
    });

    return () => unsubscribe();
  }, [id]);

  const saveCustomFields = async (fields: CustomField[]) => {
    try {
      // Clean fields to remove undefined values
      const cleanedFields = fields.map(field => {
        const cleanField: any = {
          id: field.id,
          label: field.label,
          fieldType: field.fieldType,
          required: field.required,
          order: field.order,
        };
        
        // Only add options if they exist and are not empty
        if (field.options && field.options.length > 0) {
          cleanField.options = field.options;
        }
        
        return cleanField;
      });
      
      await setDoc(doc(db, 'events', id, 'config', 'donorForm'), {
        fields: cleanedFields,
        updatedAt: Timestamp.now(),
      });
      setCustomFields(fields);
    } catch (error) {
      console.error('Error saving custom fields:', error);
      alert('Failed to save custom fields');
    }
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) {
      alert('Please enter a field label');
      return;
    }

    if ((newFieldType === 'selector' || newFieldType === 'radio') && newFieldOptions.length === 0) {
      alert('Please add at least one option for selector/radio fields');
      return;
    }

    const newField: CustomField = {
      id: Date.now().toString(),
      label: newFieldLabel.trim(),
      fieldType: newFieldType,
      required: newFieldRequired,
      order: customFields.length,
    };
    
    // Only add options if fieldType is selector or radio
    if (newFieldType === 'selector' || newFieldType === 'radio') {
      newField.options = newFieldOptions;
    }

    await saveCustomFields([...customFields, newField]);

    // Reset form
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldOptions([]);
    setShowAddField(false);
  };

  const handleDeleteField = async (fieldId: string) => {
    const field = customFields.find(f => f.id === fieldId);
    if (!field) return;

    setConfirmModal({
      isOpen: true,
      title: 'Delete Field',
      message: `Are you sure you want to delete the field "${field.label}"? This action cannot be undone.`,
      onConfirm: async () => {
        const updatedFields = customFields
          .filter(f => f.id !== fieldId)
          .map((f, index) => ({ ...f, order: index }));
        await saveCustomFields(updatedFields);
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
      }
    });
  };

  const handleMoveField = async (fieldId: string, direction: 'up' | 'down') => {
    const index = customFields.findIndex(f => f.id === fieldId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === customFields.length - 1) return;

    const newFields = [...customFields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    
    const updatedFields = newFields.map((f, i) => ({ ...f, order: i }));
    await saveCustomFields(updatedFields);
  };

  const handleAddOption = () => {
    if (optionInput.trim() && !newFieldOptions.includes(optionInput.trim())) {
      setNewFieldOptions([...newFieldOptions, optionInput.trim()]);
      setOptionInput('');
    }
  };

  const handleRemoveOption = (option: string) => {
    setNewFieldOptions(newFieldOptions.filter(o => o !== option));
  };

  const handleEditExistingOption = (fieldId: string, optionIndex: number, currentValue: string) => {
    setEditingOptionIndex({ fieldId, index: optionIndex });
    setEditingOptionValue(currentValue);
  };

  const handleSaveEditedOption = async (fieldId: string) => {
    if (!editingOptionIndex || !editingOptionValue.trim()) return;

    const updatedFields = customFields.map(field => {
      if (field.id === fieldId && field.options) {
        const newOptions = [...field.options];
        newOptions[editingOptionIndex.index] = editingOptionValue.trim();
        return { ...field, options: newOptions };
      }
      return field;
    });

    await saveCustomFields(updatedFields);
    setEditingOptionIndex(null);
    setEditingOptionValue('');
  };

  const handleDeleteExistingOption = (fieldId: string, optionIndex: number, optionValue: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Option',
      message: `Are you sure you want to delete the option "${optionValue}"? This action cannot be undone.`,
      onConfirm: async () => {
        const updatedFields = customFields.map(field => {
          if (field.id === fieldId && field.options) {
            const newOptions = field.options.filter((_, i) => i !== optionIndex);
            return { ...field, options: newOptions };
          }
          return field;
        });

        await saveCustomFields(updatedFields);
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
      }
    });
  };

  const handleAddNewOptionToField = async (fieldId: string) => {
    if (!newOptionInput.trim()) {
      alert('Please enter an option value');
      return;
    }

    const updatedFields = customFields.map(field => {
      if (field.id === fieldId && field.options) {
        // Check if option already exists
        if (field.options.includes(newOptionInput.trim())) {
          alert('This option already exists');
          return field;
        }
        return { ...field, options: [...field.options, newOptionInput.trim()] };
      }
      return field;
    });

    await saveCustomFields(updatedFields);
    setNewOptionInput('');
    setAddingOptionToField(null);
  };

  const handleUpdateField = async (fieldId: string, updates: Partial<CustomField>) => {
    const updatedFields = customFields.map(f => 
      f.id === fieldId ? { ...f, ...updates } : f
    );
    await saveCustomFields(updatedFields);
    setEditingField(null);
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
          <h2 className="text-2xl md:text-2xl font-bold text-black">Manage Donor Form</h2>
          <p className="text-base md:text-base text-gray-600">Customize fields for adding donors</p>
        </div>

        {/* Default Fields */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 md:p-4 mb-6">
          <h3 className="font-semibold text-black mb-3 text-base md:text-base">Default Fields (Always Present)</h3>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white px-3 md:px-4 py-2 rounded border border-gray-200 gap-1 sm:gap-0">
              <div>
                <span className="font-medium text-black text-base md:text-base">Donor Name</span>
                <span className="ml-2 text-sm md:text-xs text-red-600">Required</span>
              </div>
              <span className="text-sm md:text-sm text-gray-500">Text</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white px-3 md:px-4 py-2 rounded border border-gray-200 gap-1 sm:gap-0">
              <div>
                <span className="font-medium text-black text-base md:text-base">Amount (₹)</span>
                <span className="ml-2 text-sm md:text-xs text-red-600">Required</span>
              </div>
              <span className="text-sm md:text-sm text-gray-500">Numeric</span>
            </div>
          </div>
        </div>

        {/* Custom Fields */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3 sm:gap-0">
            <h3 className="font-semibold text-black text-base md:text-base">Custom Fields</h3>
            <button
              onClick={() => setShowAddField(!showAddField)}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-base md:text-sm w-full sm:w-auto"
            >
              {showAddField ? 'Cancel' : '+ Add Field'}
            </button>
          </div>

          {/* Add New Field Form */}
          {showAddField && (
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
              <h4 className="font-medium text-black mb-3 text-base md:text-base">Create New Field</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-base md:text-sm font-medium text-gray-700 mb-1">
                    Field Label
                  </label>
                  <input
                    type="text"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black text-base md:text-base"
                    placeholder="e.g., Phone Number"
                  />
                </div>

                <div>
                  <label className="block text-base md:text-sm font-medium text-gray-700 mb-1">
                    Field Type
                  </label>
                  <select
                    value={newFieldType}
                    onChange={(e) => {
                      setNewFieldType(e.target.value as FieldType);
                      setNewFieldOptions([]);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black text-base md:text-base"
                  >
                    <option value="text">Text</option>
                    <option value="numeric">Numeric</option>
                    <option value="selector">Selector (Dropdown)</option>
                    <option value="radio">Radio Buttons</option>
                  </select>
                </div>

                {(newFieldType === 'selector' || newFieldType === 'radio') && (
                  <div>
                    <label className="block text-base md:text-sm font-medium text-gray-700 mb-1">
                      Options
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2 mb-2">
                      <input
                        type="text"
                        value={optionInput}
                        onChange={(e) => setOptionInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                        className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black text-base md:text-base"
                        placeholder="Enter option and press Enter"
                      />
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors text-base md:text-base"
                      >
                        Add
                      </button>
                    </div>
                    <div className="space-y-1">
                      {newFieldOptions.map((option, index) => (
                        <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                          <span className="text-base md:text-sm text-black break-all pr-2">{option}</span>
                          <button
                            onClick={() => handleRemoveOption(option)}
                            className="text-red-600 hover:text-red-800 text-sm sm:text-sm whitespace-nowrap shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="required"
                    checked={newFieldRequired}
                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                    className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                  />
                  <label htmlFor="required" className="ml-2 text-base md:text-sm text-gray-700">
                    Required field
                  </label>
                </div>

                <button
                  onClick={handleAddField}
                  className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-base md:text-base"
                >
                  Add Field
                </button>
              </div>
            </div>
          )}

          {/* Custom Fields List */}
          <div className="space-y-2">
            {customFields.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-base md:text-base">
                No custom fields yet. Click "Add Field" to create one.
              </p>
            ) : (
              customFields.map((field, index) => (
                <div key={field.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 md:p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-black text-base md:text-base wrap-break-word">{field.label}</span>
                        <span className={`text-sm md:text-xs ${field.required ? 'text-red-600' : 'text-gray-400'}`}>
                          {field.required ? 'Required' : 'Optional'}
                        </span>
                        <span className="text-sm md:text-xs bg-gray-200 px-2 py-1 rounded">
                          {field.fieldType === 'numeric' ? 'Numeric' : 
                           field.fieldType === 'selector' ? 'Selector' :
                           field.fieldType === 'radio' ? 'Radio' : 'Text'}
                        </span>
                      </div>
                      {field.options && field.options.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm md:text-xs text-gray-500 mb-1">Options:</p>
                          <div className="space-y-1">
                            {field.options.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200">
                                {editingOptionIndex?.fieldId === field.id && editingOptionIndex.index === optionIndex ? (
                                  <>
                                    <input
                                      type="text"
                                      value={editingOptionValue}
                                      onChange={(e) => setEditingOptionValue(e.target.value)}
                                      className="flex-1 min-w-0 px-2 py-1 text-base md:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-black text-black"
                                      autoFocus
                                    />
                                    <div className="flex gap-1 shrink-0">
                                      <button
                                        onClick={() => handleSaveEditedOption(field.id)}
                                        className="text-sm md:text-xs px-2 py-1 bg-black text-white rounded hover:bg-gray-800"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingOptionIndex(null);
                                          setEditingOptionValue('');
                                        }}
                                        className="text-sm md:text-xs px-2 py-1 bg-gray-200 text-black rounded hover:bg-gray-300"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="flex-1 min-w-0 text-base md:text-sm text-black break-all">{option}</span>
                                    <div className="flex gap-1 shrink-0">
                                      <button
                                        onClick={() => handleEditExistingOption(field.id, optionIndex, option)}
                                        className="text-sm md:text-xs text-gray-600 hover:text-black"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteExistingOption(field.id, optionIndex, option)}
                                        className="text-sm md:text-xs text-red-600 hover:text-red-800"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            
                            {/* Add New Option Input */}
                            {(field.fieldType === 'selector' || field.fieldType === 'radio') && (
                              <div className="mt-2">
                                {addingOptionToField === field.id ? (
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                      type="text"
                                      value={newOptionInput}
                                      onChange={(e) => setNewOptionInput(e.target.value)}
                                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewOptionToField(field.id))}
                                      className="flex-1 px-2 py-1 text-base md:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-black text-black"
                                      placeholder="Enter new option"
                                      autoFocus
                                    />
                                    <div className="flex gap-1 shrink-0">
                                      <button
                                        onClick={() => handleAddNewOptionToField(field.id)}
                                        className="text-sm md:text-xs px-3 py-1 bg-black text-white rounded hover:bg-gray-800"
                                      >
                                        Add
                                      </button>
                                      <button
                                        onClick={() => {
                                          setAddingOptionToField(null);
                                          setNewOptionInput('');
                                        }}
                                        className="text-sm md:text-xs px-3 py-1 bg-gray-200 text-black rounded hover:bg-gray-300"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setAddingOptionToField(field.id)}
                                    className="text-sm md:text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-300"
                                  >
                                    + Add New Option
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex lg:flex-col items-center gap-2 justify-end lg:justify-start">
                      <button
                        onClick={() => handleMoveField(field.id, 'up')}
                        disabled={index === 0}
                        className="p-1.5 md:p-1 text-gray-500 hover:text-black disabled:opacity-30"
                        title="Move up"
                      >
                        <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveField(field.id, 'down')}
                        disabled={index === customFields.length - 1}
                        className="p-1.5 md:p-1 text-gray-500 hover:text-black disabled:opacity-30"
                        title="Move down"
                      >
                        <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="p-1.5 md:p-1 text-red-600 hover:text-red-800"
                        title="Delete field"
                      >
                        <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Preview */}
        {customFields.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-black mb-4">Form Preview</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Donor Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  placeholder="Preview only"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  placeholder="Preview only"
                />
              </div>
              {customFields.map(field => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && <span className="text-red-600">*</span>}
                  </label>
                  {field.fieldType === 'text' && (
                    <input
                      type="text"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      placeholder="Preview only"
                    />
                  )}
                  {field.fieldType === 'numeric' && (
                    <input
                      type="number"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      placeholder="Preview only"
                    />
                  )}
                  {field.fieldType === 'selector' && (
                    <select
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    >
                      <option>Select an option</option>
                      {field.options?.map((option, i) => (
                        <option key={i}>{option}</option>
                      ))}
                    </select>
                  )}
                  {field.fieldType === 'radio' && (
                    <div className="space-y-2">
                      {field.options?.map((option, i) => (
                        <label key={i} className="flex items-center">
                          <input
                            type="radio"
                            disabled
                            name={field.id}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
