import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Building2, Eye, FileText, DollarSign } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const InsuranceManagement = () => {
  const navigate = useNavigate();
  const [insurances, setInsurances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    contactInfo: ''
  });

  useEffect(() => {
    fetchInsurances();
  }, []);

  const fetchInsurances = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/insurances');
      const basicInsurances = response.data.insurances || [];
      
      // For now, just use basic insurance data
      // TODO: Add transaction data when the detailed API is working
      setInsurances(basicInsurances);
    } catch (error) {
      toast.error('Failed to fetch insurances');
      console.error('Error fetching insurances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingInsurance) {
        await api.put(`/admin/insurances/${editingInsurance.id}`, formData);
        toast.success('Insurance updated successfully');
      } else {
        await api.post('/admin/insurances', formData);
        toast.success('Insurance created successfully');
      }
      setShowModal(false);
      setEditingInsurance(null);
      setFormData({ name: '', code: '', contactInfo: '' });
      fetchInsurances();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save insurance');
    }
  };

  const handleEdit = (insurance) => {
    setEditingInsurance(insurance);
    setFormData({
      name: insurance.name || '',
      code: insurance.code || '',
      contactInfo: insurance.contactInfo || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this insurance?')) {
      try {
        await api.delete(`/admin/insurances/${id}`);
        toast.success('Insurance deleted successfully');
        fetchInsurances();
      } catch (error) {
        toast.error('Failed to delete insurance');
      }
    }
  };

  const filteredInsurances = insurances.filter(insurance =>
    insurance.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    insurance.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Insurance Management</h2>
          <p className="text-gray-600">Manage insurance companies and providers</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Insurance
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search insurances..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Insurances List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInsurances.map((insurance) => (
          <div 
            key={insurance.id} 
            className="card cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-transparent hover:border-blue-200"
            onClick={() => navigate(`/admin/insurances/${insurance.id}`)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="font-medium text-gray-900">{insurance.name}</h3>
                  <p className="text-sm text-gray-500">Code: {insurance.code}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/insurances/${insurance.id}`);
                  }}
                  className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(insurance);
                  }}
                  className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(insurance.id);
                  }}
                  className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Contact Info</p>
                <p className="text-sm text-gray-900">{insurance.contactInfo || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`badge ${insurance.isActive ? 'badge-success' : 'badge-danger'}`}>
                  {insurance.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {/* Transaction Summary - Will be added when API is working */}
              <div className="border-t pt-2 mt-2">
                <div className="text-center text-sm text-blue-600 font-medium">
                  <p>Click anywhere on this card to view transactions</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredInsurances.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No insurances found</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingInsurance ? 'Edit Insurance' : 'Add New Insurance'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Insurance Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="label">Insurance Code *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="label">Contact Information</label>
                  <textarea
                    className="input"
                    rows="3"
                    value={formData.contactInfo}
                    onChange={(e) => setFormData({...formData, contactInfo: e.target.value})}
                    placeholder="Phone, email, address..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingInsurance(null);
                      setFormData({ name: '', code: '', contactInfo: '' });
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingInsurance ? 'Update' : 'Create'}
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

export default InsuranceManagement;
