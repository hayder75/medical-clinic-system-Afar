import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    unit: '',
    price: '',
    supplier: '',
    expiryDate: '',
    lowStockThreshold: '',
    isRetailOnly: false
  });

  // MedicineCategory enum from database - must match backend schema (MedicineCategory enum)
  const categories = [
    'TABLETS',
    'CAPSULES',
    'INJECTIONS',
    'SYRUPS',
    'OINTMENTS',
    'DROPS',
    'INHALERS',
    'PATCHES',
    'INFUSIONS'
  ];

  // Dosage forms - these map to dosageForm field in MedicationCatalog
  const units = [
    'Tablet',
    'Capsule',
    'Injection',
    'Liquid',
    'Gel',
    'Spray',
    'Paste',
    'Chewable',
    'Drops',
    'Syrup',
    'Ointment',
    'Cream',
    'Vial',
    'Bottle',
    'Unit'
  ];

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pharmacies/inventory');
      setInventory(response.data.inventory || []);
    } catch (error) {
      toast.error('Failed to fetch inventory');
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        ...formData,
        quantity: parseInt(formData.quantity),
        price: parseFloat(formData.price),
        lowStockThreshold: parseInt(formData.lowStockThreshold)
      };

      if (editingItem) {
        await api.put(`/pharmacies/inventory/${editingItem.id}`, itemData);
        toast.success('Inventory item updated successfully');
      } else {
        await api.post('/pharmacies/inventory', itemData);
        toast.success('Inventory item added successfully');
      }
      setShowModal(false);
      setEditingItem(null);
      setFormData({
        name: '',
        category: '',
        quantity: '',
        unit: '',
        price: '',
        supplier: '',
        expiryDate: '',
        lowStockThreshold: '',
        isRetailOnly: false
      });
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save inventory item');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.availableQuantity.toString(),
      unit: item.dosageForm,
      price: item.unitPrice.toString(),
      supplier: item.manufacturer || '',
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
      lowStockThreshold: item.minimumStock.toString(),
      isRetailOnly: item.isRetailOnly || false
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      try {
        await api.delete(`/pharmacies/inventory/${id}`);
        toast.success('Inventory item deleted successfully');
        fetchInventory();
      } catch (error) {
        toast.error('Failed to delete inventory item');
      }
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStockStatus = (item) => {
    if (item.availableQuantity <= 0) return { status: 'out', color: 'badge-danger', text: 'Out of Stock' };
    if (item.availableQuantity <= item.minimumStock) return { status: 'low', color: 'badge-warning', text: 'Low Stock' };
    return { status: 'good', color: 'badge-success', text: 'In Stock' };
  };

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
          <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
          <p className="text-gray-600">Manage medication inventory and stock levels</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Item
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search inventory..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Price</th>
                <th>Supplier</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => {
                const stockStatus = getStockStatus(item);
                return (
                  <tr key={item.id}>
                    <td className="font-medium">{item.name}</td>
                    <td>
                      <span className="badge badge-info">
                        {item.category}
                      </span>
                    </td>
                    <td className="font-medium">{item.availableQuantity}</td>
                    <td>{item.dosageForm}</td>
                    <td className="font-medium">ETB {item.unitPrice.toLocaleString()}</td>
                    <td>{item.manufacturer || 'N/A'}</td>
                    <td>
                      {item.isRetailOnly ? (
                        <span className="badge badge-warning" title="Retail Only - Not shown to doctors">
                          Retail Only
                        </span>
                      ) : (
                        <span className="badge badge-success" title="Available for doctor prescriptions">
                          Prescription
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${stockStatus.color}`}>
                        {stockStatus.text}
                      </span>
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="label">Category *</label>
                  <select
                    className="input"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Database categories: TABLETS, CAPSULES, INJECTIONS, SYRUPS, OINTMENTS, DROPS, INHALERS, PATCHES, INFUSIONS
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Quantity *</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Unit *</label>
                    <select
                      className="input"
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      required
                    >
                      <option value="">Select Unit</option>
                      {units.map(unit => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="label">Price (ETB) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="label">Supplier</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.supplier}
                    onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="label">Expiry Date</label>
                  <input
                    type="date"
                    className="input"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="label">Low Stock Threshold *</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({...formData, lowStockThreshold: e.target.value})}
                    required
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isRetailOnly"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    checked={formData.isRetailOnly}
                    onChange={(e) => setFormData({...formData, isRetailOnly: e.target.checked})}
                  />
                  <label htmlFor="isRetailOnly" className="ml-2 block text-sm text-gray-900">
                    Retail Only (Not shown to doctors when prescribing)
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingItem(null);
                      setFormData({
                        name: '',
                        category: '',
                        quantity: '',
                        unit: '',
                        price: '',
                        supplier: '',
                        expiryDate: '',
                        lowStockThreshold: '',
                        isRetailOnly: false
                      });
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingItem ? 'Update' : 'Add'}
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

export default Inventory;
