import React, { useState, useEffect } from 'react';
import { ArrowRight, X, Search, DollarSign } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const TransferToDoctorModal = ({ visit, patient, onClose, onTransferred }) => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [reason, setReason] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);

  useEffect(() => {
    api.get('/doctors/available-doctors')
      .then(res => setDoctors(res.data.doctors.filter(d => d.id !== user?.id)))
      .catch(() => toast.error('Failed to load doctors'))
      .finally(() => setLoading(false));
  }, []);

  const filteredDoctors = doctors.filter(d =>
    d.fullname?.toLowerCase().includes(search.toLowerCase())
  );

  const handleTransfer = async () => {
    if (!selectedDoctor) { toast.error('Select a doctor'); return; }
    setTransferring(true);
    try {
      const res = await api.post('/doctors/transfer', {
        patientId: patient.id,
        toDoctorId: selectedDoctor.id,
        visitId: visit.id,
        reason
      });

      if (res.data.paymentRequired) {
        setPaymentInfo(res.data);
        toast.success('Transfer requires payment. Send patient to billing.');
      } else {
        toast.success(`Patient transferred to Dr. ${selectedDoctor.fullname}`);
        onTransferred();
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="shrink-0 p-6 pb-0 flex justify-between items-center">
          <h3 className="text-lg font-bold">Transfer Patient to Doctor</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
        <p className="text-sm text-gray-500 mb-4">
          Transferring: <strong>{patient?.name}</strong>
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input className="w-full pl-10 pr-4 py-2 border rounded-lg" placeholder="Search doctors..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {paymentInfo ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h4 className="font-semibold text-amber-800 mb-1">Patient Sent to Billing</h4>
                <p className="text-amber-700 text-sm">
                  Consultation fee: <strong>ETB {paymentInfo.paymentAmount}</strong><br />
                  The patient will appear in the receiving doctor's queue after payment.
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => { onTransferred(); onClose(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                Back to Queue
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-60 overflow-y-auto border rounded-lg mb-4">
              {loading ? (
                <p className="p-4 text-gray-400">Loading doctors...</p>
              ) : filteredDoctors.length === 0 ? (
                <p className="p-4 text-gray-400">No doctors found</p>
              ) : (
                filteredDoctors.map(doc => {
                  const isSelected = selectedDoctor?.id === doc.id;
                  return (
                    <div
                      key={doc.id}
                      className={`p-3 flex items-center gap-3 cursor-pointer border-b hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                      onClick={() => setSelectedDoctor(doc)}
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                        {doc.fullname?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{doc.fullname}</p>
                        <p className="text-sm text-gray-500">
                          {doc.qualifications?.[0] || 'Doctor'}
                          {doc.consultationFee > 0 && (
                            <span className="ml-2 text-amber-600 font-medium">Fee: ETB {doc.consultationFee}</span>
                          )}
                        </p>
                      </div>
                      {doc.consultationFee > 0 && <DollarSign className="text-amber-500" size={18} />}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Transfer Reason</label>
              <textarea className="w-full px-3 py-2 border rounded-lg" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you transferring this patient?" />
            </div>

            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              <strong>Note:</strong> If this patient has orders (lab, radiology, medication), they will be sent to billing for the receiving doctor's consultation fee first.
            </div>
          </>
        )}
        </div>

        <div className="shrink-0 border-t bg-white px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleTransfer}
            disabled={!selectedDoctor || transferring || !!paymentInfo}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {transferring ? 'Transferring...' : 'Transfer'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferToDoctorModal;
