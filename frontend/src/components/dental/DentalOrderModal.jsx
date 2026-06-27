import React, { useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { TestTube, Scan, X } from 'lucide-react';

const DentalOrderModal = ({ isOpen, onClose, selectedTeeth, patientId, visitId, onOrderCreated }) => {
  const [orderType, setOrderType] = useState('RADIOLOGY');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);

  const orderTypes = [
    { value: 'RADIOLOGY', label: 'Radiology/X-Ray', icon: Scan, description: 'X-Ray imaging for selected teeth' },
    { value: 'LAB', label: 'Lab Test', icon: TestTube, description: 'Laboratory tests for dental conditions' }
  ];

  const handleSubmit = async () => {
    if (!selectedTeeth || selectedTeeth.length === 0) {
      toast.error('No teeth selected');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        visitId,
        patientId,
        toothNumbers: selectedTeeth,
        orderType,
        instructions
      };

      const response = await api.post('/dental/orders', orderData);
      toast.success(`${orderType === 'RADIOLOGY' ? 'X-Ray' : 'Lab'} order created successfully`);
      
      if (onOrderCreated) {
        onOrderCreated(response.data);
      }
      
      onClose();
    } catch (error) {
      console.error('Error creating dental order:', error);
      toast.error('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Dental Order</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Teeth */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selected Teeth
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedTeeth.map(tooth => (
              <span
                key={tooth}
                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
              >
                Tooth {tooth}
              </span>
            ))}
          </div>
        </div>

        {/* Order Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order Type
          </label>
          <div className="space-y-2">
            {orderTypes.map((type) => {
              const IconComponent = type.icon;
              return (
                <button
                  key={type.value}
                  onClick={() => setOrderType(type.value)}
                  className={`
                    w-full flex items-center space-x-3 p-3 rounded-lg border-2 transition-all duration-200
                    ${orderType === type.value 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }
                  `}
                >
                  <IconComponent className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">{type.label}</div>
                    <div className="text-sm opacity-75">{type.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instructions
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={`Additional instructions for ${orderType === 'RADIOLOGY' ? 'X-Ray' : 'lab test'}...`}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DentalOrderModal;
