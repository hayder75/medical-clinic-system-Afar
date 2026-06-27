import React, { useState, useEffect } from 'react';
import { Pill, Search, Plus, Trash2, CheckCircle, AlertTriangle, Package, Clock, User } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const EnhancedPrescription = ({ visitId, patientId, onPrescriptionSubmit, onCancel }) => {
  const [medications, setMedications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedications, setSelectedMedications] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customMedication, setCustomMedication] = useState({
    name: '',
    genericName: '',
    dosageForm: '',
    strength: '',
    quantity: 1,
    frequency: '',
    duration: '',
    instructions: '',
    additionalNotes: '',
    category: '',
    type: 'Prescription',
    unitPrice: 0
  });
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showContinuousInfusion, setShowContinuousInfusion] = useState(false);
  const [continuousInfusion, setContinuousInfusion] = useState({
    isContinuousInfusion: false,
    continuousInfusionDays: 1,
    dailyDose: '',
    frequency: 'Every 24 hours'
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/medications/categories/list');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const searchMedications = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await api.get(`/medications/search?query=${encodeURIComponent(query)}&limit=10`);
      setSearchResults(response.data.medications);
    } catch (error) {
      console.error('Error searching medications:', error);
      toast.error('Failed to search medications');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      searchMedications(query);
    }, 300);
  };

  const addMedicationFromCatalog = (medication) => {
    const newMedication = {
      id: `catalog-${medication.id}`,
      medicationCatalogId: medication.id,
      name: medication.name,
      genericName: medication.genericName,
      dosageForm: medication.dosageForm,
      strength: medication.strength,
      quantity: 1,
      frequency: '',
      duration: '',
      instructions: '',
      additionalNotes: '',
      category: medication.category,
      type: medication.type,
      unitPrice: medication.unitPrice,
      availableQuantity: medication.availableQuantity,
      isFromCatalog: true,
      isContinuousInfusion: continuousInfusion.isContinuousInfusion,
      continuousInfusionDays: continuousInfusion.continuousInfusionDays,
      dailyDose: continuousInfusion.dailyDose
    };

    setSelectedMedications([...selectedMedications, newMedication]);
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`${medication.name} added to prescription`);
  };

  const addCustomMedication = () => {
    if (!customMedication.name || !customMedication.dosageForm || !customMedication.strength) {
      toast.error('Please fill in required fields: name, dosage form, and strength');
      return;
    }

    const newMedication = {
      id: `custom-${Date.now()}`,
      medicationCatalogId: null,
      name: customMedication.name,
      genericName: customMedication.genericName,
      dosageForm: customMedication.dosageForm,
      strength: customMedication.strength,
      quantity: parseInt(customMedication.quantity) || 1,
      frequency: customMedication.frequency,
      duration: customMedication.duration,
      instructions: customMedication.instructions,
      additionalNotes: customMedication.additionalNotes,
      category: customMedication.category,
      type: customMedication.type,
      unitPrice: parseFloat(customMedication.unitPrice) || 0,
      isFromCatalog: false,
      isContinuousInfusion: continuousInfusion.isContinuousInfusion,
      continuousInfusionDays: continuousInfusion.continuousInfusionDays,
      dailyDose: continuousInfusion.dailyDose
    };

    setSelectedMedications([...selectedMedications, newMedication]);
    setCustomMedication({
      name: '',
      genericName: '',
      dosageForm: '',
      strength: '',
      quantity: 1,
      frequency: '',
      duration: '',
      instructions: '',
      additionalNotes: '',
      category: '',
      type: 'Prescription',
      unitPrice: 0
    });
    setShowCustomForm(false);
    toast.success(`${newMedication.name} added to prescription`);
  };

  const removeMedication = (medicationId) => {
    setSelectedMedications(selectedMedications.filter(med => med.id !== medicationId));
  };

  const updateMedication = (medicationId, field, value) => {
    setSelectedMedications(selectedMedications.map(med => 
      med.id === medicationId ? { ...med, [field]: value } : med
    ));
  };

  const handleSubmitPrescription = async () => {
    if (selectedMedications.length === 0) {
      toast.error('Please add at least one medication to the prescription');
      return;
    }

    // Validate only essential fields - quantity and duration are optional
    for (const med of selectedMedications) {
      if (!med.name || !med.dosageForm || !med.strength) {
        toast.error('Please fill in medication name, dosage form, and strength');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const prescriptionData = {
        visitId: parseInt(visitId),
        patientId: patientId,
        medications: selectedMedications.map(med => ({
          medicationCatalogId: med.medicationCatalogId,
          name: med.name,
          genericName: med.genericName,
          dosageForm: med.dosageForm,
          strength: med.strength,
          quantity: parseInt(med.quantity),
          frequency: med.frequency,
          duration: med.duration,
          instructions: med.instructions,
          additionalNotes: med.additionalNotes,
          category: med.category,
          type: med.type,
          unitPrice: parseFloat(med.unitPrice),
          isContinuousInfusion: med.isContinuousInfusion || false,
          continuousInfusionDays: med.continuousInfusionDays || 1,
          dailyDose: med.dailyDose || ''
        }))
      };

      await api.post('/doctors/prescriptions/batch', prescriptionData);
      toast.success('Prescription submitted successfully!');
      
      if (onPrescriptionSubmit) {
        onPrescriptionSubmit();
      }
    } catch (error) {
      console.error('Error submitting prescription:', error);
      toast.error(error.response?.data?.error || 'Failed to submit prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStockStatus = (medication) => {
    if (!medication.isFromCatalog) return null;
    
    if (medication.availableQuantity >= medication.quantity) {
      return { status: 'available', color: 'text-green-600', icon: CheckCircle };
    } else if (medication.availableQuantity > 0) {
      return { status: 'partial', color: 'text-yellow-600', icon: AlertTriangle };
    } else {
      return { status: 'unavailable', color: 'text-red-600', icon: AlertTriangle };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Pill className="h-6 w-6 mr-2 text-blue-600" />
          Prescribe Medications
        </h2>
        <div className="text-sm text-gray-500">
          {selectedMedications.length} medication{selectedMedications.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      {/* Search Medications */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Search className="h-5 w-5 mr-2" />
          Search Medication Catalog
        </h3>
        
        <div className="relative">
          <input
            type="text"
            className="input pr-10"
            placeholder="Search by name, generic name, or manufacturer..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map((medication) => (
              <div
                key={medication.id}
                className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => addMedicationFromCatalog(medication)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{medication.name}</div>
                    {medication.genericName && (
                      <div className="text-sm text-gray-600">Generic: {medication.genericName}</div>
                    )}
                    <div className="text-sm text-gray-500">
                      {medication.dosageForm} {medication.strength} • ${medication.unitPrice}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      Stock: {medication.availableQuantity}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {medication.category?.toLowerCase()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Custom Medication */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Add Custom Medication
          </h3>
          <button
            type="button"
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="btn btn-outline btn-sm"
          >
            {showCustomForm ? 'Cancel' : 'Add Custom'}
          </button>
        </div>

        {showCustomForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medication Name *
                </label>
                <input
                  type="text"
                  className="input"
                  value={customMedication.name}
                  onChange={(e) => setCustomMedication({...customMedication, name: e.target.value})}
                  placeholder="e.g., Aspirin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Generic Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={customMedication.genericName}
                  onChange={(e) => setCustomMedication({...customMedication, genericName: e.target.value})}
                  placeholder="e.g., Acetylsalicylic acid"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dosage Form *
                </label>
                <select
                  className="input"
                  value={customMedication.dosageForm}
                  onChange={(e) => setCustomMedication({...customMedication, dosageForm: e.target.value})}
                >
                  <option value="">Select Form</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Capsule">Capsule</option>
                  <option value="Syrup">Syrup</option>
                  <option value="Injection">Injection</option>
                  <option value="Inhaler">Inhaler</option>
                  <option value="Ointment">Ointment</option>
                  <option value="Drops">Drops</option>
                  <option value="Patch">Patch</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strength *
                </label>
                <input
                  type="text"
                  className="input"
                  value={customMedication.strength}
                  onChange={(e) => setCustomMedication({...customMedication, strength: e.target.value})}
                  placeholder="e.g., 500mg, 10ml"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  className="input"
                  value={customMedication.category}
                  onChange={(e) => setCustomMedication({...customMedication, category: e.target.value})}
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  className="input"
                  value={customMedication.type}
                  onChange={(e) => setCustomMedication({...customMedication, type: e.target.value})}
                >
                  <option value="Prescription">Prescription</option>
                  <option value="OTC">Over-the-Counter</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  className="input"
                  value={customMedication.quantity}
                  onChange={(e) => setCustomMedication({...customMedication, quantity: e.target.value})}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency
                </label>
                <input
                  type="text"
                  className="input"
                  value={customMedication.frequency}
                  onChange={(e) => setCustomMedication({...customMedication, frequency: e.target.value})}
                  placeholder="e.g., Twice daily"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <input
                  type="text"
                  className="input"
                  value={customMedication.duration}
                  onChange={(e) => setCustomMedication({...customMedication, duration: e.target.value})}
                  placeholder="e.g., 7 days"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructions
              </label>
              <textarea
                className="input"
                rows="2"
                value={customMedication.instructions}
                onChange={(e) => setCustomMedication({...customMedication, instructions: e.target.value})}
                placeholder="Special instructions for the patient"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                className="input"
                rows="2"
                value={customMedication.additionalNotes}
                onChange={(e) => setCustomMedication({...customMedication, additionalNotes: e.target.value})}
                placeholder="Doctor's notes"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={addCustomMedication}
                className="btn btn-primary"
              >
                Add to Prescription
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Continuous Infusion Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Continuous Infusion
          </h3>
          <button
            type="button"
            onClick={() => setShowContinuousInfusion(!showContinuousInfusion)}
            className="btn btn-outline btn-sm"
          >
            {showContinuousInfusion ? 'Hide' : 'Configure'}
          </button>
        </div>

        {showContinuousInfusion && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={continuousInfusion.isContinuousInfusion}
                  onChange={(e) => setContinuousInfusion({
                    ...continuousInfusion,
                    isContinuousInfusion: e.target.checked
                  })}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  This medication requires continuous infusion
                </span>
              </label>
            </div>

            {continuousInfusion.isContinuousInfusion && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    className="input"
                    value={continuousInfusion.continuousInfusionDays}
                    onChange={(e) => setContinuousInfusion({
                      ...continuousInfusion,
                      continuousInfusionDays: parseInt(e.target.value) || 1
                    })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Dose
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g., 5ml over 24h"
                    value={continuousInfusion.dailyDose}
                    onChange={(e) => setContinuousInfusion({
                      ...continuousInfusion,
                      dailyDose: e.target.value
                    })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency
                  </label>
                  <select
                    className="input"
                    value={continuousInfusion.frequency}
                    onChange={(e) => setContinuousInfusion({
                      ...continuousInfusion,
                      frequency: e.target.value
                    })}
                  >
                    <option value="Every 24 hours">Every 24 hours</option>
                    <option value="Every 12 hours">Every 12 hours</option>
                    <option value="Every 8 hours">Every 8 hours</option>
                    <option value="Every 6 hours">Every 6 hours</option>
                    <option value="Continuous">Continuous</option>
                  </select>
                </div>
              </div>
            )}

            {continuousInfusion.isContinuousInfusion && (
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>Infusion Schedule:</strong> {continuousInfusion.continuousInfusionDays} day(s) 
                  of {continuousInfusion.dailyDose || 'daily dose'} - {continuousInfusion.frequency}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  This will create nurse administration tasks for each day of the infusion period.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Medications */}
      {selectedMedications.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Prescription List
          </h3>

          <div className="space-y-4">
            {selectedMedications.map((medication, index) => {
              const stockStatus = getStockStatus(medication);
              const StatusIcon = stockStatus?.icon;

              return (
                <div key={medication.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{medication.name}</h4>
                        {medication.isFromCatalog && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Catalog
                          </span>
                        )}
                        {!medication.isFromCatalog && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                            Custom
                          </span>
                        )}
                        {medication.isContinuousInfusion && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Infusion
                          </span>
                        )}
                        {StatusIcon && (
                          <StatusIcon className={`h-4 w-4 ${stockStatus.color}`} />
                        )}
                      </div>
                      {medication.genericName && (
                        <div className="text-sm text-gray-600">Generic: {medication.genericName}</div>
                      )}
                      <div className="text-sm text-gray-500">
                        {medication.dosageForm} {medication.strength}
                        {medication.unitPrice > 0 && ` • $${medication.unitPrice}`}
                      </div>
                      {medication.isContinuousInfusion && (
                        <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-200">
                          <div className="text-xs font-medium text-purple-800">
                            Continuous Infusion: {medication.continuousInfusionDays} day(s)
                          </div>
                          <div className="text-xs text-purple-600">
                            Daily Dose: {medication.dailyDose || 'Not specified'}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMedication(medication.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        className="input input-sm"
                        value={medication.quantity}
                        onChange={(e) => updateMedication(medication.id, 'quantity', e.target.value)}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Frequency
                      </label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={medication.frequency}
                        onChange={(e) => updateMedication(medication.id, 'frequency', e.target.value)}
                        placeholder="e.g., Twice daily"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Duration
                      </label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={medication.duration}
                        onChange={(e) => updateMedication(medication.id, 'duration', e.target.value)}
                        placeholder="e.g., 7 days"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Instructions
                      </label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={medication.instructions}
                        onChange={(e) => updateMedication(medication.id, 'instructions', e.target.value)}
                        placeholder="Special instructions"
                      />
                    </div>
                  </div>

                  {medication.additionalNotes && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Additional Notes
                      </label>
                      <textarea
                        className="input input-sm"
                        rows="2"
                        value={medication.additionalNotes}
                        onChange={(e) => updateMedication(medication.id, 'additionalNotes', e.target.value)}
                        placeholder="Doctor's notes"
                      />
                    </div>
                  )}

                  {stockStatus && (
                    <div className={`mt-2 text-sm ${stockStatus.color}`}>
                      {stockStatus.status === 'available' && '✓ In stock'}
                      {stockStatus.status === 'partial' && `⚠ Partial stock (${medication.availableQuantity} available)`}
                      {stockStatus.status === 'unavailable' && '✗ Out of stock'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmitPrescription}
          disabled={selectedMedications.length === 0 || isSubmitting}
          className="btn btn-primary"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Submit Prescription ({selectedMedications.length})
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default EnhancedPrescription;
