import React, { useState, useEffect } from 'react';
import { UserPlus, User, Phone, X, Check, AlertCircle, Package, Search } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const WalkInNurseServices = () => {
  const [formData, setFormData] = useState({ name: '', phone: '', notes: '' });
  const [selectedServiceIds, setSelectedServiceIds] = useState(new Set());
  const [availableServices, setAvailableServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAvailableServices();
  }, []);

  const fetchAvailableServices = async () => {
    try {
      const response = await api.get('/nurses/services');
      // Filter only NURSE_WALKIN category services
      const walkInServices = (response.data.services || []).filter(
        service => service.category === 'NURSE_WALKIN' && service.isActive
      );
      setAvailableServices(walkInServices);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load available services');
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleServiceToggle = (serviceId) => {
    setSelectedServiceIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const getSelectedServices = () => {
    return availableServices.filter(service => selectedServiceIds.has(service.id));
  };

  const calculateTotal = () => {
    return getSelectedServices().reduce((sum, service) => sum + (service.price || 0), 0);
  };

  const filteredServices = availableServices.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Please fill in name and phone number');
      return;
    }

    if (selectedServiceIds.size === 0) {
      toast.error('Please select at least one service');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/walk-in-orders/nurse', {
        name: formData.name,
        phone: formData.phone,
        serviceIds: Array.from(selectedServiceIds),
        notes: formData.notes
      });

      toast.success('Walk-in nurse service order created successfully');
      
      // Reset form
      setFormData({ name: '', phone: '', notes: '' });
      setSelectedServiceIds(new Set());
      setSearchQuery('');
      
      // Show billing info
      if (response.data.billing) {
        toast.success(`Billing created: ${response.data.billing.totalAmount} Birr. Please proceed to billing for payment.`, {
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error creating walk-in order:', error);
      toast.error(error.response?.data?.message || 'Failed to create walk-in order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Walk-in Nurse Services</h1>
          <p className="text-gray-600">Create walk-in orders for patients without visits</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Patient Information */}
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <UserPlus className="h-5 w-5 mr-2 text-blue-600" />
              Patient Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes or instructions..."
              />
            </div>
          </div>

          {/* Service Selection */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="h-5 w-5 mr-2 text-green-600" />
              Select Services
            </h2>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search services by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Services List */}
            <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
              {filteredServices.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchQuery ? 'No services found matching your search' : 'No walk-in nurse services available'}
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredServices.map((service) => (
                    <div
                      key={service.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedServiceIds.has(service.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => handleServiceToggle(service.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedServiceIds.has(service.id)}
                              onChange={() => handleServiceToggle(service.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                            />
                            <div>
                              <h3 className="font-medium text-gray-900">{service.name}</h3>
                              {service.code && (
                                <p className="text-sm text-gray-500">Code: {service.code}</p>
                              )}
                              {service.description && (
                                <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <p className="font-semibold text-gray-900">{service.price?.toFixed(2)} Birr</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Services Summary */}
            {selectedServiceIds.size > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-900 mb-2">
                  Selected Services ({selectedServiceIds.size})
                </h3>
                <div className="space-y-1">
                  {getSelectedServices().map((service) => (
                    <div key={service.id} className="flex justify-between text-sm">
                      <span className="text-green-800">{service.name}</span>
                      <span className="font-medium text-green-900">{service.price?.toFixed(2)} Birr</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-green-300 flex justify-between items-center">
                  <span className="font-semibold text-green-900">Total:</span>
                  <span className="text-xl font-bold text-green-900">{calculateTotal().toFixed(2)} Birr</span>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setFormData({ name: '', phone: '', notes: '' });
                setSelectedServiceIds(new Set());
                setSearchQuery('');
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={submitting || selectedServiceIds.size === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Order
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalkInNurseServices;

