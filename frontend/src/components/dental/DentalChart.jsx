import React, { useState, forwardRef, useImperativeHandle, useMemo, useEffect, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Save, Zap, Printer } from 'lucide-react';
import ToothQuickPanel from './ToothQuickPanel';

// FDI tooth numbering system (conventional dentist-view lower arch order)
const PERMANENT_UPPER = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28
];

const PERMANENT_LOWER = [
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38
];

const PRIMARY_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const PRIMARY_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

const ALL_TOOTH_NUMBERS = [
  ...PERMANENT_UPPER,
  ...PERMANENT_LOWER,
  ...PRIMARY_UPPER,
  ...PRIMARY_LOWER
];

const deriveChartTypeByAge = (age) => {
  if (!Number.isFinite(age)) return 'PERMANENT';
  if (age < 6) return 'PRIMARY';
  if (age < 13) return 'MIXED';
  return 'PERMANENT';
};

// Clean Tooth Component
const ToothComponent = ({ toothNumber, data = {}, hasPain, onClick, position }) => {
  const isCentral = position === 7 || position === 8; // Central incisors

  // Logical Indicators
  // 1. Diagnosis (Active Issue) => Red Border
  const hasDiagnosis = data.diagnosis?.length > 0;

  // 2. Restoration (Existing Treatment) => Blue Dot/Background tint
  const hasRestoration = data.restoration?.length > 0;

  // 3. Treatment Planned => Orange Border/Dot
  const hasTreatmentPlan = data.treatmentPlan?.length > 0;

  // 4. Completed (Extraction specifically) => Dark Red
  const isExtracted = data.completedTreatments?.some(t => t.treatment === 'Extraction' || t.treatment === 'Extraction completed');

  // 5. Periodontal => Purple indicator 
  const hasPerio = data.periodontal?.pocketDepth >= 4 || data.periodontal?.bleeding;

  return (
    <div className="relative group">
      <div
        className="relative cursor-pointer transition-all duration-300 transform hover:scale-105"
        onClick={onClick}
        style={{
          width: isCentral ? '50px' : '40px',
          height: isCentral ? '50px' : '40px',
        }}
      >
        {/* Tooth Shape - Replaces rainbow with structural indicators */}
        <div
          className={`w-full h-full rounded-lg border-2 flex items-center justify-center relative overflow-hidden transition-colors ${isExtracted ? 'opacity-30 border-dashed' : 'shadow-sm hover:shadow-md'}`}
          style={{
            backgroundColor: hasRestoration ? '#EFF6FF' : '#FFFFFF', // Blue tint if restored
            borderColor: hasDiagnosis ? '#EF4444' : (hasTreatmentPlan ? '#F97316' : '#E5E7EB'), // Red if bad, Orange if plan, Grey if healthy
            borderStyle: isExtracted ? 'dashed' : 'solid',
            borderWidth: hasDiagnosis || hasTreatmentPlan ? '3px' : '2px'
          }}
        >
          {/* Tooth Number */}
          <span
            className={`font-bold drop-shadow-sm ${hasDiagnosis ? 'text-red-700' : (hasRestoration ? 'text-blue-700' : 'text-gray-700')}`}
            style={{ fontSize: isCentral ? '14px' : '12px' }}
          >
            {toothNumber}
          </span>

          {/* Indicators layer */}
          <div className="absolute inset-x-1 bottom-1 flex justify-center space-x-1">
            {hasRestoration && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Restoration Present"></div>}
            {hasPerio && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Periodontal Issue"></div>}
            {hasTreatmentPlan && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" title="Treatment Planned"></div>}
          </div>

          {/* Pain Indicator */}
          {hasPain && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
              <Zap className="w-2 h-2 text-white" />
            </div>
          )}

          {/* Hover Overlay */}
          <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gray-900 pointer-events-none"></div>
        </div>

        {/* Clean Tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap z-20 pointer-events-none shadow-lg">
          <div className="font-bold border-b border-gray-700 pb-1 mb-1">Tooth {toothNumber}</div>
          {isExtracted && <div className="text-red-400">Extracted</div>}
          {hasDiagnosis && <div className="text-red-300 mt-1">Diagnosis: {data.diagnosis.join(', ')}</div>}
          {hasRestoration && <div className="text-blue-300 mt-1">Restoration: {data.restoration.join(', ')}</div>}
          {hasTreatmentPlan && <div className="text-orange-300 mt-1">Plan: {data.treatmentPlan.join(', ')}</div>}
          {hasPerio && <div className="text-purple-300 mt-1">Periodontal Warning</div>}
          {!hasDiagnosis && !hasRestoration && !hasTreatmentPlan && !isExtracted && <div className="text-green-400">Healthy</div>}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
};

const DentalChart = forwardRef(({ patientId, visitId, patientAge, onSave, initialData, onOpenServiceOrder }, ref) => {
  const ageBasedChartType = useMemo(() => deriveChartTypeByAge(Number(patientAge)), [patientAge]);

  // Create stable initial state that never changes
  const initialToothChart = useMemo(() => {
    const chart = {};
    ALL_TOOTH_NUMBERS.forEach((tooth) => {
      chart[tooth] = {
        diagnosis: [],
        restoration: [],
        treatmentPlan: [],
        completedTreatments: [],
        periodontal: {},
        generalNotes: [],
        notes: '',
        surfaces: []
      };
    });
    return chart;
  }, []);

  const [toothChart, setToothChart] = useState(initialToothChart);
  const [painFlags, setPainFlags] = useState({});
  const [gumCondition, setGumCondition] = useState('');
  const [oralHygiene, setOralHygiene] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [currentTooth, setCurrentTooth] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('odontogram');
  const [chartType, setChartType] = useState(ageBasedChartType);
  const [periodontalChart, setPeriodontalChart] = useState({
    plaqueScore: '',
    bleedingScore: '',
    overallRisk: '',
    notes: ''
  });
  const [orthodonticExam, setOrthodonticExam] = useState({
    angleClassLeft: '',
    angleClassRight: '',
    overjet: '',
    overbite: '',
    crossbite: '',
    openBite: false,
    deepBite: false,
    crowdingUpper: '',
    crowdingLower: '',
    spacingUpper: '',
    spacingLower: '',
    midlineShift: '',
    notes: '',
    recommendation: ''
  });

  useEffect(() => {
    setChartType((prev) => prev || ageBasedChartType);
  }, [ageBasedChartType]);

  // Auto-save: watch for changes and save with debounce
  const autoSaveTimer = useRef(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!isLoaded.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (!patientId || !visitId) return;
      api.post('/dental/records', {
        patientId,
        visitId: parseInt(visitId),
        toothChart, painFlags, gumCondition, oralHygiene, notes,
        treatmentPlan: { chartType, periodontalChart, orthodonticExam }
      }).then((res) => {
        onSave?.(res.data.dentalRecord);
      }).catch((err) => {
        console.error('Auto-save error:', err);
      });
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [toothChart, painFlags, gumCondition, oralHygiene, notes, chartType, periodontalChart, orthodonticExam]);

  // Load existing dental record data when initialData changes
  useEffect(() => {
    if (initialData) {
      isLoaded.current = false;
      console.log('🔍 Loading existing dental record data:', initialData);

      // Load tooth chart data
      if (initialData.toothChart) {
        console.log('📊 Loading tooth chart data:', Object.keys(initialData.toothChart).length, 'teeth');
        setToothChart(prev => ({
          ...prev,
          ...initialData.toothChart
        }));
      }

      // Load other dental data
      if (initialData.painFlags) {
        console.log('📊 Loading pain flags:', Object.keys(initialData.painFlags).length, 'teeth');
        setPainFlags(initialData.painFlags);
      }
      if (initialData.gumCondition) {
        console.log('📊 Loading gum condition:', initialData.gumCondition);
        setGumCondition(initialData.gumCondition);
      }
      if (initialData.oralHygiene) {
        console.log('📊 Loading oral hygiene:', initialData.oralHygiene);
        setOralHygiene(initialData.oralHygiene);
      }
      if (initialData.notes) {
        console.log('📊 Loading notes:', initialData.notes);
        setNotes(initialData.notes);
      }

      const savedMeta = initialData.treatmentPlan || {};
      if (savedMeta.chartType) {
        setChartType(savedMeta.chartType);
      }
      if (savedMeta.periodontalChart) {
        setPeriodontalChart((prev) => ({ ...prev, ...savedMeta.periodontalChart }));
      }
      if (savedMeta.orthodonticExam) {
        setOrthodonticExam((prev) => ({ ...prev, ...savedMeta.orthodonticExam }));
      }

      console.log('✅ Dental record data loaded successfully');
    } else {
      console.log('ℹ️ No initial data provided, using default values');
    }
    setTimeout(() => { isLoaded.current = true; }, 500);
  }, [initialData]);

  // Debug: trace renders and key state changes
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug('[DentalChart] render', { visitId, patientId, chartKeys: Object.keys(toothChart).length });
  });

  useEffect(() => {
    if (showStatusModal) {
      // eslint-disable-next-line no-console
      console.debug('[DentalChart] open status modal for tooth', currentTooth);
    }
  }, [showStatusModal, currentTooth]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    getCurrentData: () => ({
      toothChart,
      painFlags,
      gumCondition,
      oralHygiene,
      notes,
      chartType,
      periodontalChart,
      orthodonticExam
    })
  }));

  const handleToothClick = (toothNumber) => {
    // eslint-disable-next-line no-console
    console.debug('[DentalChart] click tooth', toothNumber);
    setCurrentTooth(toothNumber);
    setShowStatusModal(true);
  };

  const handleSaveToothPanel = (toothNumber, updatedData) => {
    setToothChart(prev => {
      const newChart = {
        ...prev,
        [toothNumber]: {
          ...prev[toothNumber],
          ...updatedData
        }
      };
      // Immediate auto-save after tooth change
      if (isLoaded.current && patientId && visitId) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
          api.post('/dental/records', {
            patientId,
            visitId: parseInt(visitId),
            toothChart: newChart, painFlags, gumCondition, oralHygiene, notes,
            treatmentPlan: { chartType, periodontalChart, orthodonticExam }
          }).then((res) => onSave?.(res.data.dentalRecord))
            .catch((err) => console.error('Tooth auto-save error:', err));
        }, 300);
      }
      return newChart;
    });
    setShowStatusModal(false);
  };

  const handlePainFlagToggle = (toothNumber) => {
    // eslint-disable-next-line no-console
    console.debug('[DentalChart] toggle pain', toothNumber);
    setPainFlags(prev => ({
      ...prev,
      [toothNumber]: !prev[toothNumber]
    }));
  };

  const handleSave = async () => {
    // eslint-disable-next-line no-console
    console.debug('[DentalChart] save', { patientId, visitId });
    setLoading(true);
    try {
      const dentalData = {
        patientId,
        visitId: parseInt(visitId), // Convert string to number
        toothChart,
        painFlags,
        gumCondition,
        oralHygiene,
        notes,
        treatmentPlan: {
          chartType,
          periodontalChart,
          orthodonticExam
        }
      };

      const response = await api.post('/dental/records', dentalData);
      // Don't show toast here - let the parent component handle it to avoid double popup
      onSave(response.data.dentalRecord);
    } catch (error) {
      console.error('Error saving dental chart:', error);
      toast.error('Failed to save dental chart.');
    } finally {
      setLoading(false);
    }
  };

  const getVisibleTeethByType = () => {
    if (chartType === 'PRIMARY') {
      return {
        upper: PRIMARY_UPPER,
        lower: PRIMARY_LOWER,
        modeLabel: 'Primary Dentition (FDI 5-8 quadrants)'
      };
    }

    if (chartType === 'MIXED') {
      return {
        upper: PERMANENT_UPPER,
        lower: PERMANENT_LOWER,
        primaryUpper: PRIMARY_UPPER,
        primaryLower: PRIMARY_LOWER,
        modeLabel: 'Mixed Dentition'
      };
    }

    return {
      upper: PERMANENT_UPPER,
      lower: PERMANENT_LOWER,
      modeLabel: 'Permanent Dentition (FDI 1-4 quadrants)'
    };
  };

  const currentTeethConfig = getVisibleTeethByType();

  const periodontalToothRows = useMemo(() => {
    const rows = [];
    Object.entries(toothChart).forEach(([toothNumber, data]) => {
      const p = data?.periodontal || {};
      if (p.pocketDepth || p.recession || p.mobility || p.bleeding || p.furcation || p.notes) {
        rows.push({ toothNumber, ...p });
      }
    });
    rows.sort((a, b) => Number(a.toothNumber) - Number(b.toothNumber));
    return rows;
  }, [toothChart]);

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const printHeaderHtml = (title) => {
    const now = new Date();
    const dateText = now.toLocaleDateString();
    const timeText = now.toLocaleTimeString();

    return `
      <div class="header">
        <h1>${window.__CS__?.name || 'Clinic'}</h1>
        <p>Dental Department</p>
        <h2>${escapeHtml(title)}</h2>
        <div class="meta-grid">
          <div><strong>Patient ID:</strong> ${escapeHtml(patientId || 'N/A')}</div>
          <div><strong>Visit ID:</strong> ${escapeHtml(visitId || 'N/A')}</div>
          <div><strong>Patient Age:</strong> ${escapeHtml(Number.isFinite(Number(patientAge)) ? patientAge : 'N/A')}</div>
          <div><strong>Dentition Type:</strong> ${escapeHtml(chartType)}</div>
          <div><strong>Generated Date:</strong> ${escapeHtml(dateText)}</div>
          <div><strong>Generated Time:</strong> ${escapeHtml(timeText)}</div>
        </div>
      </div>
    `;
  };

  const printStyles = `
    body { font-family: Arial, sans-serif; padding: 18px; color: #111827; }
    .header { border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 14px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 2px 0 8px; color: #4b5563; }
    .header h2 { margin: 8px 0 10px; font-size: 18px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12px; }
    .section-title { font-size: 14px; font-weight: 700; margin: 14px 0 8px; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; }
    .summary-box { border: 1px solid #d1d5db; background: #f9fafb; padding: 8px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f3f4f6; }
    .notes { border: 1px solid #d1d5db; min-height: 56px; padding: 8px; font-size: 12px; white-space: pre-wrap; }
  `;

  const printPeriodontalSummary = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const rowsHtml = periodontalToothRows.length > 0
      ? periodontalToothRows
        .map((row) => `
          <tr>
            <td>${escapeHtml(row.toothNumber)}</td>
            <td>${escapeHtml(row.pocketDepth || '-')}</td>
            <td>${escapeHtml(row.recession || '-')}</td>
            <td>${escapeHtml(row.mobility || '-')}</td>
            <td>${row.bleeding ? 'Yes' : 'No'}</td>
            <td>${row.furcation ? 'Yes' : 'No'}</td>
            <td>${escapeHtml(row.notes || '-')}</td>
          </tr>
        `)
        .join('')
      : '<tr><td colspan="7">No periodontal tooth-level findings recorded.</td></tr>';

    w.document.write(`
      <html>
        <head>
          <title>Periodontal Chart Report</title>
          <style>${printStyles}</style>
        </head>
        <body>
          ${printHeaderHtml('Periodontal Chart Report')}

          <div class="section-title">Summary</div>
          <div class="summary-grid">
            <div class="summary-box"><strong>Plaque Score:</strong><br/>${escapeHtml(periodontalChart.plaqueScore || '-')}</div>
            <div class="summary-box"><strong>Bleeding Score:</strong><br/>${escapeHtml(periodontalChart.bleedingScore || '-')}</div>
            <div class="summary-box"><strong>Overall Risk:</strong><br/>${escapeHtml(periodontalChart.overallRisk || '-')}</div>
          </div>

          <div class="section-title">Tooth-Level Findings</div>
          <table>
            <thead>
              <tr>
                <th>Tooth</th>
                <th>Pocket Depth</th>
                <th>Recession</th>
                <th>Mobility</th>
                <th>Bleeding</th>
                <th>Furcation</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="section-title">Clinical Notes</div>
          <div class="notes">${escapeHtml(periodontalChart.notes || 'No summary notes.')}</div>

          <script>window.print();</script>
        </body>
      </html>
    `);

    w.document.close();
  };

  const printOrthodonticSummary = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const boolLabel = (value) => (value ? 'Yes' : 'No');

    w.document.write(`
      <html>
        <head>
          <title>Orthodontic Exam Summary</title>
          <style>${printStyles}</style>
        </head>
        <body>
          ${printHeaderHtml('Orthodontic Examination Report')}

          <div class="section-title">Occlusion and Measurements</div>
          <table>
            <tr><th>Angle Class (Left)</th><td>${escapeHtml(orthodonticExam.angleClassLeft || '-')}</td></tr>
            <tr><th>Angle Class (Right)</th><td>${escapeHtml(orthodonticExam.angleClassRight || '-')}</td></tr>
            <tr><th>Overjet (mm)</th><td>${escapeHtml(orthodonticExam.overjet || '-')}</td></tr>
            <tr><th>Overbite</th><td>${escapeHtml(orthodonticExam.overbite || '-')}</td></tr>
            <tr><th>Crossbite</th><td>${escapeHtml(orthodonticExam.crossbite || '-')}</td></tr>
            <tr><th>Open Bite</th><td>${boolLabel(orthodonticExam.openBite)}</td></tr>
            <tr><th>Deep Bite</th><td>${boolLabel(orthodonticExam.deepBite)}</td></tr>
            <tr><th>Crowding (Upper)</th><td>${escapeHtml(orthodonticExam.crowdingUpper || '-')}</td></tr>
            <tr><th>Crowding (Lower)</th><td>${escapeHtml(orthodonticExam.crowdingLower || '-')}</td></tr>
            <tr><th>Spacing (Upper)</th><td>${escapeHtml(orthodonticExam.spacingUpper || '-')}</td></tr>
            <tr><th>Spacing (Lower)</th><td>${escapeHtml(orthodonticExam.spacingLower || '-')}</td></tr>
            <tr><th>Midline Shift</th><td>${escapeHtml(orthodonticExam.midlineShift || '-')}</td></tr>
          </table>

          <div class="section-title">Recommendation</div>
          <div class="notes">${escapeHtml(orthodonticExam.recommendation || 'No recommendation entered.')}</div>

          <div class="section-title">Clinical Notes</div>
          <div class="notes">${escapeHtml(orthodonticExam.notes || 'No clinical notes entered.')}</div>

          <script>window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  const renderOdontogramGrid = () => (
    <div className="p-8">
      <div className="relative max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="text-center mb-6">
            <h5 className="text-lg font-semibold text-gray-700">Maxillary Arch (Upper Jaw)</h5>
            <div className="w-24 h-px mx-auto mt-2 bg-gray-300"></div>
          </div>
          <div className="flex justify-center">
            <div className="flex space-x-2 flex-wrap justify-center gap-y-2">
              {currentTeethConfig.upper.map((toothNumber, index) => (
                <ToothComponent
                  key={toothNumber}
                  toothNumber={toothNumber}
                  data={toothChart[toothNumber] || {}}
                  hasPain={painFlags[toothNumber]}
                  onClick={() => handleToothClick(toothNumber)}
                  position={index}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <div className="w-px h-8 bg-gray-300"></div>
        </div>

        <div>
          <div className="text-center mb-6">
            <h5 className="text-lg font-semibold text-gray-700">Mandibular Arch (Lower Jaw)</h5>
            <div className="w-24 h-px mx-auto mt-2 bg-gray-300"></div>
            <p className="text-xs text-gray-500 mt-2">Dentist-view orientation</p>
          </div>
          <div className="flex justify-center">
            <div className="flex space-x-2 flex-wrap justify-center gap-y-2">
              {currentTeethConfig.lower.map((toothNumber, index) => (
                <ToothComponent
                  key={toothNumber}
                  toothNumber={toothNumber}
                  data={toothChart[toothNumber] || {}}
                  hasPain={painFlags[toothNumber]}
                  onClick={() => handleToothClick(toothNumber)}
                  position={index}
                />
              ))}
            </div>
          </div>
        </div>

        {chartType === 'MIXED' && (
          <div className="mt-10 border-t pt-8">
            <h5 className="text-lg font-semibold text-gray-700 text-center mb-5">Primary Teeth Overlay (Mixed Dentition)</h5>
            <div className="space-y-6">
              <div>
                <h6 className="text-sm text-gray-600 text-center mb-2">Primary Upper</h6>
                <div className="flex justify-center">
                  <div className="flex space-x-2 flex-wrap justify-center gap-y-2">
                    {currentTeethConfig.primaryUpper.map((toothNumber) => (
                      <ToothComponent
                        key={toothNumber}
                        toothNumber={toothNumber}
                        data={toothChart[toothNumber] || {}}
                        hasPain={painFlags[toothNumber]}
                        onClick={() => handleToothClick(toothNumber)}
                        position={0}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <h6 className="text-sm text-gray-600 text-center mb-2">Primary Lower (Dentist-view orientation)</h6>
                <div className="flex justify-center">
                  <div className="flex space-x-2 flex-wrap justify-center gap-y-2">
                    {currentTeethConfig.primaryLower.map((toothNumber) => (
                      <ToothComponent
                        key={toothNumber}
                        toothNumber={toothNumber}
                        data={toothChart[toothNumber] || {}}
                        hasPain={painFlags[toothNumber]}
                        onClick={() => handleToothClick(toothNumber)}
                        position={0}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Clean Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">🦷</span>
            </div>
            <div>
              <h4 className="text-2xl font-bold text-gray-800">Digital Dental Chart</h4>
              <p className="text-sm text-gray-600">Interactive FDI Odontogram, Periodontal and Orthodontic Assessment</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 transform hover:scale-105 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            <span>{loading ? 'Saving...' : 'Save Chart'}</span>
          </button>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chart Type</label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="PERMANENT">Permanent Dentition</option>
              <option value="MIXED">Mixed Dentition</option>
              <option value="PRIMARY">Primary Dentition (Pediatric)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Suggested by age ({Number.isFinite(Number(patientAge)) ? patientAge : 'N/A'} years): {ageBasedChartType}
            </p>
          </div>
          <div className="text-sm text-gray-600 lg:text-right">
            <span className="font-medium">View orientation:</span> Dentist-view lower arch (48..41 then 31..38)
          </div>
        </div>
      </div>

      <div className="px-6 pt-4 border-b border-gray-200 bg-white">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubTab('odontogram')}
            className={`px-4 py-2 rounded-t-md text-sm font-medium ${activeSubTab === 'odontogram' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Odontogram
          </button>
          <button
            onClick={() => setActiveSubTab('periodontal')}
            className={`px-4 py-2 rounded-t-md text-sm font-medium ${activeSubTab === 'periodontal' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Periodontal
          </button>
          <button
            onClick={() => setActiveSubTab('orthodontic')}
            className={`px-4 py-2 rounded-t-md text-sm font-medium ${activeSubTab === 'orthodontic' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Orthodontic Exam
          </button>
        </div>
      </div>

      {/* Clean Legend */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-4 items-center justify-center">
          <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
            <div className="w-6 h-6 rounded border-[3px] border-red-500 bg-white"></div>
            <span className="text-sm font-medium text-gray-700">Diagnosis (Active)</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-[#EFF6FF] border border-blue-200 shadow-sm">
            <div className="w-6 h-6 rounded border-2 border-gray-200 bg-[#EFF6FF] flex items-center justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
            <span className="text-sm font-medium text-gray-700">Restoration (Existing)</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
            <div className="w-6 h-6 rounded border-[3px] border-orange-500 bg-white flex items-center justify-center">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            </div>
            <span className="text-sm font-medium text-gray-700">Treatment Planned</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-200 shadow-sm opacity-50 border-dashed">
            <span className="text-sm font-medium text-gray-700">Extracted / Missing</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700">Perio Warning</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
            <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse border-2 border-white shadow-md"></div>
            <span className="text-sm font-medium text-gray-700">Pain Flag</span>
          </div>
        </div>
      </div>

      {activeSubTab === 'odontogram' && renderOdontogramGrid()}

      {activeSubTab === 'periodontal' && (
        <div className="p-6 space-y-6">
          <div className="flex justify-end">
            <button onClick={printPeriodontalSummary} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium flex items-center gap-2">
              <Printer className="h-4 w-4" /> Print Periodontal Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plaque Score (%)</label>
              <input
                type="number"
                value={periodontalChart.plaqueScore}
                onChange={(e) => setPeriodontalChart((p) => ({ ...p, plaqueScore: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bleeding Score (%)</label>
              <input
                type="number"
                value={periodontalChart.bleedingScore}
                onChange={(e) => setPeriodontalChart((p) => ({ ...p, bleedingScore: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Overall Risk</label>
              <select
                value={periodontalChart.overallRisk}
                onChange={(e) => setPeriodontalChart((p) => ({ ...p, overallRisk: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-2 bg-white"
              >
                <option value="">Select risk</option>
                <option value="LOW">Low</option>
                <option value="MODERATE">Moderate</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teeth with Perio Findings</label>
              <input value={periodontalToothRows.length} readOnly className="w-full border border-gray-200 rounded-lg p-2 bg-gray-100" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Periodontal Summary Notes</label>
            <textarea
              rows="3"
              value={periodontalChart.notes}
              onChange={(e) => setPeriodontalChart((p) => ({ ...p, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg p-2"
              placeholder="Overall periodontal findings and plan"
            />
          </div>

          <div className="border rounded-lg overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Tooth</th>
                  <th className="px-3 py-2 text-left">Pocket Depth</th>
                  <th className="px-3 py-2 text-left">Recession</th>
                  <th className="px-3 py-2 text-left">Mobility</th>
                  <th className="px-3 py-2 text-left">Bleeding</th>
                  <th className="px-3 py-2 text-left">Furcation</th>
                </tr>
              </thead>
              <tbody>
                {periodontalToothRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-gray-500" colSpan="6">No periodontal tooth-level data yet. Add from odontogram tooth details.</td>
                  </tr>
                ) : (
                  periodontalToothRows.map((row) => (
                    <tr key={row.toothNumber} className="border-t">
                      <td className="px-3 py-2 font-medium">{row.toothNumber}</td>
                      <td className="px-3 py-2">{row.pocketDepth || '-'}</td>
                      <td className="px-3 py-2">{row.recession || '-'}</td>
                      <td className="px-3 py-2">{row.mobility || '-'}</td>
                      <td className="px-3 py-2">{row.bleeding ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">{row.furcation ? 'Yes' : 'No'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'orthodontic' && (
        <div className="p-6 space-y-6">
          <div className="flex justify-end">
            <button onClick={printOrthodonticSummary} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium flex items-center gap-2">
              <Printer className="h-4 w-4" /> Print Orthodontic Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Angle Class Left</label>
              <select value={orthodonticExam.angleClassLeft} onChange={(e) => setOrthodonticExam((p) => ({ ...p, angleClassLeft: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2 bg-white">
                <option value="">Select</option>
                <option value="CLASS_I">Class I</option>
                <option value="CLASS_II">Class II</option>
                <option value="CLASS_III">Class III</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Angle Class Right</label>
              <select value={orthodonticExam.angleClassRight} onChange={(e) => setOrthodonticExam((p) => ({ ...p, angleClassRight: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2 bg-white">
                <option value="">Select</option>
                <option value="CLASS_I">Class I</option>
                <option value="CLASS_II">Class II</option>
                <option value="CLASS_III">Class III</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Overjet (mm)</label>
              <input type="number" value={orthodonticExam.overjet} onChange={(e) => setOrthodonticExam((p) => ({ ...p, overjet: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Overbite</label>
              <input value={orthodonticExam.overbite} onChange={(e) => setOrthodonticExam((p) => ({ ...p, overbite: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" placeholder="e.g. 40%" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Crossbite</label>
              <input value={orthodonticExam.crossbite} onChange={(e) => setOrthodonticExam((p) => ({ ...p, crossbite: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" placeholder="None / anterior / posterior" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Crowding Upper</label>
              <input value={orthodonticExam.crowdingUpper} onChange={(e) => setOrthodonticExam((p) => ({ ...p, crowdingUpper: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Crowding Lower</label>
              <input value={orthodonticExam.crowdingLower} onChange={(e) => setOrthodonticExam((p) => ({ ...p, crowdingLower: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Midline Shift</label>
              <input value={orthodonticExam.midlineShift} onChange={(e) => setOrthodonticExam((p) => ({ ...p, midlineShift: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Spacing Upper</label>
              <input value={orthodonticExam.spacingUpper} onChange={(e) => setOrthodonticExam((p) => ({ ...p, spacingUpper: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Spacing Lower</label>
              <input value={orthodonticExam.spacingLower} onChange={(e) => setOrthodonticExam((p) => ({ ...p, spacingLower: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" />
            </div>
            <div className="flex items-end gap-4">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={orthodonticExam.openBite} onChange={(e) => setOrthodonticExam((p) => ({ ...p, openBite: e.target.checked }))} />
                <span className="text-sm">Open bite</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={orthodonticExam.deepBite} onChange={(e) => setOrthodonticExam((p) => ({ ...p, deepBite: e.target.checked }))} />
                <span className="text-sm">Deep bite</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
              <textarea rows="4" value={orthodonticExam.notes} onChange={(e) => setOrthodonticExam((p) => ({ ...p, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recommendation</label>
              <textarea rows="4" value={orthodonticExam.recommendation} onChange={(e) => setOrthodonticExam((p) => ({ ...p, recommendation: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2" placeholder="Ortho referral / interceptive plan / follow-up" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Tooth Panel */}
      {showStatusModal && currentTooth && (
        <ToothQuickPanel
          toothNumber={currentTooth}
          initialData={toothChart[currentTooth] || {}}
          onSave={handleSaveToothPanel}
          onClose={() => setShowStatusModal(false)}
          visitId={visitId}
          patientId={patientId}
        />
      )}

      {/* General Dental Notes */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <h5 className="font-semibold mb-4 text-gray-800">General Oral Health Assessment</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Gum Condition</label>
            <select
              value={gumCondition}
              onChange={(e) => setGumCondition(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700"
            >
              <option value="">Select condition</option>
              <option value="healthy">Healthy</option>
              <option value="gingivitis">Gingivitis</option>
              <option value="periodontitis">Periodontitis</option>
              <option value="recession">Recession</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Oral Hygiene</label>
            <select
              value={oralHygiene}
              onChange={(e) => setOralHygiene(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700"
            >
              <option value="">Select hygiene level</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="4"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700 resize-none"
            placeholder="Add general dental notes and observations..."
          />
        </div>
      </div>
    </div>
  );
});

export default DentalChart;