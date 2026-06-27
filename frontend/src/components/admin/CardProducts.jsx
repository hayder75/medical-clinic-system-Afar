import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CreditCard, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CardProducts = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    regPrice: '',
    actPrice: '',
    description: '',
    isActive: true
  });

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/card-products');
      setCards(res.data.cardProducts);
    } catch (err) {
      toast.error('Failed to fetch card products');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingCard(null);
    setFormData({ name: '', slug: '', regPrice: '', actPrice: '', description: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (card) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      slug: card.slug,
      regPrice: String(card.regPrice),
      actPrice: String(card.actPrice),
      description: card.description || '',
      isActive: card.isActive
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      slug: formData.slug,
      regPrice: parseFloat(formData.regPrice),
      actPrice: parseFloat(formData.actPrice),
      description: formData.description
    };
    if (editingCard) payload.isActive = formData.isActive;
    try {
      if (editingCard) {
        await api.put(`/admin/card-products/${editingCard.id}`, payload);
        toast.success('Card updated');
      } else {
        await api.post('/admin/card-products', payload);
        toast.success('Card created');
      }
      setShowModal(false);
      fetchCards();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save card');
    }
  };

  const handleDelete = async (card) => {
    if (!confirm(`Deactivate "${card.name}"?`)) return;
    try {
      await api.delete(`/admin/card-products/${card.id}`);
      toast.success('Card deactivated');
      fetchCards();
    } catch (err) {
      toast.error('Failed to deactivate card');
    }
  };

  const handleReactivate = async (card) => {
    try {
      await api.put(`/admin/card-products/${card.id}`, { isActive: true });
      toast.success('Card reactivated');
      fetchCards();
    } catch (err) {
      toast.error('Failed to reactivate card');
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Card Products</h2>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> New Card Type
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">Name</th>
                <th className="text-left py-3 px-2">Slug</th>
                <th className="text-right py-3 px-2">Reg. Price</th>
                <th className="text-right py-3 px-2">Act. Price</th>
                <th className="text-left py-3 px-2">Description</th>
                <th className="text-center py-3 px-2">Status</th>
                <th className="text-center py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-2 font-medium">{card.name}</td>
                  <td className="py-3 px-2 text-gray-500">{card.slug}</td>
                  <td className="py-3 px-2 text-right">{card.regPrice.toFixed(2)}</td>
                  <td className="py-3 px-2 text-right">{card.actPrice.toFixed(2)}</td>
                  <td className="py-3 px-2 text-gray-500 max-w-xs truncate">{card.description}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${card.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {card.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEdit(card)} className="p-1 hover:text-blue-600"><Edit size={16} /></button>
                      {card.isActive ? (
                        <button onClick={() => handleDelete(card)} className="p-1 hover:text-red-600"><Trash2 size={16} /></button>
                      ) : (
                        <button onClick={() => handleReactivate(card)} className="p-1 hover:text-green-600"><RefreshCw size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No card products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editingCard ? 'Edit Card' : 'New Card Type'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug (unique key, e.g. KIDS)</label>
                <input className="input uppercase" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} required disabled={!!editingCard} placeholder="e.g. KIDS" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Registration Price</label>
                  <input className="input" type="number" step="0.01" value={formData.regPrice} onChange={e => setFormData({...formData, regPrice: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Activation Price</label>
                  <input className="input" type="number" step="0.01" value={formData.actPrice} onChange={e => setFormData({...formData, actPrice: e.target.value})} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="input" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              {editingCard && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={e => setFormData({...formData, isActive: e.target.checked})}
                      className="rounded border-gray-300 h-5 w-5"
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingCard ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardProducts;
