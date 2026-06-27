import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart, Check, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CONDITION_OPTIONS = [
  'Caries', 'Deep caries', 'Fracture', 'Sensitivity', 'Mobility', 'Periapical lesion', 'Wear'
];
const EXISTING_WORK_OPTIONS = [
  'Filling', 'Crown', 'Veneer', 'Bridge', 'Root canal treated', 'Implant'
];
const TREATMENT_OPTIONS = [
  'Filling', 'RCT', 'Crown', 'Extraction', 'Implant'
];

const ChipGroup = ({ label, options, selected, onChange }) => (
  <div className="mb-2.5">
    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const isSel = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(isSel ? selected.filter((s) => s !== opt) : [...selected, opt])}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
              isSel
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

const ToothQuickPanel = ({ toothNumber, initialData = {}, onSave, onClose, visitId, patientId }) => {
  const [diagnosis, setDiagnosis] = useState(initialData.diagnosis || []);
  const [restoration, setRestoration] = useState(initialData.restoration || []);
  const [treatmentPlan, setTreatmentPlan] = useState(initialData.treatmentPlan || []);
  const [quickNotes, setQuickNotes] = useState(initialData.diagnosisNotes || '');
  const [showServices, setShowServices] = useState(false);
  const [dentalServices, setDentalServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedServices, setSelectedServices] = useState({});
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    setDiagnosis(initialData.diagnosis || []);
    setRestoration(initialData.restoration || []);
    setTreatmentPlan(initialData.treatmentPlan || []);
    setQuickNotes(initialData.diagnosisNotes || '');
  }, [initialData, toothNumber]);

  useEffect(() => {
    if (!showServices || dentalServices.length > 0) return;
    setLoadingServices(true);
    api.get('/doctors/services?category=DENTAL')
      .then((res) => setDentalServices(res.data.services || []))
      .catch(() => toast.error('Failed to load dental services'))
      .finally(() => setLoadingServices(false));
  }, [showServices]);

  const handleSave = () => {
    onSave(toothNumber, { diagnosis, restoration, treatmentPlan, diagnosisNotes: quickNotes });
  };

  const handleSaveClose = () => {
    handleSave();
    onClose();
  };

  const handleOrder = async () => {
    const serviceIds = Object.entries(selectedServices)
      .filter(([, qty]) => qty > 0)
      .flatMap(([id, qty]) => Array(qty).fill(id));

    if (serviceIds.length === 0) {
      toast.error('Select at least one service');
      return;
    }

    handleSave();
    setOrdering(true);
    try {
      await api.post('/batch-orders/create', {
        visitId: parseInt(visitId),
        patientId,
        type: 'DENTAL',
        isDeferred: false,
        instructions: `Dental procedure order for tooth ${toothNumber}`,
        notes: `Ordered for tooth ${toothNumber}. Conditions: ${diagnosis.join(', ') || 'None'}. ${quickNotes || ''}`,
        services: serviceIds.map((sid) => ({
          serviceId: sid,
          instructions: `Tooth ${toothNumber}${diagnosis.length ? ` - ${diagnosis.join(', ')}` : ''}`,
          customPrice: null
        }))
      });
      toast.success(`Services ordered for tooth ${toothNumber}`);
      setSelectedServices({});
      setShowServices(false);
      // Dispatch event so dental service ordering component can refresh
      window.dispatchEvent(new CustomEvent('dental-order-placed', { detail: { toothNumber, visitId } }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  const toggleService = (id) => {
    setSelectedServices((prev) => {
      const current = prev[id] || 0;
      if (current === 0) return { ...prev, [id]: 1 };
      return { ...prev, [id]: 0 };
    });
  };

  const updateQty = (id, delta) => {
    setSelectedServices((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const totalServices = Object.values(selectedServices).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-40 bg-black/20" onClick={handleSaveClose}>
      <div
        className="absolute bg-white rounded-xl shadow-2xl border border-gray-200 z-50"
        style={{
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: showServices ? '420px' : '340px',
          maxHeight: '90vh',
          overflowY: 'auto',
          transition: 'width 0.2s'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[11px]">
              {toothNumber}
            </div>
            <span className="font-semibold text-sm text-gray-800">Tooth {toothNumber}</span>
          </div>
          <div className="flex items-center gap-1">
            {totalServices > 0 && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
                {totalServices}
              </span>
            )}
            <button onClick={handleSaveClose} className="p-0.5 hover:bg-gray-100 rounded"><X size={14} /></button>
          </div>
        </div>

        <div className="p-3">
          <ChipGroup label="Condition" options={CONDITION_OPTIONS} selected={diagnosis} onChange={setDiagnosis} />
          <ChipGroup label="Existing Work" options={EXISTING_WORK_OPTIONS} selected={restoration} onChange={setRestoration} />
          <ChipGroup label="Planned Treatment" options={TREATMENT_OPTIONS} selected={treatmentPlan} onChange={setTreatmentPlan} />

          <div className="mb-2.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Quick Notes</p>
            <textarea
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
              rows={1}
              className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Quick clinical note..."
            />
          </div>

          {/* Services Toggle */}
          <button
            onClick={() => setShowServices(!showServices)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-xs"
          >
            <span className="flex items-center gap-1.5 font-medium text-gray-700">
              <ShoppingCart size={13} /> Order Dental Service
            </span>
            {showServices ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showServices && (
            <div className="mt-2 border border-gray-200 rounded-lg max-h-52 overflow-y-auto">
              {loadingServices ? (
                <div className="p-3 text-center text-xs text-gray-400"><Loader size={14} className="inline animate-spin mr-1" /> Loading...</div>
              ) : dentalServices.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400">No dental services available</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {dentalServices.map((svc) => {
                    const qty = selectedServices[svc.id] || 0;
                    return (
                      <div key={svc.id} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{svc.name}</p>
                          <p className="text-gray-400">{svc.code}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {qty > 0 ? (
                            <div className="flex items-center gap-1 bg-blue-50 rounded-lg px-1.5 py-0.5">
                              <button onClick={() => updateQty(svc.id, -1)} className="p-0.5 hover:text-red-500"><Minus size={12} /></button>
                              <span className="w-4 text-center font-semibold text-blue-700 text-xs">{qty}</span>
                              <button onClick={() => updateQty(svc.id, 1)} className="p-0.5 hover:text-green-500"><Plus size={12} /></button>
                            </div>
                          ) : (
                            <button onClick={() => toggleService(svc.id)} className="px-2 py-0.5 border border-gray-300 rounded-lg hover:border-blue-400 text-gray-500">
                              <Plus size={12} />
                            </button>
                          )}
                          <span className="text-gray-500 w-12 text-right">ETB {svc.price}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showServices && totalServices > 0 && (
            <button
              onClick={handleOrder}
              disabled={ordering}
              className="mt-2 w-full px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {ordering ? 'Ordering...' : `Place Order (${totalServices} service${totalServices > 1 ? 's' : ''})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToothQuickPanel;
