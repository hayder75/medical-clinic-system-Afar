import React, { useState, useEffect } from 'react';
import { UserPlus, User, Phone, Scan, X, Check, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const RadiologyWalkInOrders = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    age: '',
    bloodType: '',
    referringDoctor: '',
    notes: ''
  });
  const [selectedTests, setSelectedTests] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAvailableTests(); }, []);

  const fetchAvailableTests = async () => {
    try {
      const response = await api.get('/radiologies/investigation-types');
      const investigationTypes = Array.isArray(response.data)
        ? response.data
        : (response.data?.investigationTypes || []);
      const radiologyTests = investigationTypes.filter(test => test.category === 'RADIOLOGY');
      setAvailableTests(radiologyTests);
    } catch (error) {
      console.error('Error fetching tests:', error);
      toast.error('Failed to load available tests');
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleTestSelection = (testId) => {
    setSelectedTests(prev => prev.includes(testId) ? prev.filter(id => id !== testId) : [...prev, testId]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) { toast.error('Please fill in patient name and phone number'); return; }
    if (selectedTests.length === 0) { toast.error('Please select at least one test'); return; }
    try {
      setSubmitting(true);
      const response = await api.post('/walk-in-orders/radiology', { 
        name: formData.name, 
        phone: formData.phone, 
        gender: formData.gender,
        age: formData.age,
        bloodType: formData.bloodType,
        referringDoctor: formData.referringDoctor,
        testTypes: selectedTests, 
        notes: formData.notes 
      });
      toast.success(`Walk-in order created! ID: ${response.data.outsider.id}`);
      setFormData({
        name: '',
        phone: '',
        gender: '',
        age: '',
        bloodType: '',
        referringDoctor: '',
        notes: ''
      }); 
      setSelectedTests([]);
    } catch (error) {
      console.error('Error creating walk-in order:', error);
      toast.error(error.response?.data?.message || 'Failed to create walk-in order');
    } finally { setSubmitting(false); }
  };

  const selectedTestDetails = selectedTests.map(testId => availableTests.find(test => test.id === testId)).filter(Boolean);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-6">
          <UserPlus className="h-8 w-8 text-purple-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Walk-In Radiology Order</h1>
            <p className="text-gray-600">For non-registered patients</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />Patient Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="h-4 w-4 inline mr-1" />Phone Number *
                </label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender (Optional)</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">Leave empty</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age (Optional)</label>
                <input type="text" name="age" value={formData.age} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. 45 or N/A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type (Optional)</label>
                <select name="bloodType" value={formData.bloodType} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">Leave empty</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referring Doctor (Optional)</label>
                <input type="text" name="referringDoctor" value={formData.referringDoctor} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Leave empty or type N/A" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Additional information..." />
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Scan className="h-5 w-5 mr-2" />Select Radiology Tests *</h2>
            {availableTests.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Loading tests...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {availableTests.map(test => (
                  <label key={test.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedTests.includes(test.id) ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400'}`}>
                    <input type="checkbox" checked={selectedTests.includes(test.id)} onChange={() => toggleTestSelection(test.id)} className="mr-3 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{test.name}</div>
                      <div className="text-sm text-gray-600">ETB {test.price.toFixed(2)}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedTests.length > 0 && (
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="text-md font-semibold text-gray-900 mb-2">Selected Tests ({selectedTests.length})</h3>
              <div className="space-y-2">
                {selectedTestDetails.map(test => (
                  <div key={test.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{test.name}</span>
                    <button type="button" onClick={() => toggleTestSelection(test.id)} className="text-red-600 hover:text-red-800">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-purple-200">
                <div className="flex justify-between font-semibold text-gray-900">
                  <span>Total:</span>
                  <span>ETB {selectedTestDetails.reduce((sum, test) => sum + test.price, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center text-sm text-gray-600">
              <AlertCircle className="h-4 w-4 mr-1" />Order will be sent to billing for payment</div>
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center">
              {submitting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Creating...</> : <><Check className="h-4 w-4 mr-2" />Send to Billing</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RadiologyWalkInOrders;