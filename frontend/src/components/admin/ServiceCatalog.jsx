import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, Filter } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ServiceCatalog = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    price: '',
    category: 'CONSULTATION',
    unit: 'UNIT',
    description: '',
    isActive: true,
    isVariablePrice: false,
    minPrice: '',
    maxPrice: ''
  });
  const [codeGenerated, setCodeGenerated] = useState(false); // Track if code was auto-generated

  const categories = [
    { value: 'ENTRY', label: 'Entry Fee' },
    { value: 'CONSULTATION', label: 'Consultation' },
    { value: 'LAB', label: 'Lab Test' },
    { value: 'RADIOLOGY', label: 'Radiology' },
    { value: 'MEDICATION', label: 'Medication' },
    { value: 'PROCEDURE', label: 'Procedure' },
    { value: 'NURSE', label: 'Nurse Service' },
    { value: 'DENTAL', label: 'Dental' },
    { value: 'NURSE_WALKIN', label: 'Nurse Walk-in Service' },
    { value: 'EMERGENCY_DRUG', label: 'Emergency Drug' },
    { value: 'MATERIAL_NEEDS', label: 'Material Needs' },
    { value: 'ACCOMMODATION', label: 'Accommodation Services' }
  ];

  const unitOptions = [
    { value: 'UNIT', label: 'Unit (Default)' },
    { value: 'TOOTH', label: 'Per Tooth' },
    { value: 'JAW', label: 'Per Jaw' },
    { value: 'ABUTMENT', label: 'Per Abutment' },
    { value: 'SESSION', label: 'Per Session' },
    { value: 'SEGMENT', label: 'Per Segment' },
    { value: 'DAY', label: 'Per Day' }
  ];

  useEffect(() => {
    fetchServices();
  }, []);

  // Helper function to generate service code
  const generateCodeForService = useCallback(async () => {
    if (editingService) return; // Don't auto-generate when editing

    const categoryPrefixes = {
      'CONSULTATION': 'CONS',
      'LAB': 'LAB',
      'RADIOLOGY': 'RAD',
      'MEDICATION': 'MED',
      'PROCEDURE': 'PROC',
      'NURSE': 'NURSE',
      'NURSE_WALKIN': 'NWALK',
      'EMERGENCY_DRUG': 'EMDRUG',
      'MATERIAL_NEEDS': 'MAT',
      'DENTAL': 'DENT',
      'OTHER': 'OTH',
      'ENTRY': 'ENTRY',
      'ACCOMMODATION': 'ACC'
    };

    const prefix = categoryPrefixes[formData.category] || 'SRV';

    try {
      // Fetch existing services to find the next number
      const response = await api.get('/admin/services');
      const services = response.data.services || [];

      // Find services with same prefix
      const prefixServices = services.filter(s => s.code.startsWith(prefix));

      let nextNumber = 1;
      if (prefixServices.length > 0) {
        const numbers = prefixServices
          .map(s => {
            const numStr = s.code.replace(prefix, '');
            const num = parseInt(numStr) || 0;
            return num;
          })
          .filter(n => !isNaN(n))
          .sort((a, b) => b - a);

        if (numbers.length > 0) {
          nextNumber = numbers[0] + 1;
        }
      }

      const generatedCode = `${prefix}${String(nextNumber).padStart(3, '0')}`;
      setFormData(prev => ({ ...prev, code: generatedCode }));
      setCodeGenerated(true);
    } catch (error) {
      console.error('Error generating code:', error);
      // Fallback to simple code
      const generatedCode = `${prefix}001`;
      setFormData(prev => ({ ...prev, code: generatedCode }));
      setCodeGenerated(true);
    }
  }, [formData.category, editingService]);

  // Auto-generate code when category changes (only for new services when modal is open)
  useEffect(() => {
    if (!editingService && formData.category && showModal && codeGenerated) {
      generateCodeForService();
    }
  }, [formData.category, showModal, codeGenerated, editingService, generateCodeForService]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/services');
      setServices(response.data.services || []);
    } catch (error) {
      toast.error('Failed to fetch services');
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const serviceData = {
        ...formData,
        price: formData.isVariablePrice ? parseFloat(formData.minPrice) || 0 : parseFloat(formData.price),
        minPrice: formData.isVariablePrice ? parseFloat(formData.minPrice) : null,
        maxPrice: formData.isVariablePrice ? parseFloat(formData.maxPrice) : null,
      };

      if (editingService) {
        await api.put(`/admin/services/${editingService.id}`, serviceData);
        toast.success('Service updated successfully');
      } else {
        await api.post('/admin/services', serviceData);
        toast.success('Service created successfully');
      }
      setShowModal(false);
      setEditingService(null);
      setCodeGenerated(false);
      setFormData({
        name: '',
        code: '',
        price: '',
        category: 'CONSULTATION',
        unit: 'UNIT',
        description: '',
        isActive: true,
        isVariablePrice: false,
        minPrice: '',
        maxPrice: ''
      });
      fetchServices();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save service');
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setCodeGenerated(false); // Reset when editing
    setFormData({
      name: service.name,
      code: service.code,
      price: service.price.toString(),
      category: service.category,
      unit: service.unit || 'UNIT',
      description: service.description || '',
      isActive: service.isActive,
      isVariablePrice: service.isVariablePrice || false,
      minPrice: service.minPrice?.toString() || '',
      maxPrice: service.maxPrice?.toString() || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      try {
        await api.delete(`/admin/services/${id}`);
        toast.success('Service deleted successfully');
        fetchServices();
      } catch (error) {
        toast.error('Failed to delete service');
      }
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.code.toLowerCase().includes(searchTerm.toLowerCase());
    // Handle ENTRY category (stored as OTHER in database with code ENTRY001)
    let categoryMatch = false;
    if (categoryFilter === 'ALL') {
      categoryMatch = true;
    } else if (categoryFilter === 'ENTRY') {
      // Entry fees are stored with category OTHER and code ENTRY001
      categoryMatch = service.category === 'OTHER' && service.code === 'ENTRY001';
    } else {
      categoryMatch = service.category === categoryFilter;
    }
    return matchesSearch && categoryMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Service Catalog</h2>
          <p className="text-lg text-gray-600">Manage medical services and pricing</p>
        </div>
        <button
          onClick={() => {
            setEditingService(null);
            setFormData({
              name: '',
              code: '',
              price: '',
              category: 'CONSULTATION',
              unit: 'UNIT',
              description: '',
              isActive: true,
              isVariablePrice: false,
              minPrice: '',
              maxPrice: ''
            });
            setShowModal(true);
            setCodeGenerated(true);
            // Small delay to let modal open, then generate code
            setTimeout(() => {
              generateCodeForService();
            }, 100);
          }}
          className="btn btn-primary flex items-center text-lg px-6 py-3"
        >
          <Plus className="h-6 w-6 mr-2" />
          Add Service
        </button>
      </div>

      {/* Filters */}
      <div className="card w-full">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400" />
              <input
                type="text"
                placeholder="Search services..."
                className="input pl-12 text-lg py-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="sm:w-56">
            <select
              className="input text-lg py-3"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <table className="table w-full" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th className="text-base" style={{ width: '20%' }}>Name</th>
              <th className="text-base" style={{ width: '8%' }}>Code</th>
              <th className="text-base" style={{ width: '12%' }}>Category</th>
              <th className="text-base" style={{ width: '10%' }}>Price</th>
              <th className="text-base" style={{ width: '10%' }}>Unit</th>
              <th className="text-base" style={{ width: '18%' }}>Description</th>
              <th className="text-base" style={{ width: '10%' }}>Status</th>
              <th className="text-base" style={{ width: '12%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.map((service) => (
              <tr key={service.id}>
                <td className="font-medium text-base break-words">{service.name}</td>
                <td className="font-mono text-base">{service.code}</td>
                <td>
                  <span className="badge badge-info text-sm">
                    {categories.find(c => c.value === service.category)?.label || service.category}
                  </span>
                </td>
                <td className="font-medium text-base">
                  {service.isVariablePrice ? (
                    <span className="text-indigo-600 font-semibold">
                      {service.minPrice?.toLocaleString()} - {service.maxPrice?.toLocaleString()}
                    </span>
                  ) : (
                    service.price.toLocaleString()
                  )}
                </td>
                <td className="text-base text-sm">
                  {unitOptions.find(u => u.value === (service.unit || 'UNIT'))?.label || service.unit || 'Unit'}
                </td>
                <td className="text-base break-words">{service.description || 'N/A'}</td>
                <td>
                  <span className={`badge text-sm ${service.isActive ? 'badge-success' : 'badge-gray'}`}>
                    {service.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1 flex-nowrap">
                    <button
                      onClick={() => handleEdit(service)}
                      className="px-2 py-1 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-1 whitespace-nowrap"
                      title="Edit"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="px-2 py-1 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-1 whitespace-nowrap"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {editingService ? 'Edit Service' : 'Add New Service'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label text-lg">Service Name *</label>
                    <input
                      type="text"
                      className="input text-lg"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="label text-lg">
                      Service Code *
                      {!editingService && (
                        <span className="text-sm text-gray-500 ml-2">(Auto-generated)</span>
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="input text-lg flex-1"
                        value={formData.code}
                        onChange={(e) => {
                          setFormData({ ...formData, code: e.target.value });
                          setCodeGenerated(false);
                        }}
                        required
                        placeholder="e.g., CONS001"
                      />
                      {!editingService && formData.category && (
                        <button
                          type="button"
                          onClick={generateCodeForService}
                          className="px-3 py-2 text-base bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300"
                          title="Regenerate code"
                        >
                          🔄
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="label text-lg">Category *</label>
                    <select
                      className="input text-lg"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {categories.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label text-lg">Unit *</label>
                    <select
                      className="input text-lg"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      required
                    >
                      {unitOptions.map(unit => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4 mt-4">
                      <input
                        type="checkbox"
                        className="h-6 w-6 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={formData.isVariablePrice}
                        onChange={(e) => setFormData({ ...formData, isVariablePrice: e.target.checked })}
                      />
                      <span className="text-xl font-bold text-indigo-800">Has Variable Price Range</span>
                      <span className="text-sm text-indigo-500 ml-2">(Price will be determined at point of service)</span>
                    </label>
                  </div>

                  {!formData.isVariablePrice ? (
                    <div>
                      <label className="label text-lg font-bold text-gray-700">Service Price (ETB) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input text-xl font-bold border-indigo-200 focus:ring-indigo-500"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required={!formData.isVariablePrice}
                        placeholder="0.00"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="label text-lg font-bold text-indigo-700">Minimum Price (ETB) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input text-xl font-bold border-indigo-300 focus:ring-indigo-500 bg-white"
                          value={formData.minPrice}
                          onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                          required={formData.isVariablePrice}
                          placeholder="Min cost"
                        />
                      </div>
                      <div>
                        <label className="label text-lg font-bold text-indigo-700">Maximum Price (ETB) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input text-xl font-bold border-indigo-300 focus:ring-indigo-500 bg-white"
                          value={formData.maxPrice}
                          onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
                          required={formData.isVariablePrice}
                          placeholder="Max cost"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-center pt-8">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id="isActive"
                        className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      />
                      <span className="text-lg text-gray-900">Active Service</span>
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="label text-lg">Description</label>
                  <textarea
                    className="input text-lg"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingService(null);
                      setCodeGenerated(false);
                      setFormData({
                        name: '',
                        code: '',
                        price: '',
                        category: 'CONSULTATION',
                        unit: 'UNIT',
                        description: '',
                        isActive: true,
                        isVariablePrice: false,
                        minPrice: '',
                        maxPrice: ''
                      });
                    }}
                    className="btn btn-secondary text-lg px-6 py-2"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary text-lg px-6 py-2">
                    {editingService ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceCatalog;
