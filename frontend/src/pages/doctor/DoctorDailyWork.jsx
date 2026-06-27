import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Printer, RefreshCw, Activity, DollarSign, CreditCard, Users, TrendingUp, BanknoteIcon } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const formatCurrency = (value) => `ETB ${Number(value || 0).toLocaleString()}`;

const formatCategory = (value) => {
  const text = String(value || '').trim();
  if (!text) return 'Service';
  return text.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
};

const CARD_COLORS = [
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-lime-100', text: 'text-lime-700' },
];

const formatCardSlug = (slug) => {
  if (!slug) return 'Card';
  return slug.charAt(0) + slug.slice(1).toLowerCase();
};

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="rounded-xl border bg-white p-3 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`rounded-lg ${color.bg} p-2`}>
        {Icon && <Icon className={`h-4 w-4 ${color.text}`} />}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 truncate">{label}</p>
        <p className="mt-0.5 text-sm font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

const DoctorDailyWork = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [monthlyData, setMonthlyData] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [dayDetails, setDayDetails] = useState(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);

  const monthName = useMemo(() => new Date(year, month, 1).toLocaleString('en-US', { month: 'long' }), [year, month]);
  const firstWeekday = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);
  const selectedDaySummary = dayDetails?.summary || null;
  const selectedVisits = dayDetails?.visits || [];

  const monthlyStats = useMemo(() => {
    if (!monthlySummary) return [];
    const base = [
      { label: 'Total Visits', value: monthlySummary.visits || 0, icon: Activity, color: { bg: 'bg-blue-100', text: 'text-blue-700' } },
      { label: 'Billed (Visit Date)', value: formatCurrency(monthlySummary.billedAmount || 0), icon: DollarSign, color: { bg: 'bg-emerald-100', text: 'text-emerald-700' } },
      { label: 'Paid (Visit Date)', value: formatCurrency(monthlySummary.paidAmountByVisitDate || 0), icon: TrendingUp, color: { bg: 'bg-green-100', text: 'text-green-700' } },
      { label: 'Collected (Payment Date)', value: formatCurrency(monthlySummary.collectedAmountByPaymentDate || 0), icon: BanknoteIcon, color: { bg: 'bg-amber-100', text: 'text-amber-700' } },
    ];
    if (monthlySummary.commissionAmount > 0) {
      base.push({ label: 'Your Share', value: formatCurrency(monthlySummary.commissionAmount || 0), icon: TrendingUp, color: { bg: 'bg-purple-100', text: 'text-purple-700' } });
    }
    const cardEntries = monthlySummary.cardBreakdown
      ? Object.entries(monthlySummary.cardBreakdown)
          .filter(([, amt]) => amt > 0)
          .map(([slug, amt], i) => ({
            label: `Card (${formatCardSlug(slug)})`,
            value: formatCurrency(amt),
            icon: CreditCard,
            color: CARD_COLORS[i % CARD_COLORS.length],
          }))
      : [];
    return [...base, ...cardEntries];
  }, [monthlySummary]);

  const dayStats = useMemo(() => {
    if (!selectedDaySummary) return [];
    const base = [
      { label: 'Visits', value: selectedDaySummary.visits || 0, icon: Users, color: { bg: 'bg-blue-100', text: 'text-blue-700' } },
      { label: 'Billed', value: formatCurrency(selectedDaySummary.billedAmount || 0), icon: DollarSign, color: { bg: 'bg-emerald-100', text: 'text-emerald-700' } },
      { label: 'Paid', value: formatCurrency(selectedDaySummary.paidAmountByVisitDate || 0), icon: TrendingUp, color: { bg: 'bg-green-100', text: 'text-green-700' } },
      { label: 'Collected', value: formatCurrency(selectedDaySummary.collectedAmountByPaymentDate || 0), icon: BanknoteIcon, color: { bg: 'bg-amber-100', text: 'text-amber-700' } },
    ];
    if (selectedDaySummary.commissionAmount > 0) {
      base.push({ label: 'Your Share', value: formatCurrency(selectedDaySummary.commissionAmount || 0), icon: TrendingUp, color: { bg: 'bg-purple-100', text: 'text-purple-700' } });
    }
    const cardEntries = selectedDaySummary.cardBreakdown
      ? Object.entries(selectedDaySummary.cardBreakdown)
          .filter(([, amt]) => amt > 0)
          .map(([slug, amt], i) => ({
            label: `Card (${formatCardSlug(slug)})`,
            value: formatCurrency(amt),
            icon: CreditCard,
            color: CARD_COLORS[i % CARD_COLORS.length],
          }))
      : [];
    return [...base, ...cardEntries];
  }, [selectedDaySummary]);

  const groupedSelectedVisits = useMemo(() => {
    const groupedMap = new Map();
    selectedVisits.forEach((visit, index) => {
      const groupKey = String(visit.patientId || visit.patientName || visit.visitId || `unknown-${index}`);
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          groupKey, patientName: visit.patientName || 'Unknown Patient',
          patientId: visit.patientId || 'N/A', visitRefs: [],
          patientGender: visit.patientGender || 'N/A', patientAge: visit.patientAge ?? 'N/A',
          billedAmount: 0, paidAmountByVisitDate: 0, services: [],
        });
      }
      const current = groupedMap.get(groupKey);
      const visitRef = visit.visitUid || visit.visitId || 'N/A';
      if (!current.visitRefs.includes(visitRef)) current.visitRefs.push(visitRef);
      current.billedAmount += Number(visit.billedAmount || 0);
      current.paidAmountByVisitDate += Number(visit.paidAmountByVisitDate || 0);
      if (Array.isArray(visit.services) && visit.services.length > 0) current.services.push(...visit.services);
    });
    return Array.from(groupedMap.values());
  }, [selectedVisits]);

  const fetchMonthly = async () => {
    try {
      setLoadingMonthly(true);
      const response = await api.get(`/doctors/daily-work/monthly?year=${year}&month=${month}`);
      const dailyData = response.data?.dailyData || [];
      setMonthlyData(dailyData);
      setMonthlySummary(response.data?.summary || null);
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const firstActiveDay = dailyData.find((item) => item.date === selectedDate) ||
        dailyData.find((item) => item.date === todayKey) ||
        dailyData.find((item) => item.visits > 0 || item.billedAmount > 0 || item.collectedAmountByPaymentDate > 0) ||
        dailyData[0];
      if (firstActiveDay?.date) setSelectedDate(firstActiveDay.date);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load monthly report');
    } finally { setLoadingMonthly(false); }
  };

  const fetchDayDetails = async (date) => {
    if (!date) return;
    try {
      setLoadingDay(true);
      const response = await api.get(`/doctors/daily-work/day-details?date=${date}`);
      setDayDetails(response.data || null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load day details');
      setDayDetails(null);
    } finally { setLoadingDay(false); }
  };

  useEffect(() => { fetchMonthly(); }, [year, month]);
  useEffect(() => { if (selectedDate) fetchDayDetails(selectedDate); }, [selectedDate]);

  const moveMonth = (direction) => {
    if (direction === 'prev') { if (month === 0) { setMonth(11); setYear((p) => p - 1); } else setMonth((p) => p - 1); }
    else { if (month === 11) { setMonth(0); setYear((p) => p + 1); } else setMonth((p) => p + 1); }
  };

  const calendarCells = useMemo(() => {
    const placeholders = Array.from({ length: firstWeekday }, (_, i) => ({ kind: 'empty', id: `e-${i}` }));
    return [...placeholders, ...monthlyData.map((d) => ({ kind: 'day', ...d }))];
  }, [firstWeekday, monthlyData]);

  const printDayReport = () => {
    if (!dayDetails) return;
    const printStats = [
      { label: 'Visits', val: selectedDaySummary.visits || 0 },
      { label: 'Billed', val: formatCurrency(selectedDaySummary.billedAmount || 0) },
      { label: 'Paid', val: formatCurrency(selectedDaySummary.paidAmountByVisitDate || 0) },
      { label: 'Collected', val: formatCurrency(selectedDaySummary.collectedAmountByPaymentDate || 0) },
      ...(selectedDaySummary.cardBreakdown ? Object.entries(selectedDaySummary.cardBreakdown).filter(([, a]) => a > 0).map(([s, a]) => ({ label: `Card (${formatCardSlug(s)})`, val: formatCurrency(a) })) : []),
    ];
    const summaryHtml = printStats.map((s) =>
      `<div class="box"><span>${s.label}</span><strong>${s.val}</strong></div>`
    ).join('');
    const visitBlocks = selectedVisits.length > 0 ? selectedVisits.map((v, i) => {
      const rows = (v.services || []).map((s) =>
        `<tr><td>${formatCategory(s.category)}</td><td>${s.serviceName || '-'}</td><td>${s.quantity || 1}</td><td>${formatCurrency(s.unitPrice || 0)}</td><td>${formatCurrency(s.totalPrice || 0)}</td></tr>`
      ).join('');
      return `<section><div class="vh"><h3>${i+1}. ${v.patientName || 'Unknown'}</h3><p>ID: ${v.patientId} | Visit: ${v.visitUid || ''}</p><div class="vt"><span>Billed ${formatCurrency(v.billedAmount)}</span><span>Paid ${formatCurrency(v.paidAmountByVisitDate)}</span></div></div><table><thead><tr><th>Category</th><th>Service</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${rows||'<tr><td colspan="5">No services</td></tr>'}</tbody></table></section>`;
    }).join('') : '<p>No visits</p>';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Daily Work - ${dayDetails.date}</title><style>
      body{font-family:Arial;padding:24px;background:#f8fafc}
      .page{max-width:1100px;margin:0 auto;background:#fff;padding:24px;border-radius:12px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
      .box{border:1px solid #e2e8f0;padding:12px;border-radius:10px}
      .box span{display:block;font-size:11px;color:#64748b}
      .box strong{font-size:16px;color:#0f172a}
      section{margin-bottom:16px;border:1px solid #dbeafe;border-radius:12px;overflow:hidden}
      .vh{background:#eff6ff;padding:12px 16px}
      .vh h3{margin:0;font-size:16px;color:#1d4ed8}
      .vh p{margin:4px 0;font-size:12px;color:#475569}
      .vt{display:flex;gap:16px;margin-top:8px}
      .vt span{background:#fff;border:1px solid #bfdbfe;padding:6px 12px;border-radius:8px;font-size:12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left;font-size:12px}
      th{background:#f8fafc}
    </style></head><body><div class="page"><h1 style="margin:0">Daily Work</h1><p style="color:#64748b">${dayDetails.date}</p><div class="grid">${summaryHtml}</div><h2>Patient Visits</h2>${visitBlocks}</div><script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Daily Work</h2>
            <p className="mt-1 text-sm text-gray-500">Month overview and per-day patient service breakdown</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchMonthly} className="btn btn-outline btn-sm flex items-center gap-1.5" type="button">
              <RefreshCw className={`h-3.5 w-3.5 ${loadingMonthly ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={printDayReport} className="btn btn-primary btn-sm flex items-center gap-1.5" type="button" disabled={!dayDetails}>
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button className="btn btn-outline btn-sm" type="button" onClick={() => moveMonth('prev')}><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
            <Calendar className="h-4 w-4 text-blue-600" /> {monthName} {year}
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => moveMonth('next')}><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAY_LABELS.map((l) => (
            <div key={l} className="rounded-lg bg-gray-100 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-gray-500">{l}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {calendarCells.map((cell) => {
            if (cell.kind === 'empty') return <div key={cell.id} className="min-h-[80px] rounded-xl border border-dashed border-gray-100 bg-gray-50/30" />;
            const isSel = cell.date === selectedDate;
            const hasAct = cell.visits > 0 || cell.billedAmount > 0;
            return (
              <button key={cell.date} type="button" onClick={() => setSelectedDate(cell.date)}
                className={`min-h-[80px] rounded-xl border p-2 text-left transition-all ${isSel ? 'border-blue-500 bg-blue-600 text-white shadow-md' : hasAct ? 'border-blue-200 bg-white hover:border-blue-400' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className={`text-[10px] font-semibold ${isSel ? 'text-blue-200' : 'text-gray-400'}`}>{cell.day}</div>
                <div className={`mt-1 text-base font-bold ${isSel ? 'text-white' : 'text-gray-900'}`}>{cell.visits}</div>
                <div className={`text-[9px] ${isSel ? 'text-blue-200' : 'text-gray-500'}`}>visits</div>
                {cell.billedAmount > 0 && <div className={`mt-1.5 text-[9px] truncate ${isSel ? 'text-blue-100' : 'text-gray-500'}`}>{formatCurrency(cell.billedAmount)}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monthly Stats */}
      {monthlyStats.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2.5">Month Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {monthlyStats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </div>
      )}

      {/* Day Detail */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">{selectedDate || 'Select a day'}</h3>
            {selectedDate && <p className="text-xs text-gray-500 mt-0.5">Patient services and payments</p>}
          </div>
        </div>

        {selectedDaySummary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
            {dayStats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        )}

        {loadingDay ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">Loading...</div>
        ) : !dayDetails ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">No data for this day</div>
        ) : groupedSelectedVisits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">No patient visits recorded</div>
        ) : (
          <div className="space-y-3">
            {groupedSelectedVisits.map((visit, i) => (
              <div key={visit.groupKey} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Patient {i + 1}</p>
                    <p className="font-semibold text-gray-900">{visit.patientName}</p>
                    <p className="text-xs text-gray-500">{visit.patientId} · {visit.visitRefs.join(', ')}</p>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-700">Billed {formatCurrency(visit.billedAmount)}</span>
                    <span className="rounded-lg bg-green-50 px-2.5 py-1.5 font-semibold text-green-700">Paid {formatCurrency(visit.paidAmountByVisitDate)}</span>
                  </div>
                </div>
                {(visit.services || []).length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {visit.services.map((svc, j) => (
                      <div key={`${visit.groupKey}-${j}`} className="px-4 py-2.5 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{formatCategory(svc.category)}</p>
                          <p className="text-sm font-medium text-gray-900 truncate">{svc.serviceName || 'Service'}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs shrink-0">
                          <span className="text-gray-500">×{svc.quantity || 1}</span>
                          <span className="font-medium text-gray-700 w-16 text-right">{formatCurrency(svc.totalPrice || 0)}</span>
                          {svc.commissionPct > 0 && (
                            <span className="font-semibold text-purple-700 w-20 text-right bg-purple-50 px-2 py-0.5 rounded">
                              {formatCurrency(svc.commissionAmount || 0)} ({svc.commissionPct}%)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorDailyWork;
