import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Trash2 } from 'lucide-react';

const DIAGNOSIS_OPTIONS = [
  'Caries', 'Deep caries', 'Fractured', 'Attrition', 'Abrasion', 
  'Periapical lesion', 'Sensitivity'
];

const RESTORATION_OPTIONS = [
  'Filling', 'Crown', 'Veneer', 'Inlay', 'Onlay', 
  'Bridge abutment', 'Root canal treated', 'Implant crown'
];

const TREATMENT_PLAN_OPTIONS = [
  'Filling planned', 'Root canal therapy planned', 'Crown planned', 
  'Extraction planned', 'Implant planned'
];

// FDI to US / Name converter for header
const getToothName = (fdi) => {
    // simplified lookup or just return standard mapping
    return `Tooth ${fdi}`;
};

export default function ToothDetailPanel({
  toothNumber,
  initialData,
  onSave,
  onClose,
  patientName = 'Patient'
}) {
  const [formData, setFormData] = useState({
    diagnosis: [],
    diagnosisNotes: '',
    mobilityDiagnosis: '', // Grade I, II, III
    
    restoration: [],
    restorationNotes: '',
    
    treatmentPlan: [],
    treatmentPlanNotes: '',
    
    completedTreatments: [],
    
    periodontal: {
      pocketDepth: '',
      bleeding: false,
      recession: '',
      mobility: '',
      furcation: false,
      notes: ''
    },
    
    generalNotes: []
  });

  const [newCompletedText, setNewCompletedText] = useState('');
  const [newCompletedDate, setNewCompletedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newGeneralNote, setNewGeneralNote] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        // Ensure arrays exist
        diagnosis: initialData.diagnosis || [],
        restoration: initialData.restoration || [],
        treatmentPlan: initialData.treatmentPlan || [],
        completedTreatments: initialData.completedTreatments || [],
        generalNotes: initialData.generalNotes || [],
        periodontal: {
            ...prev.periodontal,
            ...(initialData.periodontal || {})
        }
      }));
    }
  }, [initialData]);

  const toggleArrayItem = (field, item) => {
    setFormData(prev => {
      const arr = prev[field];
      if (arr.includes(item)) {
        return { ...prev, [field]: arr.filter(i => i !== item) };
      }
      return { ...prev, [field]: [...arr, item] };
    });
  };

  const handleAddCompleted = () => {
    if (!newCompletedText.trim()) return;
    setFormData(prev => ({
      ...prev,
      completedTreatments: [
        ...prev.completedTreatments,
        {
          treatment: newCompletedText,
          date: newCompletedDate,
          dentistName: 'Current Doctor'
        }
      ]
    }));
    setNewCompletedText('');
  };

  const handleAddNote = () => {
    if (!newGeneralNote.trim()) return;
    setFormData(prev => ({
      ...prev,
      generalNotes: [
        ...prev.generalNotes,
        {
          text: newGeneralNote,
          date: new Date().toISOString()
        }
      ]
    }));
    setNewGeneralNote('');
  };
  
  const handleRemoveCompleted = (idx) => {
      setFormData(prev => ({
          ...prev,
          completedTreatments: prev.completedTreatments.filter((_, i) => i !== idx)
      }));
  };

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 text-blue-700 font-bold text-xl h-12 w-12 rounded-full flex items-center justify-center border-2 border-blue-200">
              {toothNumber}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{getToothName(toothNumber)}</h2>
              <p className="text-sm text-gray-500">Patient: {patientName}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium border border-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(toothNumber, formData)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center font-medium shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* SECTION 1: Diagnosis */}
          <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
            <div className="bg-red-50 px-6 py-3 border-b border-red-100">
              <h3 className="text-lg font-bold text-red-900">Diagnosis (Clinical Findings)</h3>
              <p className="text-sm text-red-600">What is wrong with the tooth right now?</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {DIAGNOSIS_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.diagnosis.includes(opt)}
                      onChange={() => toggleArrayItem('diagnosis', opt)}
                      className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
                    />
                    <span className="text-gray-700 font-medium">{opt}</span>
                  </label>
                ))}
                
                {/* Mobility Dropdown inline */}
                <div className="flex items-center space-x-3 p-2">
                    <span className="text-gray-700 font-medium">Mobility</span>
                    <select 
                        value={formData.mobilityDiagnosis}
                        onChange={(e) => setFormData(p => ({...p, mobilityDiagnosis: e.target.value}))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-red-500 focus:border-red-500 bg-white"
                    >
                        <option value="">None</option>
                        <option value="Grade I">Grade I</option>
                        <option value="Grade II">Grade II</option>
                        <option value="Grade III">Grade III</option>
                    </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Notes</label>
                <input
                  type="text"
                  value={formData.diagnosisNotes}
                  onChange={(e) => setFormData(p => ({...p, diagnosisNotes: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
                  placeholder="Additional diagnosis details..."
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Existing Restoration */}
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
            <div className="bg-blue-50 px-6 py-3 border-b border-blue-100">
              <h3 className="text-lg font-bold text-blue-900">Existing Restoration</h3>
              <p className="text-sm text-blue-600">What is already there?</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {RESTORATION_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.restoration.includes(opt)}
                      onChange={() => toggleArrayItem('restoration', opt)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-gray-700 font-medium">{opt}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Restoration Notes</label>
                <input
                  type="text"
                  value={formData.restorationNotes}
                  onChange={(e) => setFormData(p => ({...p, restorationNotes: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                  placeholder="Brand, materials, condition of existing restoration..."
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Treatment Plan */}
          <div className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden">
            <div className="bg-orange-50 px-6 py-3 border-b border-orange-100">
              <h3 className="text-lg font-bold text-orange-900">Treatment Plan</h3>
              <p className="text-sm text-orange-600">What doctor intends to do.</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {TREATMENT_PLAN_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200">
                    <input
                      type="checkbox"
                      checked={formData.treatmentPlan.includes(opt)}
                      onChange={() => toggleArrayItem('treatmentPlan', opt)}
                      className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500 border-gray-300"
                    />
                    <span className="text-gray-700 font-medium">{opt}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Plan Notes</label>
                <input
                  type="text"
                  value={formData.treatmentPlanNotes}
                  onChange={(e) => setFormData(p => ({...p, treatmentPlanNotes: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-500"
                  placeholder="Specifics of planned approach..."
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Completed Treatment */}
          <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden">
            <div className="bg-green-50 px-6 py-3 border-b border-green-100">
              <h3 className="text-lg font-bold text-green-900">Completed Treatment History</h3>
              <p className="text-sm text-green-600">Append-only history of what has been done</p>
            </div>
            <div className="p-6">
              {formData.completedTreatments.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {formData.completedTreatments.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between border-l-4 border-green-500 bg-gray-50 py-3 px-4 rounded-r-lg">
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">{entry.treatment}</p>
                        <p className="text-sm text-gray-500 flex items-center mt-1">
                          <Clock className="w-3 h-3 mr-1" />
                          {entry.date} • {entry.dentistName}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleRemoveCompleted(idx)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-200 rounded transition-colors"
                        title="Remove entry"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic mb-6">No completed treatments recorded yet.</p>
              )}

              <div className="flex flex-col md:flex-row gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <input
                  type="date"
                  value={newCompletedDate}
                  onChange={e => setNewCompletedDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 shrink-0 bg-white"
                />
                <input
                  type="text"
                  value={newCompletedText}
                  onChange={e => setNewCompletedText(e.target.value)}
                  placeholder="e.g. Root Canal Therapy, Crown Cemented..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white"
                />
                <button
                  onClick={handleAddCompleted}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shrink-0 whitespace-nowrap"
                >
                  Add Completed
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 5: Periodontal */}
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
            <div className="bg-purple-50 px-6 py-3 border-b border-purple-100">
              <h3 className="text-lg font-bold text-purple-900">Periodontal (Gum Disease)</h3>
              <p className="text-sm text-purple-600">Basic tracking for this specific tooth</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pocket Depth (mm)</label>
                  <input
                    type="number"
                    value={formData.periodontal.pocketDepth}
                    onChange={e => setFormData(p => ({...p, periodontal: {...p.periodontal, pocketDepth: e.target.value}}))}
                    className="w-full border border-gray-300 rounded p-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gum Recession (mm)</label>
                  <input
                    type="number"
                    value={formData.periodontal.recession}
                    onChange={e => setFormData(p => ({...p, periodontal: {...p.periodontal, recession: e.target.value}}))}
                    className="w-full border border-gray-300 rounded p-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobility</label>
                  <select
                    value={formData.periodontal.mobility}
                    onChange={e => setFormData(p => ({...p, periodontal: {...p.periodontal, mobility: e.target.value}}))}
                    className="w-full border border-gray-300 rounded p-2 bg-white focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">None</option>
                    <option value="Grade I">Grade I</option>
                    <option value="Grade II">Grade II</option>
                    <option value="Grade III">Grade III</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.periodontal.bleeding}
                      onChange={e => setFormData(p => ({...p, periodontal: {...p.periodontal, bleeding: e.target.checked}}))}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300 mr-2"
                    />
                    <span className="font-medium text-gray-700">Bleeding on Probing</span>
                  </label>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.periodontal.furcation}
                      onChange={e => setFormData(p => ({...p, periodontal: {...p.periodontal, furcation: e.target.checked}}))}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300 mr-2"
                    />
                    <span className="font-medium text-gray-700">Furcation Involv.</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Periodontal Notes</label>
                <input
                  type="text"
                  value={formData.periodontal.notes}
                  onChange={(e) => setFormData(p => ({...p, periodontal: {...p.periodontal, notes: e.target.value}}))}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="Additional periodontal observations..."
                />
              </div>
            </div>
          </div>

          {/* SECTION 6: General Tooth Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">General Notes (Log)</h3>
              <p className="text-sm text-gray-600">Free-text clinical notes, appended with timestamp</p>
            </div>
            <div className="p-6">
              {formData.generalNotes.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {formData.generalNotes.map((note, idx) => (
                    <div key={idx} className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                      <p className="text-gray-800 whitespace-pre-wrap">{note.text}</p>
                      <p className="text-xs text-gray-500 mt-2 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(note.date).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic mb-6">No notes added yet.</p>
              )}

              <div className="flex gap-3">
                <textarea
                  value={newGeneralNote}
                  onChange={e => setNewGeneralNote(e.target.value)}
                  placeholder="Type new observation or note here..."
                  className="flex-1 border border-gray-300 rounded-lg p-3 bg-white min-h-[80px]"
                />
                <button
                  onClick={handleAddNote}
                  className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded-lg font-medium transition-colors shrink-0"
                >
                  Add Note
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
