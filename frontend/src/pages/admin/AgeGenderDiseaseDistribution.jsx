import React, { useState, useEffect } from 'react';
import { Calendar, Download, Printer, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import api from '../../services/api';
import Layout from '../../components/common/Layout';

const AgeGenderDiseaseDistribution = () => {
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState(null);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // First day of month
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [printMode, setPrintMode] = useState('both'); // 'male', 'female', 'both'

    useEffect(() => {
        fetchReport();
    }, [startDate, endDate]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const response = await api.get('/diseases/age-gender-distribution', {
                params: { startDate, endDate }
            });
            setReportData(response.data);
        } catch (error) {
            console.error('Error fetching report:', error);
        } finally {
            setLoading(false);
        }
    };

    const navigateMonth = (direction) => {
        const current = new Date(startDate);
        current.setMonth(current.getMonth() + direction);
        const newStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const newEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        setStartDate(newStart.toISOString().split('T')[0]);
        setEndDate(newEnd.toISOString().split('T')[0]);
    };

    const getMonthYearLabel = () => {
        const date = new Date(startDate);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        
        const ageGroups = ['<1', '1-4', '5-14', '15-29', '30-64', '>=65'];
        
        let tableHeaders = '<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">Disease</th>';
        if (printMode === 'female') {
            ageGroups.forEach(age => {
                tableHeaders += `<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">${age}</th>`;
            });
            tableHeaders += '<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">Female Total</th>';
        } else if (printMode === 'male') {
            ageGroups.forEach(age => {
                tableHeaders += `<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">${age}</th>`;
            });
            tableHeaders += '<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">Male Total</th>';
        } else {
            // Both - show female first then male
            ageGroups.forEach(age => {
                tableHeaders += `<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">${age} F</th>`;
            });
            ageGroups.forEach(age => {
                tableHeaders += `<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">${age} M</th>`;
            });
            tableHeaders += '<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">F Total</th>';
            tableHeaders += '<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">M Total</th>';
            tableHeaders += '<th style="border:1px solid #000;padding:8px;background:#f0f0f0;">Grand Total</th>';
        }

        let tableRows = '';
        reportData?.diseases?.forEach(disease => {
            let row = `<tr><td style="border:1px solid #000;padding:8px;"><strong>${disease.diseaseName}</strong></td>`;
            
            if (printMode === 'female') {
                ageGroups.forEach(age => {
                    row += `<td style="border:1px solid #000;padding:8px;text-align:center;">${disease.counts[age]?.female || 0}</td>`;
                });
                row += `<td style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold;">${disease.femaleTotal || 0}</td>`;
            } else if (printMode === 'male') {
                ageGroups.forEach(age => {
                    row += `<td style="border:1px solid #000;padding:8px;text-align:center;">${disease.counts[age]?.male || 0}</td>`;
                });
                row += `<td style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold;">${disease.maleTotal || 0}</td>`;
            } else {
                ageGroups.forEach(age => {
                    row += `<td style="border:1px solid #000;padding:8px;text-align:center;">${disease.counts[age]?.female || 0}</td>`;
                });
                ageGroups.forEach(age => {
                    row += `<td style="border:1px solid #000;padding:8px;text-align:center;">${disease.counts[age]?.male || 0}</td>`;
                });
                row += `<td style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold;">${disease.femaleTotal || 0}</td>`;
                row += `<td style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold;">${disease.maleTotal || 0}</td>`;
                row += `<td style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold;">${disease.total}</td>`;
            }
            tableRows += row;
        });

        const title = printMode === 'female' ? 'Female' : printMode === 'male' ? 'Male' : 'Both';
        
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Diseases Information Tally Sheet - ${title}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .header h1 { font-size: 20px; margin-bottom: 10px; }
                    .header p { font-size: 14px; color: #666; margin: 2px 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #000; padding: 8px; font-size: 12px; }
                    th { background-color: #f5f5f5; }
                    .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Diseases Information Tally Sheet</h1>
                    <p><strong>Health Facility:</strong> ${window.__CS__?.name || 'Clinic'}</p>
                    <p><strong>Report Type:</strong> Age-Gender Disease Distribution</p>
                    <p><strong>Year:</strong> ${new Date(startDate).getFullYear()} | <strong>Month:</strong> ${getMonthYearLabel()}</p>
                    <p><strong>Date Range:</strong> ${startDate} to ${endDate}</p>
                    <p style="margin-top:10px;"><em>${title} Distribution</em></p>
                </div>
                <table>
                    <thead>
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Total Diseases: ${reportData?.diseaseCount || 0} | Total Cases: ${reportData?.totalDiagnoses || 0}</p>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                </div>
            </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    const ageGroups = ['<1', '1-4', '5-14', '15-29', '30-64', '>=65'];

    return (
        <Layout>
            <div className="p-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Users className="h-8 w-8 text-indigo-600" />
                            Age-Gender Disease Distribution
                        </h1>
                        <p className="text-gray-600 mt-1">Disease distribution by age group and gender</p>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-4 md:mt-0">
                        <button
                            onClick={() => setPrintMode('female')}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                printMode === 'female' 
                                    ? 'bg-pink-600 text-white' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Female
                        </button>
                        <button
                            onClick={() => setPrintMode('male')}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                printMode === 'male' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Male
                        </button>
                        <button
                            onClick={() => setPrintMode('both')}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                printMode === 'both' 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Both
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={!reportData}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </button>
                    </div>
                </div>

                {/* Date Controls */}
                <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigateMonth(-1)}
                                className="p-2 rounded-lg hover:bg-gray-100 border"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            
                            <div className="px-4 py-2 bg-gray-100 rounded-lg font-medium min-w-[200px] text-center">
                                {getMonthYearLabel()}
                            </div>
                            
                            <button
                                onClick={() => navigateMonth(1)}
                                className="p-2 rounded-lg hover:bg-gray-100 border"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">From:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border rounded-lg px-3 py-2"
                            />
                            <label className="text-sm text-gray-600">To:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border rounded-lg px-3 py-2"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : reportData ? (
                    <>
                        {/* Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white rounded-xl shadow-sm border p-6">
                                <div className="text-sm text-gray-500">Total Diseases</div>
                                <div className="text-3xl font-bold text-gray-900 mt-1">{reportData.diseaseCount || 0}</div>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border p-6">
                                <div className="text-sm text-gray-500">Total Cases</div>
                                <div className="text-3xl font-bold text-indigo-600 mt-1">{reportData.totalDiagnoses || 0}</div>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border p-6">
                                <div className="text-sm text-gray-500">Period</div>
                                <div className="text-lg font-semibold text-gray-900 mt-1">
                                    {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 sticky left-0 bg-gray-50">Disease</th>
                                            {printMode === 'female' ? (
                                                <>
                                                    {ageGroups.map(age => (
                                                        <th key={`${age}-f`} className="px-3 py-3 text-center text-sm font-medium text-pink-600">
                                                            {age}
                                                        </th>
                                                    ))}
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-pink-600">Female Total</th>
                                                </>
                                            ) : printMode === 'male' ? (
                                                <>
                                                    {ageGroups.map(age => (
                                                        <th key={`${age}-m`} className="px-3 py-3 text-center text-sm font-medium text-blue-600">
                                                            {age}
                                                        </th>
                                                    ))}
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-blue-600">Male Total</th>
                                                </>
                                            ) : (
                                                <>
                                                    {ageGroups.map(age => (
                                                        <th key={`${age}-f`} className="px-2 py-3 text-center text-sm font-medium text-pink-600">
                                                            {age} F
                                                        </th>
                                                    ))}
                                                    {ageGroups.map(age => (
                                                        <th key={`${age}-m`} className="px-2 py-3 text-center text-sm font-medium text-blue-600">
                                                            {age} M
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-3 text-center text-sm font-bold text-pink-600">F Total</th>
                                                    <th className="px-3 py-3 text-center text-sm font-bold text-blue-600">M Total</th>
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-900">Grand Total</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.diseases?.length > 0 ? (
                                            reportData.diseases.map((disease, idx) => (
                                                <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                                                        {disease.diseaseName}
                                                    </td>
                                                    {printMode === 'female' ? (
                                                        <>
                                                            {ageGroups.map(age => (
                                                                <td key={`${age}-f`} className="px-3 py-3 text-center text-sm text-gray-700">
                                                                    {disease.counts[age]?.female || 0}
                                                                </td>
                                                            ))}
                                                            <td className="px-4 py-3 text-center text-sm font-bold text-pink-600">
                                                                {disease.femaleTotal || 0}
                                                            </td>
                                                        </>
                                                    ) : printMode === 'male' ? (
                                                        <>
                                                            {ageGroups.map(age => (
                                                                <td key={`${age}-m`} className="px-3 py-3 text-center text-sm text-gray-700">
                                                                    {disease.counts[age]?.male || 0}
                                                                </td>
                                                            ))}
                                                            <td className="px-4 py-3 text-center text-sm font-bold text-blue-600">
                                                                {disease.maleTotal || 0}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {ageGroups.map(age => (
                                                                <td key={`${age}-f`} className="px-2 py-3 text-center text-sm text-gray-700">
                                                                    {disease.counts[age]?.female || 0}
                                                                </td>
                                                            ))}
                                                            {ageGroups.map(age => (
                                                                <td key={`${age}-m`} className="px-2 py-3 text-center text-sm text-gray-700">
                                                                    {disease.counts[age]?.male || 0}
                                                                </td>
                                                            ))}
                                                            <td className="px-3 py-3 text-center text-sm font-bold text-pink-600">
                                                                {disease.femaleTotal || 0}
                                                            </td>
                                                            <td className="px-3 py-3 text-center text-sm font-bold text-blue-600">
                                                                {disease.maleTotal || 0}
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-sm font-bold text-indigo-600">
                                                                {disease.total}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={20} className="px-4 py-8 text-center text-gray-500">
                                                    No disease data found for this period
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                        <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-lg font-medium text-gray-900">No Data Available</p>
                        <p className="text-gray-500">Select a different date range to view reports</p>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default AgeGenderDiseaseDistribution;
