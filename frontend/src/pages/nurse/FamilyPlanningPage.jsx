import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Heart, Search, Plus, Edit2, Trash2, ChevronDown, ChevronUp, Printer, ArrowLeft } from 'lucide-react';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';

const TARGET_POPULATIONS = [
  { value: 'A', label: 'Female Commercial Sex Workers' },
  { value: 'B', label: 'Long Distance Drivers' },
  { value: 'C', label: 'Mobile/Daily Laborers' },
  { value: 'D', label: 'Prisoners' },
  { value: 'E', label: 'OVC' },
  { value: 'F', label: 'Children of PLHIV' },
  { value: 'G', label: 'Partners of PLHIV' },
  { value: 'H', label: 'Other MARPS' },
  { value: 'I', label: 'General Population' }
];

const CONTRACEPTIVE_METHODS = [
  { value: 'Imp', label: 'Implant' },
  { value: 'IUCD', label: 'IUCD' },
  { value: 'OC', label: 'Oral Contraceptive' },
  { value: 'Inj', label: 'Injectable' },
  { value: 'Mc', label: 'Male Condom' },
  { value: 'FeC', label: 'Female Condom' },
  { value: 'Ec', label: 'Emergency Contraceptive' },
  { value: 'TL', label: 'Tubal Ligation' },
  { value: 'Vas', label: 'Vasectomy' },
  { value: 'Oth', label: 'Other' }
];

const FamilyPlanningPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [visits, setVisits] = useState({});
  const [visitId, setVisitId] = useState(searchParams.get('visitId') || '');
  const [fromVisit, setFromVisit] = useState(!!searchParams.get('visitId'));
  const [form, setForm] = useState({
    patientId: searchParams.get('patientId') || '', mrn: '', name: '', age: '', sex: '',
    isNewAcceptor: true, isRepeatAcceptor: false,
    hivTestOffered: false, hivTestPerformed: false, hivTestResult: '',
    hivCounselingOffered: false, hivPositiveLinkedART: false,
    targetPopulation: '', tdStatusChecked: false,
    contraindicationIUCD: false, contraceptiveProvided: '',
    referralSource: '', notes: ''
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

  const mapGenderToSex = (gender) => {
    if (!gender) return '';
    if (gender === 'MALE') return 'M';
    if (gender === 'FEMALE') return 'F';
    return gender;
  };

  const selectPatient = (patient) => {
    setForm(prev => ({
      ...prev,
      patientId: patient.id,
      mrn: patient.mrn || '',
      name: patient.name || '',
      age: calcAge(patient.dob),
      sex: mapGenderToSex(patient.gender)
    }));
    setShowPatientSearch(false);
    setPatientSearchQuery('');
  };

  useEffect(() => {
    const pId = searchParams.get('patientId');
    const vId = searchParams.get('visitId');
    if (vId) setVisitId(vId);
    if (vId) setFromVisit(true);
    loadRecords();
    if (pId) {
      setForm(prev => ({ ...prev, patientId: pId }));
      api.get(`/patients/${pId}`).then(res => {
        const pt = res.data;
        if (pt) {
          setForm(prev => ({
            ...prev,
            patientId: pId,
            mrn: pt.mrn || '',
            name: pt.name || '',
            age: pt.age ? pt.age.toString() : calcAge(pt.dob),
            sex: mapGenderToSex(pt.gender)
          }));
        }
      }).catch(() => {});
      api.get(`/family-planning/patient/${pId}`).then(res => {
        setRecords(res.data || []);
      }).catch(() => {});
    }
    if (pId && vId) {
      setShowForm(true);
    }
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/family-planning');
      setRecords(res.data);
    } catch (e) {
      toast.error('Failed to load records');
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, visitId };
      if (editRecord) {
        await api.put(`/family-planning/${editRecord.id}`, payload);
        toast.success('Record updated');
      } else {
        await api.post('/family-planning', payload);
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
      patientId: record.patientId, mrn: record.mrn || '', name: record.name || '', age: record.age?.toString() || '', sex: record.sex || '',
      isNewAcceptor: record.isNewAcceptor, isRepeatAcceptor: record.isRepeatAcceptor,
      hivTestOffered: record.hivTestOffered, hivTestPerformed: record.hivTestPerformed,
      hivTestResult: record.hivTestResult || '', hivCounselingOffered: record.hivCounselingOffered,
      hivPositiveLinkedART: record.hivPositiveLinkedART,
      targetPopulation: record.targetPopulation || '', tdStatusChecked: record.tdStatusChecked,
      contraindicationIUCD: record.contraindicationIUCD,
      contraceptiveProvided: record.contraceptiveProvided || '',
      referralSource: record.referralSource || '', notes: record.notes || ''
    });
    setEditRecord(record);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await api.delete(`/family-planning/${id}`);
      toast.success('Record deleted');
      loadRecords();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const toggleExpand = async (recordId) => {
    if (expandedId === recordId) { setExpandedId(null); return; }
    setExpandedId(recordId);
    try {
      const res = await api.get('/family-planning/visits', { params: { recordId } });
      setVisits(prev => ({ ...prev, [recordId]: res.data }));
    } catch (e) {
      toast.error('Failed to load visits');
    }
  };

  const resetForm = () => {
    setForm({
      patientId: '', mrn: '', name: '', age: '', sex: '',
      isNewAcceptor: true, isRepeatAcceptor: false,
      hivTestOffered: false, hivTestPerformed: false, hivTestResult: '',
      hivCounselingOffered: false, hivPositiveLinkedART: false,
      targetPopulation: '', tdStatusChecked: false,
      contraindicationIUCD: false, contraceptiveProvided: '',
      referralSource: '', notes: ''
    });
  };

  const filtered = records.filter(r =>
    !searchTerm || r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mrn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.patientId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrint = () => {
    const clinicName = window.__CS__?.name || 'Health Facility';
    const now = new Date();
    const rows = filtered.map((r, i) => {
      const targetCode = r.targetPopulation || '';
      const methodAbbr = r.contraceptiveProvided || '';
      return `<tr>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${i + 1}</td>
        <td style="padding:2px 4px;border:1px solid #000;font-size:8px;">${r.mrn || '-'}</td>
        <td style="padding:2px 4px;border:1px solid #000;font-size:8px;">${r.name || '-'}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.age || '-'}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.sex || '-'}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.regDate ? new Date(r.regDate).toLocaleDateString() : '-'}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.hivTestOffered ? '✓' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.hivTestPerformed ? '✓' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.hivTestResult === 'POSITIVE' ? 'P' : r.hivTestResult === 'NEGATIVE' ? 'N' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.hivCounselingOffered ? '✓' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.hivPositiveLinkedART ? '✓' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${targetCode}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.isNewAcceptor ? '✓' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.isRepeatAcceptor ? '✓' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.contraindicationIUCD ? '✓' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${r.tdStatusChecked ? '✓' : ''}</td>
        <td style="padding:2px 4px;border:1px solid #000;text-align:center;font-size:8px;">${methodAbbr}</td>
        <td style="padding:2px 4px;border:1px solid #000;font-size:8px;">${r.referralSource || ''}</td>
      </tr>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Family Planning Register</title>
        </head>
        <body style="font-family:Arial,sans-serif;margin:15px;color:#000;">
          <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px;">
            <div style="font-size:14px;font-weight:bold;">${clinicName}</div>
            <div style="font-size:15px;font-weight:bold;">Family Planning Register</div>
            <div style="font-size:10px;color:#555;">${now.toLocaleDateString()}</div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:8px;">
            <thead>
              <tr style="background:#e0e0e0;">
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:14px;">S.N<br/>(1)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:30px;">MRN<br/>(2)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:50px;">Name of Client<br/>(3)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:14px;">Age<br/>(4)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:14px;">Sex<br/>(5)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:34px;">Reg. Date<br/>(6)</th>
                <th colspan="5" style="border:1px solid #000;padding:2px;text-align:center;">HIV Testing and Counselling<br/>(7-11)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:16px;">Target Pop.<br/>(12)</th>
                <th colspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:24px;">Acceptor<br/>(13-14)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:16px;">C/I IUCD<br/>(15)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:16px;">Td<br/>(16)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:22px;">Method<br/>(19)</th>
                <th rowspan="2" style="border:1px solid #000;padding:2px;text-align:center;width:30px;">Referral</th>
              </tr>
              <tr style="background:#e0e0e0;">
                <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Offered</th>
                <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Perf.</th>
                <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Result</th>
                <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Couns.</th>
                <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">ART</th>
                <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">New</th>
                <th style="border:1px solid #000;padding:2px;text-align:center;font-size:7px;">Repeat</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top:10px;border-top:1px solid #999;padding-top:4px;font-size:8px;color:#555;">
            <b>Abbreviations (Col.19):</b> Imp=Implant, Mc=Male condom, FeC=Female condom, OC=Oral contraceptive, Ec=Emergency Contraceptive, Inj=Injectable, IUCD=Intrauterine device, TL=Tubal ligation, Vas=Vasectomy, Oth=Others
          </div>
          <div style="margin-top:4px;font-size:8px;color:#555;">
            <b>Target Population (Col.12):</b> A=Female Commercial Sex workers, B=Long distance drivers, C=Mobile/Daily Laborers, D=Prisoners, E=OVC, F=Children of PLHIV, G=Partners of PLHIV, H=Other MARPS, I=General population
          </div>
          <div style="margin-top:4px;border-top:1px solid #999;padding-top:4px;font-size:8px;color:#666;text-align:center;">
            Printed: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      {fromVisit && (
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-600" /> Family Planning Register
          </h1>
          {!fromVisit && <p className="text-gray-500">{records.length} records</p>}
        </div>
        {!fromVisit && (
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search..." className="input pl-9 py-2"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button className="btn btn-outline flex items-center gap-2"
              onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </button>
            <button className="btn btn-primary flex items-center gap-2"
              onClick={() => { resetForm(); setEditRecord(null); setShowForm(!showForm); }}>
              <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'New Record'}
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="card mb-6 p-6">
          <h2 className="text-lg font-semibold mb-4">{editRecord ? 'Edit' : 'New'} Family Planning Record</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="relative">
                <label className="label">Patient *</label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search patient by name..."
                    value={showPatientSearch ? patientSearchQuery : (form.patientId ? `${form.name || form.patientId}` : '')}
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
                          <div className="text-xs text-gray-500">ID: {patient.id} | Age: {calcAge(patient.dob) || patient.age || '?'} | {patient.gender || ''}</div>
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
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div>
                <label className="label">Age</label>
                <input type="number" className="input" value={form.age} onChange={e => setForm({...form, age: e.target.value})} />
              </div>
              <div>
                <label className="label">Sex</label>
                <select className="input" value={form.sex} onChange={e => setForm({...form, sex: e.target.value})}>
                  <option value="">Select</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                </select>
              </div>
              <div>
                <label className="label">Target Population</label>
                <select className="input" value={form.targetPopulation} onChange={e => setForm({...form, targetPopulation: e.target.value})}>
                  <option value="">Select</option>
                  {TARGET_POPULATIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isNewAcceptor} onChange={e => setForm({...form, isNewAcceptor: e.target.checked})} />
                New Acceptor
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isRepeatAcceptor} onChange={e => setForm({...form, isRepeatAcceptor: e.target.checked})} />
                Repeat Acceptor
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.tdStatusChecked} onChange={e => setForm({...form, tdStatusChecked: e.target.checked})} />
                Td Status Checked
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.contraindicationIUCD} onChange={e => setForm({...form, contraindicationIUCD: e.target.checked})} />
                Contraindication for IUCD
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Contraceptive Provided</label>
                <select className="input" value={form.contraceptiveProvided} onChange={e => setForm({...form, contraceptiveProvided: e.target.value})}>
                  <option value="">Select</option>
                  {CONTRACEPTIVE_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Referral Source</label>
                <input className="input" value={form.referralSource} onChange={e => setForm({...form, referralSource: e.target.value})} />
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
            </div>

            <div className="border-t pt-4 mb-4">
              <h3 className="font-medium mb-2">HIV Testing & Counseling</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.hivTestOffered} onChange={e => setForm({...form, hivTestOffered: e.target.checked})} />
                  Test Offered
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.hivTestPerformed} onChange={e => setForm({...form, hivTestPerformed: e.target.checked})} />
                  Test Performed
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
                  <input type="checkbox" checked={form.hivCounselingOffered} onChange={e => setForm({...form, hivCounselingOffered: e.target.checked})} />
                  Counseling Offered
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.hivPositiveLinkedART} onChange={e => setForm({...form, hivPositiveLinkedART: e.target.checked})} />
                  Linked to ART
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editRecord ? 'Update' : 'Save'} Record</button>
            </div>
          </form>
        </div>
      )}

      {/* Previously filled records summary for triage mode */}
      {fromVisit && records.length > 0 && (
        <div className="mb-6 p-4 bg-pink-50 border border-pink-200 rounded-lg">
          <h3 className="text-sm font-semibold text-pink-800 flex items-center gap-2 mb-3">
            <Heart className="h-4 w-4" /> Previously Filled Records ({records.length})
          </h3>
          <div className="space-y-2">
            {records.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-white p-3 rounded border border-pink-100 text-sm">
                <div className="flex gap-4">
                  <span className="text-gray-500">{new Date(r.regDate).toLocaleDateString()}</span>
                  <span>Acceptor: <strong>{r.isNewAcceptor ? 'New' : r.isRepeatAcceptor ? 'Repeat' : '-'}</strong></span>
                  <span>Method: <strong>{CONTRACEPTIVE_METHODS.find(m => m.value === r.contraceptiveProvided)?.label || '-'}</strong></span>
                  <span>HIV: <strong>{r.hivTestPerformed ? (r.hivTestResult === 'POSITIVE' ? 'Positive' : 'Negative') : 'Not tested'}</strong></span>
                </div>
                <button onClick={() => handleEdit(r)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                  <Edit2 className="h-3 w-3 inline mr-1" />Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!fromVisit && (
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Name / MRN</th>
              <th className="p-3 text-left">Age/Sex</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Contraceptive</th>
              <th className="p-3 text-left">HIV</th>
              <th className="p-3 text-left">Population</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <React.Fragment key={r.id}>
                <tr className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(r.id)}>
                  <td className="p-3">
                    <div className="font-medium">{r.name || '-'}</div>
                    <div className="text-xs text-gray-500">{r.mrn || r.patientId}</div>
                  </td>
                  <td className="p-3">{r.age || '-'}/{r.sex || '-'}</td>
                  <td className="p-3">{new Date(r.regDate).toLocaleDateString()}</td>
                  <td className="p-3">
                    {r.isNewAcceptor && <span className="badge badge-success mr-1">New</span>}
                    {r.isRepeatAcceptor && <span className="badge badge-info">Repeat</span>}
                  </td>
                  <td className="p-3">{CONTRACEPTIVE_METHODS.find(m => m.value === r.contraceptiveProvided)?.label || '-'}</td>
                  <td className="p-3">
                    {r.hivTestResult === 'POSITIVE' ? <span className="text-red-600 font-medium">Positive</span> :
                     r.hivTestResult === 'NEGATIVE' ? <span className="text-green-600">Negative</span> : '-'}
                  </td>
                  <td className="p-3">{TARGET_POPULATIONS.find(t => t.value === r.targetPopulation)?.label?.split(' ')[0] || ''}</td>
                  <td className="p-3 text-center">
                    <button className="text-blue-600 hover:text-blue-800 mr-2" onClick={(e) => { e.stopPropagation(); handleEdit(r); }}><Edit2 className="h-4 w-4 inline" /></button>
                    <button className="text-red-600 hover:text-red-800" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}><Trash2 className="h-4 w-4 inline" /></button>
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr key={`visits-${r.id}`}>
                    <td colSpan={8} className="bg-gray-50 p-4">
                      <p className="font-medium mb-2">Follow-up Visits</p>
                      {(!visits[r.id] || visits[r.id].length === 0) ? (
                        <p className="text-gray-500 text-sm">No follow-up visits recorded.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead><tr className="border-b"><th className="p-2 text-left">Date</th><th className="p-2 text-left">Visit</th><th className="p-2 text-left">Contraceptive</th><th className="p-2 text-left">Appt. Date</th><th className="p-2 text-left">Referred From</th><th className="p-2 text-left">Note</th></tr></thead>
                          <tbody>
                            {visits[r.id].map(v => (
                              <tr key={v.id} className="border-b">
                                <td className="p-2">{new Date(v.visitDate).toLocaleDateString()}</td>
                                <td className="p-2">{v.visitNo}</td>
                                <td className="p-2">{CONTRACEPTIVE_METHODS.find(m => m.value === v.contraceptiveProvided)?.label || '-'}</td>
                                <td className="p-2">{v.appointmentDate ? new Date(v.appointmentDate).toLocaleDateString() : '-'}</td>
                                <td className="p-2">{v.referredFrom || '-'}</td>
                                <td className="p-2">{v.followUpNote || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">No family planning records found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default FamilyPlanningPage;
