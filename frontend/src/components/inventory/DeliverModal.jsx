import React, { useState } from 'react';
import { Truck, X } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DeliverModal = ({ request, onClose, onDelivered }) => {
  const [items, setItems] = useState(
    request.items?.map(i => ({ stockRequestItemId: i.id, medicationCatalogId: i.medicationCatalogId, quantityDelivered: i.quantityRequested, medicationName: i.medicationCatalog?.name })) || []
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(i => i.quantityDelivered > 0);
    if (validItems.length === 0) { toast.error('Enter at least one quantity to deliver'); return; }
    setLoading(true);
    try {
      await api.put(`/warehouse/requests/${request.id}/deliver`, { items: validItems });
      toast.success('Items delivered successfully');
      onDelivered();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to deliver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Deliver Items
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Requested by <strong>{request.requestedBy?.fullname}</strong> on {new Date(request.createdAt).toLocaleDateString()}
          </p>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.medicationName}</p>
                  <p className="text-xs text-gray-500">Requested: {request.items?.find(i => i.id === item.stockRequestItemId)?.quantityRequested}</p>
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-500 block mb-0.5">Deliver</label>
                  <input type="number" min="0" max={request.items?.find(i => i.id === item.stockRequestItemId)?.quantityRequested} value={item.quantityDelivered}
                    onChange={e => {
                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], quantityDelivered: parseInt(e.target.value) || 0 };
                      setItems(newItems);
                    }}
                    className="input text-sm text-center" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">Setting a lower quantity will mark this as partially delivered.</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Truck className="h-4 w-4" />}
              Deliver
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliverModal;
