import React, { useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { BarChart3, Download, Printer, Search } from 'lucide-react';

const AGE_GROUPS = ['<1', '1-4', '5-14', '15-29', '30-64', '>=65'];

const DiseaseTallySheetPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error('Select start and end dates');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/admin/reports/disease-tally', { params: { startDate, endDate } });
      setData(res.data);
      setSearched(true);
    } catch (e) {
      toast.error('Failed to load tally');
    } finally { setLoading(false); }
  };

  const totals = {};
  AGE_GROUPS.forEach(g => { totals[g] = 0; });

  const getTally = (n) => {
    if (!n || n === 0) return '';
    const groups = Math.floor(n / 5);
    const rem = n % 5;
    let t = '';
    for (let g = 0; g < groups; g++) t += '//// ';
    for (let r = 0; r < rem; r++) t += '/';
    return t.trim();
  };

  const handlePrint = () => {
    const clinicName = window.__CS__?.name || 'Clinic';
    const generated = new Date().toLocaleString();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    const year = start ? start.getFullYear() : '';
    const month = start ? start.toLocaleString('default', { month: 'long' }) : '';
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head><title>Disease Tally Sheet</title></head>
        <body style="font-family:Arial,sans-serif;margin:20px;color:#000;font-size:11px;">
          <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:12px;">
            <div style="font-size:14px;font-weight:bold;">Health Center / Hospital</div>
            <div style="font-size:15px;font-weight:bold;margin-top:2px;">Diseases Information Tally Sheet</div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px;">
            <tr><td style="padding:2px 6px;width:150px;"><b>Region</b></td><td style="padding:2px 6px;border-bottom:1px solid #000;">${window.__CS__?.region || '____________________'}</td>
                <td style="padding:2px 6px;width:100px;"><b>Begin Date</b></td><td style="padding:2px 6px;border-bottom:1px solid #000;">${startDate || '__________'}</td></tr>
            <tr><td style="padding:2px 6px;"><b>Zone/Subcity/Woreda</b></td><td style="padding:2px 6px;border-bottom:1px solid #000;">${window.__CS__?.zone || '____________________'}</td>
                <td style="padding:2px 6px;"><b>End Date</b></td><td style="padding:2px 6px;border-bottom:1px solid #000;">${endDate || '__________'}</td></tr>
            <tr><td style="padding:2px 6px;"><b>Health Facility Name</b></td><td style="padding:2px 6px;border-bottom:1px solid #000;" colspan="3">${clinicName}</td></tr>
          </table>
          <div style="margin-bottom:10px;font-size:11px;">
            <b>Health Facility Name</b> ____________________________________________
            <b>Year</b> ${year} _____________
            <b>Month</b> ${month} _____________
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:9px;">
            <thead>
              <tr>
                <th rowspan="3" style="border:1px solid #000;padding:3px;text-align:center;width:120px;">Disease Name<br/>(ESV-ICD 11)</th>
                <th rowspan="3" style="border:1px solid #000;padding:3px;text-align:center;width:40px;">ESV-ICD 11<br/>code</th>
                <th colspan="12" style="border:1px solid #000;padding:3px;text-align:center;">Female</th>
                <th colspan="12" style="border:1px solid #000;padding:3px;text-align:center;">Male</th>
              </tr>
              <tr>
                ${['Female', 'Male'].map(() =>
                  AGE_GROUPS.map(ag => `
                    <th colspan="2" style="border:1px solid #000;padding:2px;text-align:center;font-size:8px;">${ag}</th>
                  `).join('')
                ).join('')}
              </tr>
              <tr>
                ${['Female', 'Male'].map(() =>
                  AGE_GROUPS.map(() => `
                    <th style="border:1px solid #000;padding:2px;text-align:center;font-size:8px;width:25px;">Tally</th>
                    <th style="border:1px solid #000;padding:2px;text-align:center;font-size:8px;width:22px;">Count</th>
                  `).join('')
                ).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(d => `
                <tr>
                  <td style="border:1px solid #000;padding:3px;font-weight:bold;font-size:9px;">${d.diseaseName}</td>
                  <td style="border:1px solid #000;padding:3px;text-align:center;font-size:9px;color:#555;">${d.code}</td>
                  ${AGE_GROUPS.map(ag => `
                    <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8px;font-family:monospace;">${getTally(d.Female?.[ag] || 0)}</td>
                    <td style="border:1px solid #000;padding:3px;text-align:center;font-size:9px;">${d.Female?.[ag] || 0}</td>
                  `).join('')}
                  ${AGE_GROUPS.map(ag => `
                    <td style="border:1px solid #000;padding:3px;text-align:center;font-size:8px;font-family:monospace;">${getTally(d.Male?.[ag] || 0)}</td>
                    <td style="border:1px solid #000;padding:3px;text-align:center;font-size:9px;">${d.Male?.[ag] || 0}</td>
                  `).join('')}
                </tr>
              `).join('')}
              ${data.length === 0 ? '<tr><td colspan="26" style="padding:10px;text-align:center;">No disease data for this period</td></tr>' : ''}
            </tbody>
          </table>
          <p style="text-align:center;color:#888;font-size:9px;margin-top:15px;">Generated: ${generated}</p>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="max-w-full mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-green-600" /> Diseases Information Tally Sheet
          </h1>
          <p className="text-gray-500">{data.length} diseases reported</p>
        </div>
        <button onClick={handlePrint} className="btn btn-secondary flex items-center gap-2">
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      <form onSubmit={handleSearch} className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} required />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Loading...' : 'Generate Tally'}
            </button>
          </div>
        </div>
      </form>

      {searched && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th rowSpan={2} className="border p-1 text-left">Disease Name</th>
                <th rowSpan={2} className="border p-1 text-left">Code</th>
                <th colSpan={6} className="border p-1 text-center bg-pink-50">Female</th>
                <th colSpan={6} className="border p-1 text-center bg-blue-50">Male</th>
              </tr>
              <tr className="bg-gray-50">
                {['Female', 'Male'].map(gender =>
                  AGE_GROUPS.map(ag => (
                    <th key={`${gender}-${ag}`} className="border p-1 text-center text-[10px]">{ag}<br/>({gender[0]})</th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border p-1 font-medium">{d.diseaseName}</td>
                  <td className="border p-1 text-gray-500">{d.code}</td>
                  {AGE_GROUPS.map(ag => (
                    <td key={`F-${ag}`} className="border p-1 text-center">{d.Female?.[ag] || 0}</td>
                  ))}
                  {AGE_GROUPS.map(ag => (
                    <td key={`M-${ag}`} className="border p-1 text-center">{d.Male?.[ag] || 0}</td>
                  ))}
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={14} className="p-4 text-center text-gray-500">No disease data for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DiseaseTallySheetPage;
