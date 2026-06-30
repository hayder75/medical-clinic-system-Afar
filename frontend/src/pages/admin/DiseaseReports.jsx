import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Download, Printer, Filter, ChevronLeft, Table, FileText, Edit2, Save } from 'lucide-react';
import api from '../../services/api';
import Layout from '../../components/common/Layout';
import toast from 'react-hot-toast';

const DiseaseReports = ({ forceSelectedMode = false }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'detailed'
    const [reportType, setReportType] = useState('WEEKLY'); // WEEKLY or MONTHLY
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [detailedData, setDetailedData] = useState([]);
    const [reportScope, setReportScope] = useState(forceSelectedMode ? 'SELECTED' : 'ALL'); // ALL or SELECTED
    const [selectedDiseases, setSelectedDiseases] = useState([]);
    const [diseaseSearch, setDiseaseSearch] = useState('');

    // Edit mode for manual entry
    const [isEditing, setIsEditing] = useState(false);

    // State for manual adjustments (Section 1 & 3)
    const [manualAdjustments, setManualAdjustments] = useState({});

    // State for Section 2 (Timelines)
    const [timelineData, setTimelineData] = useState({
        expectedWeekly: 1,
        actualWeekly: 1
    });

    // State for Footer information
    const [footerData, setFooterData] = useState({
        comments: '',
        dateSent: new Date().toLocaleDateString(),
        sentBy: '',
        sentTele: '0911934556',
        sentEmail: '',
        dateReceived: '',
        receivedBy: '',
        receivedTele: '',
        receivedEmail: ''
    });

    // Definition of Immediately Reportable Diseases (Fixed List)
    const immediatelyReportableList = [
        'AFP/Polio', 'Measles', 'SARS', 'Anthrax', 'Neonatal Tetanus', 'Smallpox',
        'Cholera', 'Pandemic Influenza', 'Viral Hemorrhagic Fever', 'Dracunculiasis (Guinea Worm)',
        'Rabies', 'Yellow Fever', 'Maternal Death'
    ];

    const allDiseaseOptions = useMemo(() => {
        const names = new Set();
        reportData.forEach((item) => item?.name && names.add(item.name));
        detailedData.forEach((item) => item?.disease && names.add(item.disease));
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [reportData, detailedData]);

    const filteredDiseaseOptions = useMemo(() => {
        const q = diseaseSearch.trim().toLowerCase();
        if (!q) return allDiseaseOptions.slice(0, 40);
        return allDiseaseOptions.filter((name) => name.toLowerCase().includes(q)).slice(0, 40);
    }, [allDiseaseOptions, diseaseSearch]);

    const isDiseaseSelected = (name) =>
        selectedDiseases.some((item) => item.toLowerCase() === String(name).toLowerCase());

    const toggleDiseaseSelection = (name) => {
        setSelectedDiseases((prev) => {
            if (prev.some((item) => item.toLowerCase() === name.toLowerCase())) {
                return prev.filter((item) => item.toLowerCase() !== name.toLowerCase());
            }
            return [...prev, name];
        });
    };

    const clearDiseaseSelection = () => {
        setSelectedDiseases([]);
        setDiseaseSearch('');
    };

    const diseaseMatchesSelection = (name) => {
        if (reportScope !== 'SELECTED') return true;
        if (selectedDiseases.length === 0) return false;
        return isDiseaseSelected(name);
    };

    useEffect(() => {
        if (activeTab === 'summary') {
            fetchReport();
        } else {
            fetchDetailedReport();
        }
    }, [startDate, endDate, activeTab]);

    useEffect(() => {
        if (forceSelectedMode) {
            setReportScope('SELECTED');
        } else {
            setReportScope('ALL');
            setSelectedDiseases([]);
            setDiseaseSearch('');
        }
    }, [forceSelectedMode]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const response = await api.get('/diseases/reports', {
                params: { startDate, endDate, type: reportType, detail: 'summary' }
            });
            setReportData(response.data);
        } catch (error) {
            console.error('Error fetching report:', error);
            toast.error('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const fetchDetailedReport = async () => {
        try {
            setLoading(true);
            const response = await api.get('/diseases/reports', {
                params: { startDate, endDate, type: reportType, detail: 'detailed' }
            });
            setDetailedData(response.data);
        } catch (error) {
            console.error('Error fetching detailed report:', error);
            toast.error('Failed to generate detailed list');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Generic handler for manual adjustments in Section 1 and Section 3
    const handleManualChange = (id, field, value) => {
        setManualAdjustments(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: parseInt(value) || 0
            }
        }));
    };

    // Helper to get effective value (API + Manual Adjustment)
    const getEffectiveValue = (item, field, isImmediate = false) => {
        // For immediate diseases that might be synthetic (not from DB), we use ID
        const id = item.id;

        if (manualAdjustments[id] && manualAdjustments[id][field] !== undefined) {
            return manualAdjustments[id][field];
        }

        // For Section 3 combined cases
        if (isImmediate && field === 'totalCases') {
            return (item.outPatientCases || 0) + (item.inPatientCases || 0);
        }

        return item[field] || 0;
    };


    // Filter aggregated data
    // Section 1: Weekly Reportable / Common (Everything NOT in immediate list)
    const weeklyDiseases = reportData.filter(d =>
        !d.reportFrequency || d.reportFrequency === 'WEEKLY' || d.reportFrequency === 'NONE'
    ).filter((d) => diseaseMatchesSelection(d.name));

    const filteredDetailedData = detailedData.filter((item) => diseaseMatchesSelection(item.disease));

    // Section 3: Immediately Reportable (Match against fixed list + any extra marked immediate)
    // We map the fixed list to data objects, filling with 0s if not found
    const immediateDiseasesDisplay = reportScope === 'SELECTED'
        ? reportData.filter((d) => {
            const isImmediate = d.reportFrequency === 'IMMEDIATE' ||
                immediatelyReportableList.some((name) => d.name.toLowerCase().includes(name.toLowerCase()));
            return isImmediate && diseaseMatchesSelection(d.name);
        })
        : immediatelyReportableList.map(name => {
            const found = reportData.find(d =>
                d.name.toLowerCase().includes(name.toLowerCase()) ||
                (name === 'Viral Hemorrhagic Fever' && d.name.toLowerCase().includes('hemorrhagic'))
            );

            if (found) return found;

            return {
                id: `temp-${name}`,
                name: name,
                outPatientCases: 0,
                inPatientCases: 0,
                deaths: 0,
                isTemp: true
            };
        });

    const extraImmediate = reportScope === 'SELECTED'
        ? []
        : reportData.filter(d =>
            d.reportFrequency === 'IMMEDIATE' &&
            !immediatelyReportableList.some(name => d.name.toLowerCase().includes(name.toLowerCase()))
        );

    const finalImmediateList = [...immediateDiseasesDisplay, ...extraImmediate];

    return (
        <Layout
            title={forceSelectedMode ? 'Selected Disease Report' : 'Disease Reporting'}
            subtitle={forceSelectedMode ? 'Filtered disease report with selection and print' : 'WHO-Aligned Weekly & Monthly Reports'}
        >
            <style type="text/css">
                {`
                @media print {
                    @page { 
                        size: A4; 
                        margin: 0mm !important; 
                    }
                    body { 
                        background-color: white !important; 
                        font-family: "Times New Roman", serif;
                        font-size: 10pt;
                        color: black !important;
                        padding: 10mm 10mm 10mm 10mm !important;
                    }
                    /* HIDE EVERYTHING ELSE */
                    nav, header, aside, .sidebar, .no-print { display: none !important; }
                    /* Make sure the main layout container doesn't restrict us */
                    #root, main, .layout-container { 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    /* HIDE SCREEN CONTENT */
                    .screen-content { display: none !important; }
                    
                    /* SHOW PRINT CONTENT */
                    #print-container {
                        display: block !important;
                        position: relative !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                    }

                    .print-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 5px;
                    }
                    .print-table th, .print-table td {
                        border: 1px solid black;
                        padding: 2px 4px;
                        font-size: 9pt;
                        text-align: center;
                    }
                    .print-table th {
                        background-color: #f0f0f0 !important;
                        -webkit-print-color-adjust: exact;
                        font-weight: bold;
                    }
                    .print-table td.left {
                        text-align: left;
                    }
                    .section-title {
                        font-size: 10pt;
                        font-weight: bold;
                        margin-top: 8px;
                        margin-bottom: 2px;
                        text-transform: uppercase;
                        border-bottom: 1px solid black;
                        display: inline-block;
                    }
                    .header-box {
                        border: 1px solid black;
                        padding: 4px;
                        margin-bottom: 10px;
                        display: flex;
                        justify-content: space-between;
                        font-size: 10pt;
                    }
                }
                /* Screen styles for print container */
                @media screen {
                    #print-container {
                        display: none;
                    }
                }
                `}
            </style>

            <div className="space-y-6 screen-content">
                {/* Controls */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 no-print">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setActiveTab('summary')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'summary' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600'}`}>Summary Form</button>
                                <button onClick={() => setActiveTab('detailed')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'detailed' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600'}`}>Detailed Line List</button>
                                <button
                                    onClick={() => navigate(forceSelectedMode ? '/admin/disease-reports' : '/admin/selected-disease-report')}
                                    className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 hover:bg-white"
                                >
                                    {forceSelectedMode ? 'Main Report' : 'Selected Report'}
                                </button>
                            </div>
                            <div className="h-6 w-px bg-gray-300 mx-2"></div>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm" />
                            <span className="text-gray-500">to</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                            {activeTab === 'summary' && (
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${isEditing ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700'}`}
                                >
                                    {isEditing ? <Save className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                                    {isEditing ? 'Done Editing' : 'Edit Mode'}
                                </button>
                            )}
                            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                <Printer className="h-4 w-4" />
                                Print Report
                            </button>
                            <button 
                                onClick={() => window.location.href = '/admin/age-gender-disease-distribution'}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                            >
                                Age-Gender Distribution
                            </button>
                        </div>
                    </div>
                    {isEditing && (
                        <div className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                            Note: You are in Edit Mode. Changes made here apply to the generated print report but are temporary and not saved to the database.
                        </div>
                    )}

                    {forceSelectedMode && (
                        <div className="mt-3 border border-blue-200 bg-blue-50 rounded-lg p-3">
                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                                <div className="flex-1">
                                    <label className="text-sm font-medium text-blue-900">Select diseases to include</label>
                                    <input
                                        type="text"
                                        value={diseaseSearch}
                                        onChange={(e) => setDiseaseSearch(e.target.value)}
                                        placeholder="Search disease, then click to add"
                                        className="mt-1 w-full border border-blue-200 rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                                <button
                                    onClick={clearDiseaseSelection}
                                    className="px-3 py-2 text-sm rounded-md border border-blue-200 text-blue-800 hover:bg-blue-100"
                                >
                                    Clear Selection
                                </button>
                            </div>

                            <div className="mt-2 max-h-40 overflow-auto border border-blue-100 rounded-md bg-white">
                                {filteredDiseaseOptions.length === 0 ? (
                                    <div className="p-2 text-sm text-gray-500">No matching diseases</div>
                                ) : (
                                    filteredDiseaseOptions.map((name) => (
                                        <button
                                            key={name}
                                            onClick={() => toggleDiseaseSelection(name)}
                                            className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${isDiseaseSelected(name) ? 'bg-blue-100 text-blue-900 font-medium' : 'hover:bg-gray-50'}`}
                                        >
                                            {isDiseaseSelected(name) ? '✓ ' : ''}{name}
                                        </button>
                                    ))
                                )}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                                {selectedDiseases.length === 0 ? (
                                    <span className="text-xs text-gray-500">No disease selected yet</span>
                                ) : selectedDiseases.map((name) => (
                                    <span key={name} className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs bg-blue-600 text-white">
                                        {name}
                                        <button onClick={() => toggleDiseaseSelection(name)} className="font-bold leading-none">x</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* NORMAL SCREEN VIEW (With Inputs) */}
                <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                    {/* Header */}
                    <div className="mb-6 border-b-2 border-black pb-4">
                        <h1 className="text-2xl font-bold text-center uppercase mb-2">
                            {reportType === 'WEEKLY' ? 'Weekly' : 'Monthly'} Disease
                            {activeTab === 'summary' ? ' Report Form' : ' Detailed Line List'}
                        </h1>
                        <div className="grid grid-cols-2 gap-4 border border-black text-sm">
                            <div className="p-2 border-r border-black">
                                <div className="font-bold">Health Facility: {window.__CS__?.name || 'Clinic'}</div>
                                <div>Type: Private Clinic</div>
                                <div>Zone: Awash 7 Kilo</div>
                            </div>
                            <div className="p-2">
                                <div className="font-bold">Woreda: Awash 7 Kilo</div>
                                <div>Region: Addis Ababa</div>
                            </div>
                            <div className="col-span-2 border-t border-black p-2 flex justify-between">
                                <span>Report Period: </span>
                                <span>From: <b>{startDate}</b></span>
                                <span>To: <b>{endDate}</b></span>
                            </div>
                        </div>
                    </div>

                    {activeTab === 'summary' ? (
                        <>
                            {/* Section 1 */}
                            <div className="mb-6">
                                <h2 className="text-sm font-bold mb-2">1. Cases and Deaths for Reportable Diseases</h2>
                                <table className="w-full border-collapse border border-black text-sm">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-black p-2 text-left" rowSpan="2">Disease / Condition</th>
                                            <th className="border border-black p-2 text-center w-24">Outpatient</th>
                                            <th className="border border-black p-2 text-center" colSpan="2">Inpatient</th>
                                        </tr>
                                        <tr className="bg-gray-100">
                                            <th className="border border-black p-2 text-center font-normal">Cases</th>
                                            <th className="border border-black p-2 text-center font-normal">Cases</th>
                                            <th className="border border-black p-2 text-center font-normal">Deaths</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weeklyDiseases.map((disease) => (
                                            <tr key={disease.id}>
                                                <td className="border border-black p-2">{disease.name}</td>
                                                <td className="border border-black p-2 text-center font-mono">{disease.outPatientCases}</td>
                                                <td className="border border-black p-2 text-center font-mono bg-gray-50">
                                                    {isEditing ? (
                                                        <input type="number" className="w-16 p-1 text-center border rounded"
                                                            value={getEffectiveValue(disease, 'inPatientCases')}
                                                            onChange={(e) => handleManualChange(disease.id, 'inPatientCases', e.target.value)} />
                                                    ) : getEffectiveValue(disease, 'inPatientCases')}
                                                </td>
                                                <td className="border border-black p-2 text-center font-mono bg-gray-50">
                                                    {isEditing ? (
                                                        <input type="number" className="w-16 p-1 text-center border rounded"
                                                            value={getEffectiveValue(disease, 'deaths')}
                                                            onChange={(e) => handleManualChange(disease.id, 'deaths', e.target.value)} />
                                                    ) : getEffectiveValue(disease, 'deaths')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Section 2 (Editable) */}
                            <div className="mb-6">
                                <h2 className="text-sm font-bold mb-2">2. Report time lines and completeness</h2>
                                <span className="text-xs italic">(To be filled only by Woreda Health Office and Zone /Regional Health Bureaus)</span>

                                <table className="w-full border-collapse border border-black text-sm mt-2">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-black p-2 text-left">Indicator</th>
                                            <th className="border border-black p-2 text-center w-24">Private Facility</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border border-black p-2">Number of sites that Supposed to report Weekly</td>
                                            <td className="border border-black p-2 text-center bg-gray-50">
                                                {isEditing ? (
                                                    <input type="number" className="w-16 p-1 text-center border rounded"
                                                        value={timelineData.expectedWeekly}
                                                        onChange={(e) => setTimelineData({ ...timelineData, expectedWeekly: e.target.value })} />
                                                ) : timelineData.expectedWeekly}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-2">Number of sites that report on time</td>
                                            <td className="border border-black p-2 text-center bg-gray-50">
                                                {isEditing ? (
                                                    <input type="number" className="w-16 p-1 text-center border rounded"
                                                        value={timelineData.actualWeekly}
                                                        onChange={(e) => setTimelineData({ ...timelineData, actualWeekly: e.target.value })} />
                                                ) : timelineData.actualWeekly}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section 3 (Editable) */}
                            <div className="mb-6">
                                <h2 className="text-sm font-bold mb-2">3. Immediately Reportable Diseases</h2>
                                <div className="grid grid-cols-3 gap-2">
                                    {[0, 1, 2].map(i => (
                                        <table key={i} className="w-full border-collapse border border-black text-sm h-min">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="border border-black p-1 text-left">Disease</th>
                                                    <th className="border border-black p-1 w-10 text-center">C</th>
                                                    <th className="border border-black p-1 w-10 text-center">D</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {mediaSplit3(finalImmediateList, i).map(d => (
                                                    <tr key={d.id}>
                                                        <td className="border border-black p-1 truncate text-xs">{d.name}</td>
                                                        <td className="border border-black p-1 text-center bg-gray-50">
                                                            {isEditing ? (
                                                                <input type="number" className="w-10 p-0.5 text-center border rounded text-xs"
                                                                    value={getEffectiveValue(d, 'totalCases', true)}
                                                                    onChange={(e) => handleManualChange(d.id, 'totalCases', e.target.value)} />
                                                            ) : getEffectiveValue(d, 'totalCases', true)}
                                                        </td>
                                                        <td className="border border-black p-1 text-center bg-gray-50">
                                                            {isEditing ? (
                                                                <input type="number" className="w-10 p-0.5 text-center border rounded text-xs"
                                                                    value={getEffectiveValue(d, 'deaths')}
                                                                    onChange={(e) => handleManualChange(d.id, 'deaths', e.target.value)} />
                                                            ) : getEffectiveValue(d, 'deaths')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ))}
                                </div>
                            </div>

                            {/* Section 4 Footer (Editable) */}
                            <div className="mt-8 border-t pt-4 bg-gray-50 p-4 rounded border">
                                <h3 className="font-bold mb-4">Report Footer & Comments (Editable)</h3>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Action taken and Recommendation:</label>
                                    <textarea
                                        className="w-full border p-2 rounded h-20 text-sm"
                                        value={footerData.comments}
                                        onChange={(e) => setFooterData({ ...footerData, comments: e.target.value })}
                                        placeholder="Enter recommendations here..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6 text-sm">
                                    <div className="space-y-2">
                                        <h4 className="font-bold border-b pb-1">Sent By</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="w-24">Date Sent:</span>
                                            <input type="text" className="border p-1 rounded flex-1" value={footerData.dateSent} onChange={e => setFooterData({ ...footerData, dateSent: e.target.value })} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-24">Sent By:</span>
                                            <input type="text" className="border p-1 rounded flex-1" value={footerData.sentBy} onChange={e => setFooterData({ ...footerData, sentBy: e.target.value })} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-24">Tele:</span>
                                            <input type="text" className="border p-1 rounded flex-1" value={footerData.sentTele} onChange={e => setFooterData({ ...footerData, sentTele: e.target.value })} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-24">E-mail:</span>
                                            <input type="text" className="border p-1 rounded flex-1" value={footerData.sentEmail} onChange={e => setFooterData({ ...footerData, sentEmail: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-bold border-b pb-1">Received By</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="w-24">Date Rcvd:</span>
                                            <input type="text" className="border p-1 rounded flex-1" value={footerData.dateReceived} onChange={e => setFooterData({ ...footerData, dateReceived: e.target.value })} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-24">Received By:</span>
                                            <input type="text" className="border p-1 rounded flex-1" value={footerData.receivedBy} onChange={e => setFooterData({ ...footerData, receivedBy: e.target.value })} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-24">Tele:</span>
                                            <input type="text" className="border p-1 rounded flex-1" value={footerData.receivedTele} onChange={e => setFooterData({ ...footerData, receivedTele: e.target.value })} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-24">E-mail:</span>
                                            <input type="text" className="border p-1 rounded flex-1" value={footerData.receivedEmail} onChange={e => setFooterData({ ...footerData, receivedEmail: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="mb-8">
                            <table className="w-full border-collapse border border-black text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border border-black p-2 text-left">Date</th>
                                        <th className="border border-black p-2 text-left">Patient Name</th>
                                        <th className="border border-black p-2">Disease</th>
                                        <th className="border border-black p-2">Outcome</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDetailedData.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="border border-black p-2">{new Date(item.date).toLocaleDateString()}</td>
                                            <td className="border border-black p-2">{item.patientName}</td>
                                            <td className="border border-black p-2">{item.disease}</td>
                                            <td className="border border-black p-2">{item.outcome}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* DEDICATED PRINT LAYOUT - Only visible with @media print */}
            <div id="print-container">
                {activeTab === 'summary' ? (
                    <div className="w-full">
                        {/* Header */}
                        <div className="text-center mb-2">
                            <h1 className="font-bold text-lg uppercase" style={{ margin: 0 }}>
                                {reportScope === 'SELECTED'
                                    ? `SELECTED DISEASES REPORT (${selectedDiseases.length})`
                                    : `${reportType === 'WEEKLY' ? 'WEEKLY' : 'MONTHLY'} DISEASE REPORT FORM`}
                            </h1>
                        </div>

                        {reportScope === 'SELECTED' && (
                            <div style={{ fontSize: '9pt', marginBottom: '6px' }}>
                                <strong>Included Diseases:</strong> {selectedDiseases.length > 0 ? selectedDiseases.join(', ') : 'None selected'}
                            </div>
                        )}

                        <div className="header-box">
                            <div className="w-1/2 pr-2 border-r border-black">
                                <div><strong>Health Facility:</strong> ${window.__CS__?.name || 'Clinic'}</div>
                                <div><strong>Type:</strong> Private Clinic&nbsp;&nbsp;&nbsp;&nbsp;<strong>Location:</strong> Awash 7 Kilo</div>
                                <div><strong>Region:</strong> Addis Ababa</div>
                            </div>
                            <div className="w-1/2 pl-2">
                                <div><strong>Woreda:</strong> Awash 7 Kilo</div>
                                <div><strong>Report Period From:</strong> {startDate} <strong>To:</strong> {endDate}</div>
                                <div><strong>Date Sent:</strong> {footerData.dateSent}</div>
                            </div>
                        </div>

                        {/* Section 1 */}
                        <div className="section-title">1. CASES AND DEATHS FOR REPORTABLE DISEASES</div>
                        <table className="print-table">
                            <thead>
                                <tr>
                                    <th className="left" style={{ width: '40%' }}>Disease / Condition</th>
                                    <th style={{ width: '20%' }}>Outpatient Cases</th>
                                    <th style={{ width: '20%' }}>Inpatient Cases</th>
                                    <th style={{ width: '20%' }}>Deaths</th>
                                </tr>
                            </thead>
                            <tbody>
                                {weeklyDiseases.map(d => (
                                    <tr key={d.id}>
                                        <td className="left">{d.name}</td>
                                        <td>{d.outPatientCases}</td>
                                        <td>{getEffectiveValue(d, 'inPatientCases')}</td>
                                        <td>{getEffectiveValue(d, 'deaths')}</td>
                                    </tr>
                                ))}
                                {weeklyDiseases.length === 0 && <tr><td colSpan="4" className="text-center py-4">No reportable diseases this period</td></tr>}
                            </tbody>
                        </table>

                        {/* Section 2 */}
                        <div className="section-title">2. REPORT TIMELINES AND COMPLETENESS</div>
                        <div style={{ fontSize: '8pt', marginBottom: '4px' }}>(To be filled only by Woreda Health Office and Zone /Regional Health Bureaus)</div>
                        <table className="print-table">
                            <thead>
                                <tr>
                                    <th className="left">Indicator</th>
                                    <th>Gov</th>
                                    <th>NGO</th>
                                    <th>Private</th>
                                    <th>Other</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="left">Number of sites that Supposed to report Weekly</td>
                                    <td></td>
                                    <td></td>
                                    <td>{timelineData.expectedWeekly}</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td className="left">Number of sites that report on time</td>
                                    <td></td>
                                    <td></td>
                                    <td>{timelineData.actualWeekly}</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Section 3 */}
                        <div className="section-title">3. SUMMARY FOR IMMEDIATELY REPORTABLE DISEASES</div>
                        <div style={{ fontSize: '8pt', marginBottom: '2px' }}>Total cases and death reported on cases based forms or line lists during reporting week</div>

                        <div style={{ display: 'flex', gap: '5px' }}>
                            {[0, 1, 2].map(colIndex => (
                                <table key={colIndex} className="print-table" style={{ flex: 1, marginBottom: 0 }}>
                                    <thead>
                                        <tr>
                                            <th className="left">Disease</th>
                                            <th style={{ width: '15%' }}>C</th>
                                            <th style={{ width: '15%' }}>D</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mediaSplit3(finalImmediateList, colIndex).map(d => (
                                            <tr key={d.id}>
                                                <td className="left" style={{ fontSize: '8pt' }}>{d.name}</td>
                                                <td>{getEffectiveValue(d, 'totalCases', true)}</td>
                                                <td>{getEffectiveValue(d, 'deaths')}</td>
                                            </tr>
                                        ))}
                                        {colIndex === 2 && (
                                            <>
                                                <tr><td className="left" style={{ fontSize: '8pt' }}>Other: __________</td><td></td><td></td></tr>
                                                <tr><td className="left" style={{ fontSize: '8pt' }}>Other: __________</td><td></td><td></td></tr>
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            ))}
                        </div>
                        <div style={{ fontSize: '8pt', marginTop: '2px', marginBottom: '10px' }}>C = Cases, D = Deaths. Official notification of immediately notified cases comes only from case forms or line lists.</div>

                        {/* Footer Comments */}
                        <div className="section-title">COMMENTS & RECOMMENDATIONS</div>
                        <div style={{ fontStyle: 'italic', fontSize: '9pt', marginBottom: '2px' }}>
                            Look at the trend, abnormal increase in cases death, or cases facility ratio? Improving trend? Action taken and Recommendation:
                        </div>
                        <div style={{ border: '1px solid black', padding: '4px', fontSize: '9pt', marginBottom: '10px', minHeight: '50px' }}>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{footerData.comments}</div>
                        </div>

                        {/* Signature Block - Compressed */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '9pt' }}>
                            {/* Left Column */}
                            <div>
                                <div style={{ display: 'flex', marginBottom: '4px' }}>
                                    <span style={{ width: '130px' }}>Date sent HF/Woreda:</span>
                                    <div style={{ borderBottom: '1px solid black', flex: 1 }}>{footerData.dateSent}</div>
                                </div>
                                <div style={{ display: 'flex', marginBottom: '4px' }}>
                                    <span style={{ width: '60px' }}>Sent by:</span>
                                    <div style={{ borderBottom: '1px solid black', flex: 1 }}>{footerData.sentBy}</div>
                                </div>
                                <div style={{ display: 'flex', marginBottom: '4px' }}>
                                    <span style={{ width: '60px' }}>Tele:</span>
                                    <div style={{ borderBottom: '1px solid black', flex: 1 }}>{footerData.sentTele}</div>
                                </div>
                                <div style={{ display: 'flex' }}>
                                    <span style={{ width: '60px' }}>E-mail:</span>
                                    <div style={{ borderBottom: '1px solid black', flex: 1 }}>{footerData.sentEmail}</div>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div>
                                <div style={{ display: 'flex', marginBottom: '4px' }}>
                                    <span style={{ width: '140px' }}>Date received:</span>
                                    <div style={{ borderBottom: '1px solid black', flex: 1 }}>{footerData.dateReceived}</div>
                                </div>
                                <div style={{ display: 'flex', marginBottom: '4px' }}>
                                    <span style={{ width: '80px' }}>Received by:</span>
                                    <div style={{ borderBottom: '1px solid black', flex: 1 }}>{footerData.receivedBy}</div>
                                </div>
                                <div style={{ display: 'flex', marginBottom: '4px' }}>
                                    <span style={{ width: '60px' }}>Tele:</span>
                                    <div style={{ borderBottom: '1px solid black', flex: 1 }}>{footerData.receivedTele}</div>
                                </div>
                                <div style={{ display: 'flex' }}>
                                    <span style={{ width: '60px' }}>E-mail:</span>
                                    <div style={{ borderBottom: '1px solid black', flex: 1 }}>{footerData.receivedEmail}</div>
                                </div>
                            </div>
                        </div>

                    </div>
                ) : (
                    /* Detailed Line List Print Version */
                    <div className="w-full">
                        <div className="text-center mb-4">
                            <h1 className="font-bold text-lg uppercase">
                                {reportScope === 'SELECTED' ? 'SELECTED DISEASES DETAILED LINE LIST' : 'DISEASE DETAILED LINE LIST'}
                            </h1>
                            <p className="text-sm">Period: {startDate} to {endDate}</p>
                            {reportScope === 'SELECTED' && (
                                <p className="text-sm">Diseases: {selectedDiseases.length > 0 ? selectedDiseases.join(', ') : 'None selected'}</p>
                            )}
                        </div>
                        <table className="print-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Patient</th>
                                    <th style={{ width: '40px' }}>Age</th>
                                    <th style={{ width: '40px' }}>Sex</th>
                                    <th className="left">Disease / Diagnosis</th>
                                    <th>Type</th>
                                    <th>Outcome</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDetailedData.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{new Date(item.date).toLocaleDateString()}</td>
                                        <td>{item.patientName}</td>
                                        <td>{item.age}</td>
                                        <td>{item.gender ? item.gender.substring(0, 1) : '-'}</td>
                                        <td className="left">{item.disease} ({item.code})</td>
                                        <td>{item.type}</td>
                                        <td>{item.outcome}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Layout>
    );
};

// Helper to split array for 3-column layout
const mediaSplit3 = (arr, part) => {
    const total = arr.length;
    const third = Math.ceil(total / 3);

    if (part === 0) return arr.slice(0, third);
    if (part === 1) return arr.slice(third, third * 2);
    return arr.slice(third * 2);
};

export default DiseaseReports;
