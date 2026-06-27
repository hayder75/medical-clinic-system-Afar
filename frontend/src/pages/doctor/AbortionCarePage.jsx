import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { AlertTriangle, Search, Plus, Edit2, Trash2, Printer, ArrowLeft } from 'lucide-react';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';

const PROCEDURE_TYPES = [
  { value: 'MVA', label: 'MVA (Manual Vacuum Aspiration)' },
  { value: 'DNE', label: 'D&E (Dilation & Evacuation)' },
  { value: 'ENC', label: 'E&C (Evacuation & Curettage)' },
  { value: 'MA', label: 'MA (Medical Abortion)' },
  { value: 'OTHER', label: 'Other' }
];

const SAFE_ABORTION_REASONS = [
  { value: 'RAPE', label: 'Rape' },
  { value: 'INCEST', label: 'Incest' },
  { value: 'MATERNAL_CONDITION', label: 'Maternal Condition' },
  { value: 'FETAL_DEFORMITY', label: 'Fetal Deformity' }
];

const POST_ABORTION_DIAGNOSES = [
  { value: 'INCOMPLETE', label: 'Incomplete Abortion' },
  { value: 'INEVITABLE', label: 'Inevitable Abortion' },
  { value: 'MISSED', label: 'Missed Abortion' },
  { value: 'OTHER', label: 'Other' }
];

const AbortionCarePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCareType, setFilterCareType] = useState('');
  const [visitId, setVisitId] = useState(searchParams.get('visitId') || '');
  const [fromVisit, setFromVisit] = useState(!!searchParams.get('visitId'));
  const [form, setForm] = useState({
    patientId: searchParams.get('patientId') || '', mrn: '', age: '', gravida: '', para: '', gestationalAgeWeeks: '',
    careType: 'SAFE_ABORTION', procedureType: '',
    managedAsOutpatient: true, managedAsInpatient: false,
    referred: false, drugsProvided: '',
    hivTestAccepted: false, hivTestResult: '',
    hivTestReceivedCounselling: false, hivPositiveLinkedART: false,
    postAbortionContraceptiveNew: false, postAbortionContraceptiveRepeat: false,
    postAbortionContraceptiveMethod: '',
    death: false, complications: false, complicationDetails: '',
    safeAbortionReason: '', postAbortionDiagnosis: '',
    otherServiceCode: '', referralSource: '',
    serviceProviderName: '', serviceProviderSignature: ''
  });

  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const searchInputRef = useRef(null);

  const searchPatientApi = useCallback(async (query, signal) => {
    const res = await api.get(`/patients/search?query=${query}`, { signal });
    return res.data.patients || [];
  }, []);

  const {
    query: patientSearchQuery,
    setQuery: setPatientSearchQuery,
    results: patientSearchResults,
    loading: searchingPatient
  } = useDebouncedSearch(searchPatientApi, { delay: 300, minChars: 2 });

  const calcAge = (dob) => {
    if (!dob) return '';
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return '';
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
    if (years < 0) return '';
    if (years === 0) {
      let months = today.getMonth() - birth.getMonth();
      let days = today.getDate() - birth.getDate();
      if (days < 0) {
        months--;
        const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += prevMonth.getDate();
      }
      if (months < 0) months = 0;
      return months === 0 ? `${days}d` : `${months}m ${days}d`;
    }
    return years.toString();
  };

  const selectPatient = (patient) => {
    setForm(prev => ({
      ...prev,
      patientId: patient.id,
      mrn: patient.mrn || '',
      age: calcAge(patient.dob)
    }));
    setShowPatientSearch(false);
    setPatientSearchQuery('');
  };

  useEffect(() => {
    const patientId = searchParams.get('patientId');
    const vId = searchParams.get('visitId');
    if (vId) setVisitId(vId);
    if (vId) setFromVisit(true);
    loadRecords();
    if (patientId && vId) {
      setShowForm(true);
    }
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterCareType) params.careType = filterCareType;
      const res = await api.get('/abortion-care', { params });
      setRecords(res.data);
    } catch (e) {
      toast.error('Failed to load records');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadRecords(); }, [filterCareType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, visitId };
      if (editRecord) {
        await api.put(`/abortion-care/${editRecord.id}`, payload);
        toast.success('Record updated');
      } else {
        await api.post('/abortion-care', payload);
        toast.success('Record created');
      }
      setShowForm(false);
      setEditRecord(null);
      resetForm();
      loadRecords();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save');
    }
  };

  const handleEdit = (record) => {
    setForm({
      patientId: record.patientId, mrn: record.mrn || '', age: record.age?.toString() || '',
      gravida: record.gravida?.toString() || '', para: record.para?.toString() || '',
      gestationalAgeWeeks: record.gestationalAgeWeeks?.toString() || '',
      careType: record.careType || 'SAFE_ABORTION', procedureType: record.procedureType || '',
      managedAsOutpatient: record.managedAsOutpatient, managedAsInpatient: record.managedAsInpatient,
      referred: record.referred, drugsProvided: record.drugsProvided || '',
      hivTestAccepted: record.hivTestAccepted, hivTestResult: record.hivTestResult || '',
      hivTestReceivedCounselling: record.hivTestReceivedCounselling,
      hivPositiveLinkedART: record.hivPositiveLinkedART,
      postAbortionContraceptiveNew: record.postAbortionContraceptiveNew,
      postAbortionContraceptiveRepeat: record.postAbortionContraceptiveRepeat,
      postAbortionContraceptiveMethod: record.postAbortionContraceptiveMethod || '',
      death: record.death, complications: record.complications,
      complicationDetails: record.complicationDetails || '',
      safeAbortionReason: record.safeAbortionReason || '',
      postAbortionDiagnosis: record.postAbortionDiagnosis || '',
      otherServiceCode: record.otherServiceCode || '',
      referralSource: record.referralSource || '',
      serviceProviderName: record.serviceProviderName || '',
      serviceProviderSignature: record.serviceProviderSignature || ''
    });
    setEditRecord(record);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await api.delete(`/abortion-care/${id}`);
      toast.success('Record deleted');
      loadRecords();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const resetForm = () => {
    setForm({
      patientId: '', mrn: '', age: '', gravida: '', para: '', gestationalAgeWeeks: '',
      careType: 'SAFE_ABORTION', procedureType: '',
      managedAsOutpatient: true, managedAsInpatient: false,
      referred: false, drugsProvided: '',
      hivTestAccepted: false, hivTestResult: '',
      hivTestReceivedCounselling: false, hivPositiveLinkedART: false,
      postAbortionContraceptiveNew: false, postAbortionContraceptiveRepeat: false,
      postAbortionContraceptiveMethod: '',
      death: false, complications: false, complicationDetails: '',
      safeAbortionReason: '', postAbortionDiagnosis: '',
      otherServiceCode: '', referralSource: '',
      serviceProviderName: '', serviceProviderSignature: ''
    });
  };

  const filtered = records.filter(r =>
    (!searchTerm || r.mrn?.toLowerCase().includes(searchTerm.toLowerCase()) || r.patientId?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!filterCareType || r.careType === filterCareType)
  );

  const getAgeGroup = (record) => {
    const a = record.age;
    if (!a) return 'Unknown';
    if (a >= 10 && a <= 14) return '10-14';
    if (a >= 15 && a <= 19) return '15-19';
    if (a >= 20 && a <= 24) return '20-24';
    if (a >= 25 && a <= 29) return '25-29';
    if (a >= 30) return '30+';
    return 'Unknown';
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const now = new Date();
    const clinicName = window.__CS__?.name || 'Health Facility';
    const rows = filtered.map((r, i) => {
      const careType = r.careType === 'SAFE_ABORTION' ? 'SAFE' : 'POST-AB';
      const outcome = r.death ? 'Death' : r.complications ? 'Complications' : '';
      const hivResult = r.hivTestResult === 'POSITIVE' ? 'P' : r.hivTestResult === 'NEGATIVE' ? 'N' : '';
      const procedure = r.procedureType || '';
      const managed = [r.managedAsOutpatient ? 'OP' : '', r.managedAsInpatient ? 'IP' : ''].filter(Boolean).join('/') || '';
      const reason = r.careType === 'SAFE_ABORTION'
        ? (r.safeAbortionReason === 'RAPE' ? 'Rape' : r.safeAbortionReason === 'INCEST' ? 'Incest' : r.safeAbortionReason === 'MATERNAL_CONDITION' ? 'Mat. Cond' : r.safeAbortionReason === 'FETAL_DEFORMITY' ? 'Fetal Def.' : r.safeAbortionReason || '')
        : (r.postAbortionDiagnosis === 'INCOMPLETE' ? 'Incomplete' : r.postAbortionDiagnosis === 'INEVITABLE' ? 'Inevitable' : r.postAbortionDiagnosis === 'MISSED' ? 'Missed' : r.postAbortionDiagnosis === 'OTHER' ? 'Other' : r.postAbortionDiagnosis || '');
      const contraceptiveMethod = r.postAbortionContraceptiveMethod
        ? ({ Mc: 'MC', FeC: 'FC', OC: 'OC', Inj: 'Inj', Imp: 'Imp', IUCD: 'IUCD' }[r.postAbortionContraceptiveMethod] || r.postAbortionContraceptiveMethod)
        : '';
      const hivChecks = [r.hivTestAccepted ? 'A' : '', r.hivTestReceivedCounselling ? 'C' : ''].filter(Boolean).join('/');
      return `<tr>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${i + 1}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${new Date(r.createdAt).toLocaleDateString()}</td>
        <td style="padding:3px 4px;border:1px solid #000;font-size:8px;">${r.mrn || r.patientId}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.age || '-'}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.gravida || '-'}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.gestationalAgeWeeks || '-'}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${careType}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${managed}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${procedure}</td>
        <td style="padding:3px 4px;border:1px solid #000;font-size:8px;">${reason}</td>
        <td style="padding:3px 4px;border:1px solid #000;font-size:8px;">${r.drugsProvided || ''}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.postAbortionContraceptiveNew ? 'N' : ''}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.postAbortionContraceptiveRepeat ? 'R' : ''}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${contraceptiveMethod}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${hivChecks}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${hivResult}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.hivPositiveLinkedART ? 'Y' : ''}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${outcome}</td>
        <td style="padding:3px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.referred ? 'R' : ''}</td>
        <td style="padding:3px 4px;border:1px solid #000;font-size:8px;">${r.referralSource || ''}</td>
        <td style="padding:3px 4px;border:1px solid #000;font-size:8px;">${r.serviceProviderName || ''}</td>
      </tr>`;
    }).join('');

    const safeCount = filtered.filter(r => r.careType === 'SAFE_ABORTION').length;
    const postCount = filtered.filter(r => r.careType === 'POST_ABORTION').length;
    const deathCount = filtered.filter(r => r.death).length;
    const compCount = filtered.filter(r => r.complications).length;
    const hivPosCount = filtered.filter(r => r.hivTestResult === 'POSITIVE').length;
    const linkedART = filtered.filter(r => r.hivPositiveLinkedART).length;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head><title>Comprehensive Abortion Care Services Register</title></head>
<body style="font-family:Arial,sans-serif;margin:15px;color:#000;">
  <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px;">
    <div style="font-size:14px;font-weight:bold;">${clinicName}</div>
    <div style="font-size:15px;font-weight:bold;">Comprehensive Abortion Care Services Register</div>
    <div style="font-size:10px;color:#555;">${now.toLocaleDateString()}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:7.5px;">
    <thead>
      <tr style="background:#e0e0e0;">
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:16px;">S.N<br/>(1)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:38px;">Date<br/>(2)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:36px;">MRN<br/>(3)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:16px;">Age<br/>(4)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:14px;">G<br/>(5)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:16px;">GA<br/>(6)</th>
        <th colspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:30px;">Type<br/>(8)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:18px;">Mgt<br/>(9)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:22px;">Proc<br/>(10)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:40px;">Diagnosis/Reason<br/>(11)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:40px;">Drugs<br/>(12-15)</th>
        <th colspan="3" style="border:1px solid #000;padding:2px;text-align:center;width:36px;">Postabortion Contraception<br/>(16)</th>
        <th colspan="3" style="border:1px solid #000;padding:2px;text-align:center;width:30px;">HIV<br/>(17-19)</th>
        <th colspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:24px;">Outcome<br/>(20)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:30px;">Referral<br/>(35)</th>
        <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:40px;">Provider<br/>(36)</th>
      </tr>
      <tr style="background:#e0e0e0;">
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Safe</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Post</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">New</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Rep</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Mthd</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">A/C</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Res</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">ART</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Status</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Ref</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:12px;border-top:2px solid #000;padding-top:6px;">
    <table style="width:100%;border-collapse:collapse;font-size:9px;">
      <tr><td style="padding:2px 6px;"><b>Count:</b> Safe Abortion: ${safeCount} | Post-Abortion Care: ${postCount} | Deaths: ${deathCount} | Complications: ${compCount} | HIV+: ${hivPosCount} | Linked to ART: ${linkedART}</td></tr>
    </table>
  </div>
  <div style="margin-top:8px;border-top:1px solid #999;padding-top:4px;font-size:8px;color:#666;text-align:center;">
    Printed: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}
    <div style="margin-top:2px;">Codes: G=Gravida, GA=Gestational Age, Mgt=Managed as, Proc=Procedure, A/C=Accepted/Counselled, Res=Result, ART=Linked, Ref=Referred</div>
  </div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      {fromVisit && (
        <button
          onClick={() => navigate(`/doctor/consultation/${visitId}`)}
          className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Consultation
        </button>
      )}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-600" /> Comprehensive Abortion Care Register
          </h1>
          <p className="text-gray-500">{records.length} records</p>
        </div>
        <div className="flex gap-3">
          <select className="input py-2" value={filterCareType} onChange={e => setFilterCareType(e.target.value)}>
            <option value="">All Types</option>
            <option value="SAFE_ABORTION">Safe Abortion</option>
            <option value="POST_ABORTION">Post-Abortion Care</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search..." className="input pl-9 py-2"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <button className="btn btn-secondary flex items-center gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </button>
          <button className="btn btn-primary flex items-center gap-2"
            onClick={() => { resetForm(); setEditRecord(null); setShowForm(!showForm); }}>
            <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'New Record'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card mb-6 max-h-[80vh] flex flex-col">
          <div className="p-6 pb-0">
            <h2 className="text-lg font-semibold mb-4">{editRecord ? 'Edit' : 'New'} Abortion Care Record</h2>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1">
            <div className="overflow-y-auto flex-1 px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <label className="label">Patient *</label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search patient by name..."
                    value={showPatientSearch ? patientSearchQuery : (form.patientId ? `${form.patientId}${form.mrn ? ` (${form.mrn})` : ''}` : '')}
                    onFocus={() => { setShowPatientSearch(true); setPatientSearchQuery(''); }}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    className="input pr-10"
                    required={!form.patientId}
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                {showPatientSearch && patientSearchQuery.length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {searchingPatient ? (
                      <div className="p-3 text-gray-500 text-sm text-center">Searching...</div>
                    ) : patientSearchResults.length > 0 ? (
                      patientSearchResults.map(patient => (
                        <div
                          key={patient.id}
                          onClick={() => selectPatient(patient)}
                          className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                        >
                          <div className="font-medium text-sm">{patient.name}</div>
                          <div className="text-xs text-gray-500">ID: {patient.id} | Age: {patient.age || '?'} | {patient.gender || ''}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-gray-500 text-sm text-center">No patients found</div>
                    )}
                  </div>
                )}
                {form.patientId && !showPatientSearch && (
                  <button
                    type="button"
                    onClick={() => { setShowPatientSearch(true); setPatientSearchQuery(''); }}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                  >
                    Change patient
                  </button>
                )}
              </div>
              <div>
                <label className="label">MRN</label>
                <input className="input" value={form.mrn} onChange={e => setForm({...form, mrn: e.target.value})} />
              </div>
              <div>
                <label className="label">Age</label>
                <input type="number" className="input" value={form.age} onChange={e => setForm({...form, age: e.target.value})} />
              </div>
              <div>
                <label className="label">Gestational Age (wks)</label>
                <input type="number" className="input" value={form.gestationalAgeWeeks} onChange={e => setForm({...form, gestationalAgeWeeks: e.target.value})} />
              </div>
              <div>
                <label className="label">Gravida</label>
                <input type="number" className="input" value={form.gravida} onChange={e => setForm({...form, gravida: e.target.value})} />
              </div>
              <div>
                <label className="label">Para</label>
                <input type="number" className="input" value={form.para} onChange={e => setForm({...form, para: e.target.value})} />
              </div>
              <div>
                <label className="label">Care Type *</label>
                <select className="input" value={form.careType} onChange={e => setForm({...form, careType: e.target.value})} required>
                  <option value="SAFE_ABORTION">Safe Abortion</option>
                  <option value="POST_ABORTION">Post-Abortion Care</option>
                </select>
              </div>
              <div>
                <label className="label">Procedure</label>
                <select className="input" value={form.procedureType} onChange={e => setForm({...form, procedureType: e.target.value})}>
                  <option value="">Select</option>
                  {PROCEDURE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.managedAsOutpatient} onChange={e => setForm({...form, managedAsOutpatient: e.target.checked})} />
                Outpatient
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.managedAsInpatient} onChange={e => setForm({...form, managedAsInpatient: e.target.checked})} />
                Inpatient
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.referred} onChange={e => setForm({...form, referred: e.target.checked})} />
                Referred
              </label>
            </div>

            <div className="mb-4">
              <label className="label">Drugs Provided</label>
              <input className="input" value={form.drugsProvided} onChange={e => setForm({...form, drugsProvided: e.target.value})} placeholder="Analgesic, Anesthesia, Sedation / Dose" />
            </div>

            {form.careType === 'SAFE_ABORTION' && (
              <div className="mb-4">
                <label className="label">Reason for Safe Abortion</label>
                <select className="input" value={form.safeAbortionReason} onChange={e => setForm({...form, safeAbortionReason: e.target.value})}>
                  <option value="">Select</option>
                  {SAFE_ABORTION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            )}

            {form.careType === 'POST_ABORTION' && (
              <div className="mb-4">
                <label className="label">Post-Abortion Diagnosis</label>
                <select className="input" value={form.postAbortionDiagnosis} onChange={e => setForm({...form, postAbortionDiagnosis: e.target.value})}>
                  <option value="">Select</option>
                  {POST_ABORTION_DIAGNOSES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            )}

            <div className="border-t pt-4 mb-4">
              <h3 className="font-medium mb-2">HIV Assessment</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.hivTestAccepted} onChange={e => setForm({...form, hivTestAccepted: e.target.checked})} />
                  Test Accepted
                </label>
                <div>
                  <label className="label">Result</label>
                  <select className="input" value={form.hivTestResult} onChange={e => setForm({...form, hivTestResult: e.target.value})}>
                    <option value="">--</option>
                    <option value="POSITIVE">Positive</option>
                    <option value="NEGATIVE">Negative</option>
                  </select>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.hivTestReceivedCounselling} onChange={e => setForm({...form, hivTestReceivedCounselling: e.target.checked})} />
                  Post-test Counseling
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.hivPositiveLinkedART} onChange={e => setForm({...form, hivPositiveLinkedART: e.target.checked})} />
                  Linked to ART
                </label>
                <div>
                  <label className="label">Other Service Code</label>
                  <select className="input" value={form.otherServiceCode} onChange={e => setForm({...form, otherServiceCode: e.target.value})}>
                    <option value="">--</option>
                    <option value="1">Counseling</option>
                    <option value="2">Screening</option>
                    <option value="3">Diagnosis & Treatment</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mb-4">
              <h3 className="font-medium mb-2">Post-Abortion Contraception</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.postAbortionContraceptiveNew} onChange={e => setForm({...form, postAbortionContraceptiveNew: e.target.checked})} />
                  New Acceptor
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.postAbortionContraceptiveRepeat} onChange={e => setForm({...form, postAbortionContraceptiveRepeat: e.target.checked})} />
                  Repeat Acceptor
                </label>
                <div>
                  <label className="label">Method</label>
                  <select className="input" value={form.postAbortionContraceptiveMethod} onChange={e => setForm({...form, postAbortionContraceptiveMethod: e.target.value})}>
                    <option value="">Select</option>
                    <option value="Mc">Male Condom</option>
                    <option value="FeC">Female Condom</option>
                    <option value="OC">Oral Contraceptive</option>
                    <option value="Inj">Injectable</option>
                    <option value="Imp">Implant</option>
                    <option value="IUCD">IUCD</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mb-4">
              <h3 className="font-medium mb-2">Outcome</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.death} onChange={e => setForm({...form, death: e.target.checked})} />
                  Death
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.complications} onChange={e => setForm({...form, complications: e.target.checked})} />
                  Complications
                </label>
                {form.complications && (
                  <div>
                    <label className="label">Complication Details</label>
                    <input className="input" value={form.complicationDetails} onChange={e => setForm({...form, complicationDetails: e.target.value})} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Referral Source</label>
                <input className="input" value={form.referralSource} onChange={e => setForm({...form, referralSource: e.target.value})} placeholder="Letena, Tiko, Call center, Self" />
              </div>
              <div>
                <label className="label">Service Provider Name</label>
                <input className="input" value={form.serviceProviderName} onChange={e => setForm({...form, serviceProviderName: e.target.value})} />
              </div>
              <div>
                <label className="label">Provider Signature</label>
                <input className="input" value={form.serviceProviderSignature} onChange={e => setForm({...form, serviceProviderSignature: e.target.value})} />
              </div>
            </div>

            </div>{/* end scrollable content */}
            <div className="shrink-0 border-t bg-white px-6 py-4 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editRecord ? 'Update' : 'Save'} Record</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">MRN</th>
              <th className="p-3 text-left">Age/Gest.</th>
              <th className="p-3 text-left">Care Type</th>
              <th className="p-3 text-left">Procedure</th>
              <th className="p-3 text-left">G/P</th>
              <th className="p-3 text-left">HIV</th>
              <th className="p-3 text-left">Outcome</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="font-medium">{r.mrn || r.patientId}</div>
                </td>
                <td className="p-3">{r.age || '-'} / {r.gestationalAgeWeeks ? `${r.gestationalAgeWeeks}w` : '-'}</td>
                <td className="p-3">
                  <span className={`badge ${r.careType === 'SAFE_ABORTION' ? 'badge-warning' : 'badge-info'}`}>
                    {r.careType === 'SAFE_ABORTION' ? 'Safe' : 'Post-Abortion'}
                  </span>
                </td>
                <td className="p-3">{PROCEDURE_TYPES.find(p => p.value === r.procedureType)?.label?.split(' ')[0] || '-'}</td>
                <td className="p-3">{r.gravida}/{r.para}</td>
                <td className="p-3">
                  {r.hivTestResult === 'POSITIVE' ? <span className="text-red-600">+</span> :
                   r.hivTestResult === 'NEGATIVE' ? <span className="text-green-600">-</span> : '-'}
                </td>
                <td className="p-3">
                  {r.death ? <span className="text-red-600 font-medium">Died</span> :
                   r.complications ? <span className="text-orange-500">Compl.</span> : 'OK'}
                </td>
                <td className="p-3 text-center">
                  <button className="text-blue-600 hover:text-blue-800 mr-2" onClick={() => handleEdit(r)}><Edit2 className="h-4 w-4 inline" /></button>
                  <button className="text-red-600 hover:text-red-800" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 inline" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={9} className="p-6 text-center text-gray-500">No abortion care records found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AbortionCarePage;
