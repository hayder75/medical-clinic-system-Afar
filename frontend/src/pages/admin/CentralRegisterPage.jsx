import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FileText, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const DISABILITY_LABELS = {
  VISION_LOSS: 'Vision Loss',
  HEARING_LOSS: 'Hearing Loss',
  MOBILITY_IMPAIRMENT: 'Mobility Impairment',
  NO_DISABILITY: 'No Disability',
  OTHER: 'Other'
};

const PAYMENT_LABELS = {
  CASH: 'Cash',
  BANK: 'Bank',
  INSURANCE: 'CBHI',
  CREDIT: 'Credit',
  CHARITY: 'Charity'
};

const PRINT_PAYMENT_MAP = {
  CASH: 'Cash (3)',
  BANK: 'Bank',
  INSURANCE: 'CBHI (1)',
  CREDIT: 'Credit (2)',
  CHARITY: 'Charity'
};

const PRINT_DISABILITY_MAP = {
  VISION_LOSS: '1. Vision loss',
  HEARING_LOSS: '2. Hearing loss',
  MOBILITY_IMPAIRMENT: '3. Mobility impairment',
  NO_DISABILITY: '4. No disability',
  OTHER: 'Other'
};

const CentralRegisterPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/admin/reports/central-register', { params });
      setRows(res.data.rows);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } catch (e) {
      toast.error('Failed to load register');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [page]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); loadData(); };

  const getTally = (n) => {
    if (!n) return '';
    const groups = Math.floor(n / 5);
    const rem = n % 5;
    let t = '';
    for (let g = 0; g < groups; g++) t += '|||| ';
    for (let r = 0; r < rem; r++) t += '|';
    return t.trim();
  };

  const exportPdf = () => {
    const clinicName = window.__CS__?.name || 'Clinic';
    const dateRange = startDate || endDate
      ? `${startDate || '...'} to ${endDate || '...'}`
      : 'All records';
    const now = new Date();
    const ts = `Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;

    const tableRows = rows.map((r, i) =>
      `<tr>
        <td style="padding:4px 8px;border:1px solid #000;text-align:center;font-size:10px;">${(page - 1) * 50 + i + 1}</td>
        <td style="padding:4px 8px;border:1px solid #000;text-align:center;font-size:10px;">${new Date(r.regDate).toLocaleDateString()}</td>
        <td style="padding:4px 8px;border:1px solid #000;font-family:monospace;font-size:10px;">${r.mrn}</td>
        <td style="padding:4px 8px;border:1px solid #000;font-size:10px;">${r.name}</td>
        <td style="padding:4px 8px;border:1px solid #000;text-align:center;font-size:10px;">${r.age}</td>
        <td style="padding:4px 8px;border:1px solid #000;text-align:center;font-size:10px;">${r.sex === 'MALE' ? 'M' : r.sex === 'FEMALE' ? 'F' : r.sex}</td>
        <td style="padding:4px 8px;border:1px solid #000;font-size:10px;">${PRINT_DISABILITY_MAP[r.disabilityStatus] || r.disabilityStatus || ''}</td>
        <td style="padding:4px 8px;border:1px solid #000;text-align:center;font-size:10px;">${PRINT_PAYMENT_MAP[r.paymentType] || r.paymentType}</td>
      </tr>`
    ).join('');

    const totalPaymentRows = Object.entries(totalByPayment).map(([k, c]) =>
      `<tr><td style="padding:4px 8px;border:1px solid #000;font-size:10px;">${PRINT_PAYMENT_MAP[k] || k}</td><td style="padding:4px 8px;border:1px solid #000;text-align:center;font-size:10px;">${c}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head><title>Central Register - ${clinicName}</title></head>
<body style="font-family:Arial,sans-serif;margin:20px;color:#000;font-size:12px;">
  <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:15px;">
    <div style="font-size:14px;font-weight:bold;">Health Center / Clinic / Hospital</div>
    <div style="font-size:16px;font-weight:bold;margin-top:2px;">Central Register</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:15px;font-size:11px;">
    <tr><td style="padding:3px 8px;width:180px;"><b>Region</b></td><td style="padding:3px 8px;border-bottom:1px solid #000;">${window.__CS__?.region || '____________________'}</td>
        <td style="padding:3px 8px;width:120px;"><b>Begin Date</b></td><td style="padding:3px 8px;border-bottom:1px solid #000;">${startDate || '__________'}</td></tr>
    <tr><td style="padding:3px 8px;"><b>Zone/Subcity/Woreda</b></td><td style="padding:3px 8px;border-bottom:1px solid #000;">${window.__CS__?.zone || '____________________'}</td>
        <td style="padding:3px 8px;"><b>End Date</b></td><td style="padding:3px 8px;border-bottom:1px solid #000;">${endDate || '__________'}</td></tr>
    <tr><td style="padding:3px 8px;"><b>Health Facility Name</b></td><td style="padding:3px 8px;border-bottom:1px solid #000;" colspan="3">${clinicName}</td></tr>
  </table>
  ${rows.length === 0 ? '<p style="text-align:center;margin:40px 0;">No records found</p>' : `
  <table style="width:100%;border-collapse:collapse;font-size:10px;">
    <thead>
      <tr style="background:#e0e0e0;">
        <th style="padding:4px 6px;border:1px solid #000;text-align:center;width:30px;">S.No<br/>(1)</th>
        <th style="padding:4px 6px;border:1px solid #000;text-align:center;width:50px;">Date<br/>(2)</th>
        <th style="padding:4px 6px;border:1px solid #000;text-align:center;width:60px;">MRN<br/>(3)</th>
        <th style="padding:4px 6px;border:1px solid #000;text-align:center;">Name<br/>(4)</th>
        <th style="padding:4px 6px;border:1px solid #000;text-align:center;width:35px;">Age<br/>(5)</th>
        <th style="padding:4px 6px;border:1px solid #000;text-align:center;width:30px;">Sex<br/>(6)</th>
        <th style="padding:4px 6px;border:1px solid #000;text-align:center;width:90px;">Disability Status<br/>(7)</th>
        <th style="padding:4px 6px;border:1px solid #000;text-align:center;width:80px;">Payment Type<br/>(8)</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div style="margin-top:15px;border-top:2px solid #000;padding-top:8px;">
    <table style="width:auto;border-collapse:collapse;font-size:11px;">
      <tr><td colspan="2" style="font-weight:bold;padding:4px 8px;">Count Total</td></tr>
      ${totalPaymentRows}
    </table>
  </div>`}
  <div style="text-align:center;border-top:1px solid #999;padding-top:6px;margin-top:15px;font-size:9px;color:#666;">${ts}</div>
</body>
</html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const totalByPayment = {};
  const totalByDisability = {};
  rows.forEach(r => {
    totalByPayment[r.paymentType] = (totalByPayment[r.paymentType] || 0) + 1;
    const disability = DISABILITY_LABELS[r.disabilityStatus] || r.disabilityStatus || 'Unknown';
    totalByDisability[disability] = (totalByDisability[disability] || 0) + 1;
  });

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" /> Central Register
          </h1>
          <p className="text-gray-500">{total} patients registered</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={exportPdf}>
          <Download className="h-4 w-4" /> Print / PDF
        </button>
      </div>

      {/* Summary Cards - Top */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Payment Type Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(totalByPayment).map(([type, count]) => (
                <div key={type} className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-lg font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-gray-500">{PAYMENT_LABELS[type] || type}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Disability Status Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(totalByDisability).map(([status, count]) => (
                <div key={status} className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-lg font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-gray-500">{status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSearch} className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary">Search</button>
          </div>
        </div>
      </form>

      <div className="card overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">S.No</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">MRN</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Age</th>
              <th className="p-2 text-left">Sex</th>
              <th className="p-2 text-left">Disability Status</th>
              <th className="p-2 text-left">Payment Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.mrn} className="border-t hover:bg-gray-50">
                <td className="p-2">{(page - 1) * 50 + i + 1}</td>
                <td className="p-2">{new Date(r.regDate).toLocaleDateString()}</td>
                <td className="p-2 font-mono text-xs">{r.mrn}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.age}</td>
                <td className="p-2">{r.sex === 'MALE' ? 'M' : r.sex === 'FEMALE' ? 'F' : r.sex}</td>
                <td className="p-2">{DISABILITY_LABELS[r.disabilityStatus] || r.disabilityStatus}</td>
                <td className="p-2">{PAYMENT_LABELS[r.paymentType] || r.paymentType}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="card p-4 mt-4">
        <h3 className="font-medium mb-2">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(totalByPayment).map(([type, count]) => (
            <div key={type} className="text-center p-3 bg-gray-50 rounded">
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs text-gray-500">{PAYMENT_LABELS[type] || type}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CentralRegisterPage;
