import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Circle, Calendar, User, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const DentalChartDisplay = ({ patientId, visitId, showHistory = false }) => {
  const [dentalRecord, setDentalRecord] = useState(null);
  const [dentalHistory, setDentalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // FDI order with conventional dentist-view lower arch orientation
  const permanentUpper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const permanentLower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  const primaryUpper = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
  const primaryLower = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

  const toothConditions = {
    HEALTHY: { color: '#10B981', label: 'Healthy', bgColor: 'bg-green-100' },
    CARIES: { color: '#EF4444', label: 'Caries (Decay)', bgColor: 'bg-red-100' },
    FILLED: { color: '#3B82F6', label: 'Filled / Restored', bgColor: 'bg-blue-100' },
    ROOT_CANAL: { color: '#8B5CF6', label: 'Root Canal Therapy', bgColor: 'bg-purple-100' },
    CROWN: { color: '#EC4899', label: 'Crown / Bridge', bgColor: 'bg-pink-100' },
    FRACTURED: { color: '#F97316', label: 'Fractured', bgColor: 'bg-orange-100' },
    MISSING: { color: '#6B7280', label: 'Missing', bgColor: 'bg-gray-100' },
    IMPACTED: { color: '#F59E0B', label: 'Impacted', bgColor: 'bg-yellow-100' },
    EXTRACTED: { color: '#DC2626', label: 'Extracted', bgColor: 'bg-red-200' }
  };

  useEffect(() => {
    if (showHistory) {
      fetchDentalHistory();
    } else {
      fetchDentalRecord();
    }
  }, [patientId, visitId, showHistory]);

  const fetchDentalRecord = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/dental/records/${patientId}/${visitId}`);
      setDentalRecord(response.data.dentalRecord);
    } catch (error) {
      console.error('Error fetching dental record:', error);
      // Don't show error for 404 - just means no dental record exists
      if (error.response?.status !== 404) {
        console.error('Non-404 error fetching dental record:', error);
      }
      setDentalRecord(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDentalHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/dental/history/${patientId}`);
      setDentalHistory(response.data.dentalHistory);
      if (response.data.dentalHistory.length > 0) {
        setSelectedRecord(response.data.dentalHistory[0]);
      }
    } catch (error) {
      console.error('Error fetching dental history:', error);
      // Don't show error for 404 - just means no dental history exists
      if (error.response?.status !== 404) {
        console.error('Non-404 error fetching dental history:', error);
      }
      setDentalHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const renderTooth = (toothNumber, toothData = null) => {
    const data = toothData || (dentalRecord?.toothChart?.[toothNumber]) || {};
    const hasPain = dentalRecord?.painFlags?.[toothNumber];

    const hasDiagnosis = data.diagnosis?.length > 0;
    const hasRestoration = data.restoration?.length > 0;
    const hasTreatmentPlan = data.treatmentPlan?.length > 0;
    const isExtracted = data.completedTreatments?.some(t => t.treatment === 'Extraction' || t.treatment === 'Extraction completed');
    const hasPerio = data.periodontal?.pocketDepth >= 4 || data.periodontal?.bleeding;

    return (
      <div
        key={toothNumber}
        className={`relative w-8 h-8 rounded-lg border-2 flex items-center justify-center text-xs font-semibold cursor-pointer transition-all duration-200 hover:scale-110 ${isExtracted ? 'opacity-30 border-dashed' : 'shadow-sm'}`}
        style={{
          backgroundColor: hasRestoration ? '#EFF6FF' : '#FFFFFF',
          borderColor: hasDiagnosis ? '#EF4444' : (hasTreatmentPlan ? '#F97316' : '#E5E7EB'),
          borderStyle: isExtracted ? 'dashed' : 'solid'
        }}
        title={`Tooth ${toothNumber}${hasPain ? ` (Pain)` : ''}`}
      >
        <span className={`${hasDiagnosis ? 'text-red-700' : (hasRestoration ? 'text-blue-700' : 'text-gray-700')}`}>
          {toothNumber}
        </span>

        <div className="absolute inset-x-1 bottom-0.5 flex justify-center space-x-0.5">
          {hasRestoration && <div className="w-1 h-1 rounded-full bg-blue-500"></div>}
          {hasPerio && <div className="w-1 h-1 rounded-full bg-purple-500"></div>}
          {hasTreatmentPlan && <div className="w-1 h-1 rounded-full bg-orange-500"></div>}
        </div>

        {hasPain && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-[8px]">!</span>
          </div>
        )}
      </div>
    );
  };

  const renderDentalChart = (record) => {
    if (!record?.toothChart) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Circle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No dental chart data available</p>
        </div>
      );
    }

    const meta = record?.treatmentPlan || {};
    const chartType = meta.chartType || 'PERMANENT';
    const chartConfig = chartType === 'PRIMARY'
      ? { upper: primaryUpper, lower: primaryLower, label: 'Primary Dentition' }
      : { upper: permanentUpper, lower: permanentLower, label: chartType === 'MIXED' ? 'Mixed Dentition (Permanent shown)' : 'Permanent Dentition' };

    return (
      <div className="space-y-6">
        {/* Tooth Chart Grid */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Circle className="h-5 w-5 mr-2 text-blue-600" />
            Dental Chart
          </h4>
          <p className="text-xs text-gray-500 mb-3">{chartConfig.label} - lower arch shown in dentist-view orientation</p>

          {/* Upper Jaw */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Upper Jaw</h5>
            <div className="flex justify-center space-x-1">
              {chartConfig.upper.map(toothNumber =>
                renderTooth(toothNumber, record.toothChart?.[toothNumber])
              )}
            </div>
          </div>

          {/* Lower Jaw */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Lower Jaw</h5>
            <div className="flex justify-center space-x-1">
              {chartConfig.lower.map(toothNumber =>
                renderTooth(toothNumber, record.toothChart?.[toothNumber])
              )}
            </div>
          </div>

          {chartType === 'MIXED' && (
            <div className="mt-4 border-t pt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2 text-center">Primary Teeth (Mixed Dentition)</h5>
              <div className="space-y-2">
                <div className="flex justify-center space-x-1">
                  {primaryUpper.map((toothNumber) => renderTooth(toothNumber, record.toothChart?.[toothNumber]))}
                </div>
                <div className="flex justify-center space-x-1">
                  {primaryLower.map((toothNumber) => renderTooth(toothNumber, record.toothChart?.[toothNumber]))}
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-3 items-center justify-center">
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-white border border-gray-200">
              <div className="w-4 h-4 rounded border-2 border-red-500 bg-white"></div>
              <span className="text-xs text-gray-700">Diagnosis</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-[#EFF6FF] border border-blue-200">
              <div className="w-4 h-4 rounded border-2 border-gray-200 bg-[#EFF6FF] flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              </div>
              <span className="text-xs text-gray-700">Restoration</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-white border border-gray-200">
              <div className="w-4 h-4 rounded border-2 border-orange-500 bg-white flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
              </div>
              <span className="text-xs text-gray-700">Planned</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md border border-gray-200 opacity-50 border-dashed">
              <span className="text-xs text-gray-700">Extracted/Missing</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-white border border-gray-200">
              <div className="w-2.5 h-2.5 bg-purple-500 rounded-full"></div>
              <span className="text-xs text-gray-700">Perio</span>
            </div>
          </div>
        </div>

        {/* Individual Tooth Details (New) */}
        {record.toothChart && Object.keys(record.toothChart).length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 overscroll-none">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Individual Tooth Details
            </h4>
            <div className="space-y-4">
              {Object.entries(record.toothChart)
                .filter(([_, data]) =>
                  (data.diagnosis?.length > 0) ||
                  (data.restoration?.length > 0) ||
                  (data.treatmentPlan?.length > 0) ||
                  (data.completedTreatments?.length > 0) ||
                  (data.periodontal && Object.keys(data.periodontal).some(k => data.periodontal[k])) ||
                  (data.generalNotes?.length > 0) ||
                  data.notes
                )
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([toothNumber, data]) => (
                  <div key={toothNumber} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <h5 className="font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Tooth {toothNumber}</h5>

                    <div className="grid grid-cols-1 gap-y-6 md:gap-x-8">
                      {data.diagnosis?.length > 0 && (
                        <div className="bg-red-50/50 p-4 rounded-lg border border-red-100">
                          <span className="text-sm font-bold text-red-700 uppercase tracking-widest block mb-2">Diagnosis</span>
                          <p className="text-base font-medium text-gray-900">{data.diagnosis.join(', ')}</p>
                          {data.diagnosisNotes && <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded border border-gray-200">{data.diagnosisNotes}</p>}
                          {data.mobilityDiagnosis && <p className="text-sm font-medium text-red-600 mt-2 flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> Mobility: {data.mobilityDiagnosis}</p>}
                        </div>
                      )}

                      {data.restoration?.length > 0 && (
                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                          <span className="text-sm font-bold text-blue-700 uppercase tracking-widest block mb-2">Restoration (Existing)</span>
                          <p className="text-base font-medium text-gray-900">{data.restoration.join(', ')}</p>
                          {data.restorationNotes && <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded border border-gray-200">{data.restorationNotes}</p>}
                        </div>
                      )}

                      {data.treatmentPlan?.length > 0 && (
                        <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100">
                          <span className="text-sm font-bold text-orange-700 uppercase tracking-widest block mb-2">Treatment Plan</span>
                          <p className="text-base font-medium text-gray-900">{data.treatmentPlan.join(', ')}</p>
                          {data.treatmentPlanNotes && <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded border border-gray-200">{data.treatmentPlanNotes}</p>}
                        </div>
                      )}

                      {data.periodontal && (data.periodontal.pocketDepth || data.periodontal.bleeding || data.periodontal.recession) && (
                        <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                          <span className="text-sm font-bold text-purple-700 uppercase tracking-widest block mb-2">Periodontal</span>
                          <div className="text-base text-gray-900 flex flex-wrap gap-2 mb-2">
                            {data.periodontal.pocketDepth && <span className="bg-purple-200 text-purple-900 px-3 py-1 rounded-md font-medium">Depth: {data.periodontal.pocketDepth}mm</span>}
                            {data.periodontal.recession && <span className="bg-purple-200 text-purple-900 px-3 py-1 rounded-md font-medium">Recession: {data.periodontal.recession}mm</span>}
                            {data.periodontal.bleeding && <span className="bg-red-200 text-red-900 px-3 py-1 rounded-md font-medium">Bleeding</span>}
                            {data.periodontal.mobility && <span className="bg-purple-200 text-purple-900 px-3 py-1 rounded-md font-medium">Mobility: {data.periodontal.mobility}</span>}
                            {data.periodontal.furcation && <span className="bg-red-200 text-red-900 px-3 py-1 rounded-md font-medium">Furcation</span>}
                          </div>
                          {data.periodontal.notes && <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded border border-gray-200">{data.periodontal.notes}</p>}
                        </div>
                      )}

                      {data.completedTreatments?.length > 0 && (
                        <div className="p-4 rounded-lg border border-green-100 bg-green-50/50 md:col-span-2">
                          <span className="text-sm font-bold text-green-700 uppercase tracking-widest block mb-3">Completed Treatments</span>
                          <div className="space-y-2">
                            {data.completedTreatments.map((tr, i) => (
                              <div key={i} className="text-base text-gray-900 bg-white p-3 rounded border border-gray-200 flex flex-col md:flex-row md:items-center justify-between">
                                <span className="font-semibold flex items-center"><CheckCircle className="w-5 h-5 text-green-500 mr-2" /> {tr.treatment}</span>
                                <span className="text-gray-500 text-sm mt-1 md:mt-0 ml-7 md:ml-0 flex items-center"><Clock className="w-4 h-4 mr-1" /> {tr.date}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {data.generalNotes?.length > 0 && (
                        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 md:col-span-2">
                          <span className="text-sm font-bold text-gray-700 uppercase tracking-widest block mb-3">Clinical Notes</span>
                          <div className="space-y-3">
                            {data.generalNotes.map((note, i) => (
                              <div key={i} className="text-base text-gray-800 bg-white p-4 shadow-sm border border-gray-200 rounded-lg">
                                <p className="whitespace-pre-wrap">{note.text}</p>
                                <div className="text-sm text-gray-500 mt-3 pt-2 border-t border-gray-100 flex items-center">
                                  <Clock className="w-4 h-4 mr-1" /> {new Date(note.date).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Legacy note support */}
                      {data.notes && !data.generalNotes?.length && (
                        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 md:col-span-2">
                          <span className="text-sm font-bold text-gray-700 uppercase tracking-widest block mb-2">Notes</span>
                          <p className="text-base font-medium text-gray-800 bg-white p-3 rounded border border-gray-200">{data.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

              {Object.values(record.toothChart).filter(data =>
                (data.diagnosis?.length > 0) ||
                (data.restoration?.length > 0) ||
                (data.treatmentPlan?.length > 0) ||
                (data.completedTreatments?.length > 0) ||
                (data.periodontal && Object.keys(data.periodontal).some(k => data.periodontal[k])) ||
                (data.generalNotes?.length > 0) ||
                data.notes
              ).length === 0 && (
                  <p className="text-gray-500 italic">No specific tooth details recorded.</p>
                )}
            </div>
          </div>
        )}

        {/* Additional Information */}
        {(record.gumCondition || record.oralHygiene || record.notes) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Additional Information
            </h4>

            <div className="space-y-4">
              {record.gumCondition && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Gum Condition</h5>
                  <p className="text-gray-900">{record.gumCondition}</p>
                </div>
              )}

              {record.oralHygiene && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Oral Hygiene</h5>
                  <p className="text-gray-900">{record.oralHygiene}</p>
                </div>
              )}

              {record.notes && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Notes</h5>
                  <p className="text-gray-900">{record.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {(record.treatmentPlan?.periodontalChart || record.treatmentPlan?.orthodonticExam) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h4 className="text-lg font-semibold text-gray-900">Extended Dental Assessment</h4>

            {record.treatmentPlan?.periodontalChart && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Periodontal Summary</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="p-3 rounded bg-purple-50 border border-purple-100">Plaque Score: {record.treatmentPlan.periodontalChart.plaqueScore || '-'}</div>
                  <div className="p-3 rounded bg-purple-50 border border-purple-100">Bleeding Score: {record.treatmentPlan.periodontalChart.bleedingScore || '-'}</div>
                  <div className="p-3 rounded bg-purple-50 border border-purple-100">Risk: {record.treatmentPlan.periodontalChart.overallRisk || '-'}</div>
                </div>
                {record.treatmentPlan.periodontalChart.notes && (
                  <p className="mt-2 text-sm text-gray-700">{record.treatmentPlan.periodontalChart.notes}</p>
                )}
              </div>
            )}

            {record.treatmentPlan?.orthodonticExam && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Orthodontic Exam</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded bg-blue-50 border border-blue-100">Angle L/R: {record.treatmentPlan.orthodonticExam.angleClassLeft || '-'} / {record.treatmentPlan.orthodonticExam.angleClassRight || '-'}</div>
                  <div className="p-3 rounded bg-blue-50 border border-blue-100">Overjet / Overbite: {record.treatmentPlan.orthodonticExam.overjet || '-'} / {record.treatmentPlan.orthodonticExam.overbite || '-'}</div>
                  <div className="p-3 rounded bg-blue-50 border border-blue-100">Crossbite: {record.treatmentPlan.orthodonticExam.crossbite || '-'}</div>
                  <div className="p-3 rounded bg-blue-50 border border-blue-100">Midline Shift: {record.treatmentPlan.orthodonticExam.midlineShift || '-'}</div>
                </div>
                {record.treatmentPlan.orthodonticExam.recommendation && (
                  <p className="mt-2 text-sm text-gray-700"><span className="font-medium">Recommendation:</span> {record.treatmentPlan.orthodonticExam.recommendation}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pain Flags */}
        {record.painFlags && Object.keys(record.painFlags).length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
              Pain Indicators
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(record.painFlags).map(([toothNumber, pain]) => (
                <div key={toothNumber} className="bg-red-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">Tooth {toothNumber}</span>
                    <span className="text-red-600 font-semibold">{pain.level}/10</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{pain.type}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showHistory) {
    if (dentalHistory.length === 0) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 text-center">
            <Circle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No dental history available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Circle className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Dental History</h3>
                <p className="text-sm text-gray-600">
                  {dentalHistory.length} record{dentalHistory.length > 1 ? 's' : ''} found
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* History Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Visit Record
            </label>
            <select
              value={selectedRecord?.id || ''}
              onChange={(e) => {
                const record = dentalHistory.find(r => r.id === parseInt(e.target.value));
                setSelectedRecord(record);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {dentalHistory.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.visit?.visitUid || 'Unknown Visit'} - {new Date(record.createdAt).toLocaleDateString()}
                  {record.doctor?.fullname && ` (Dr. ${record.doctor.fullname})`}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Record Details */}
          {selectedRecord && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(selectedRecord.createdAt).toLocaleDateString()}</span>
                  </div>
                  {selectedRecord.doctor?.fullname && (
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>Dr. {selectedRecord.doctor.fullname}</span>
                    </div>
                  )}
                  {selectedRecord.visit?.visitUid && (
                    <div className="flex items-center space-x-1">
                      <FileText className="h-4 w-4" />
                      <span>{selectedRecord.visit.visitUid}</span>
                    </div>
                  )}
                </div>
              </div>

              {renderDentalChart(selectedRecord)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Single record display (for results queue)
  if (!dentalRecord) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 text-center">
          <Circle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No dental chart available for this visit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Circle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Dental Chart</h3>
              <p className="text-sm text-gray-600">
                {dentalRecord.doctor?.fullname && `Examined by Dr. ${dentalRecord.doctor.fullname}`}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <Circle className="h-4 w-4 mr-1" />
            Completed
          </span>
        </div>
      </div>

      <div className="p-6">
        {renderDentalChart(dentalRecord)}
      </div>
    </div>
  );
};

export default DentalChartDisplay;
