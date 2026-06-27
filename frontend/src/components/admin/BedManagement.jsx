import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Bed, Info } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const BedManagement = () => {
    const [beds, setBeds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingBed, setEditingBed] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        price: '',
        type: 'General',
        status: 'AVAILABLE'
    });

    const bedTypes = ['General', 'Private', 'Semi-Private', 'ICU', 'Emergency', 'Pediatric'];
    const bedStatuses = [
        { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-800' },
        { value: 'OCCUPIED', label: 'Occupied', color: 'bg-blue-100 text-blue-800' },
        { value: 'MAINTENANCE', label: 'Maintenance', color: 'bg-red-100 text-red-800' },
        { value: 'CLEANING', label: 'Cleaning', color: 'bg-yellow-100 text-yellow-800' }
    ];

    useEffect(() => {
        fetchBeds();
    }, []);

    const fetchBeds = async () => {
        try {
            setLoading(true);
            const response = await api.get('/accommodation/beds');
            if (response.data.success) {
                setBeds(response.data.beds);
            }
        } catch (error) {
            toast.error('Failed to fetch beds');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const bedData = {
                ...formData,
                price: parseFloat(formData.price)
            };

            if (editingBed) {
                await api.put(`/accommodation/beds/${editingBed.id}`, bedData);
                toast.success('Bed updated successfully');
            } else {
                await api.post('/accommodation/beds', bedData);
                toast.success('Bed created successfully');
            }
            setShowModal(false);
            setEditingBed(null);
            setFormData({ name: '', code: '', price: '', type: 'General', status: 'AVAILABLE' });
            fetchBeds();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to save bed');
        }
    };

    const handleEdit = (bed) => {
        setEditingBed(bed);
        setFormData({
            name: bed.name,
            code: bed.code || '',
            price: bed.price.toString(),
            type: bed.type || 'General',
            status: bed.status
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this bed?')) {
            try {
                await api.delete(`/accommodation/beds/${id}`);
                toast.success('Bed deleted successfully');
                fetchBeds();
            } catch (error) {
                toast.error(error.response?.data?.error || 'Failed to delete bed');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Bed Management</h2>
                    <p className="text-gray-600">Manage hospital beds and daily rates</p>
                </div>
                <button
                    onClick={() => {
                        setEditingBed(null);
                        setFormData({ name: '', code: '', price: '', type: 'General', status: 'AVAILABLE' });
                        setShowModal(true);
                    }}
                    className="btn btn-primary flex items-center px-4 py-2"
                >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Bed
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {beds.map((bed) => (
                    <div key={bed.id} className="bg-white rounded-lg shadow-md border overflow-hidden hover:shadow-lg transition-shadow">
                        <div className={`h-2 ${bedStatuses.find(s => s.value === bed.status)?.color.split(' ')[0] || 'bg-gray-200'}`} />
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`p-2 rounded-lg ${bedStatuses.find(s => s.value === bed.status)?.color.split(' ')[0] || 'bg-gray-100'}`}>
                                        <Bed className={`h-6 w-6 ${bedStatuses.find(s => s.value === bed.status)?.color.split(' ')[1] || 'text-gray-600'}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900">{bed.name}</h3>
                                        <div className="flex gap-2 items-center">
                                            <span className="text-xs font-mono bg-gray-100 px-1 rounded text-gray-600 font-bold">{bed.code}</span>
                                            <span className="text-sm text-gray-500">{bed.type || 'General'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEdit(bed)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                        <Edit className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDelete(bed.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Status</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bedStatuses.find(s => s.value === bed.status)?.color}`}>
                                        {bedStatuses.find(s => s.value === bed.status)?.label || bed.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Rate</span>
                                    <span className="font-semibold text-primary-700">{bed.price.toLocaleString()} ETB / Day</span>
                                </div>
                            </div>

                            {bed.status === 'OCCUPIED' && bed.admissions && bed.admissions[0] && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                                        <Info className="h-3 w-3" />
                                        <span>Occupied by: <strong>{bed.admissions[0].patient?.name}</strong></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {beds.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                        <Bed className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No beds added yet. Click "Add Bed" to get started.</p>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <form onSubmit={handleSubmit} className="p-6">
                            <h3 className="text-xl font-bold mb-4">{editingBed ? 'Edit Bed' : 'Add New Bed'}</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bed Name / Number *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border rounded-md focus:ring-primary-500 focus:border-primary-500"
                                        placeholder="e.g. Bed 01 or Room 101-A"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bed Code / ID *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border rounded-md focus:ring-primary-500 focus:border-primary-500"
                                        placeholder="e.g. W1-A"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Daily Rate (ETB) *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 border rounded-md focus:ring-primary-500 focus:border-primary-500"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bed Type</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md focus:ring-primary-500 focus:border-primary-500"
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        {bedTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Status</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md focus:ring-primary-500 focus:border-primary-500"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        {bedStatuses.map(status => (
                                            <option key={status.value} value={status.value}>{status.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-700 border rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                                >
                                    {editingBed ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BedManagement;
