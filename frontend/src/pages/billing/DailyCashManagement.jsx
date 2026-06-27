import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  Download, Printer, Calendar, FlaskConical, Scan, Wrench,
  HeartPulse, CreditCard, User, Package, AlertTriangle, Layers,
  TrendingUp, Wallet, Landmark, Receipt, RefreshCw, Search,
  PlusCircle, MinusCircle, ArrowUpRight, ArrowDownRight,
  Banknote, PiggyBank, Building2, ChevronDown, ChevronUp,
  Filter, X, Clock, DollarSign, FileText
} from 'lucide-react';
import api from '../../services/api';
import { getServerUrl } from '../../utils/imageUrl';
import BankMethodSelect from '../../components/common/BankMethodSelect';

const CARD_PRODUCT_GRADIENTS = [
  'from-blue-500 to-blue-600', 'from-fuchsia-500 to-fuchsia-600', 'from-sky-500 to-sky-600',
  'from-pink-500 to-pink-600', 'from-teal-500 to-teal-600', 'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600', 'from-violet-500 to-violet-600', 'from-emerald-500 to-emerald-600',
  'from-orange-500 to-orange-600', 'from-purple-500 to-purple-600', 'from-red-500 to-red-600'
];

const BASE_SERVICE_BUTTON_CONFIG = [
  { key: 'ALL', label: 'All Services', icon: Layers, gradient: 'from-slate-500 to-slate-600' },
  { key: 'LAB_ORDERED', label: 'Lab (Doctor)', icon: FlaskConical, gradient: 'from-cyan-500 to-cyan-600' },
  { key: 'LAB_WALKIN', label: 'Lab Walk-in', icon: FlaskConical, gradient: 'from-sky-500 to-sky-600' },
  { key: 'RADIOLOGY_ORDERED', label: 'Radiology (Doctor)', icon: Scan, gradient: 'from-indigo-500 to-indigo-600' },
  { key: 'RADIOLOGY_WALKIN', label: 'Radiology Walk-in', icon: Scan, gradient: 'from-violet-500 to-violet-600' },
  { key: 'PROCEDURE', label: 'Procedure', icon: Wrench, gradient: 'from-amber-500 to-amber-600' },
  { key: 'NURSE_SERVICES', label: 'Nurse Services', icon: HeartPulse, gradient: 'from-emerald-500 to-emerald-600' },
  { key: 'MATERIAL_NEEDS', label: 'Material Needs', icon: Package, gradient: 'from-orange-500 to-orange-600' },
  { key: 'EMERGENCY_MEDICATION', label: 'Emergency Medication', icon: AlertTriangle, gradient: 'from-rose-500 to-rose-600' },
  { key: 'OTHER', label: 'Other Services', icon: Receipt, gradient: 'from-zinc-500 to-zinc-600' }
];

const buildServiceButtonConfig = (cardProducts) => {
  const cardButtons = (cardProducts || []).flatMap((cp, i) => {
    const gIdx = i % CARD_PRODUCT_GRADIENTS.length;
    const slug = (cp.slug || cp.name || '').toLowerCase().replace(/\s+/g, '_');
    return [
      { key: `CARD_CREATED_${slug.toUpperCase()}`, label: `${cp.name || cp.displayName} Card Created`, icon: CreditCard, gradient: CARD_PRODUCT_GRADIENTS[gIdx] },
      { key: `CARD_REACTIVATION_${slug.toUpperCase()}`, label: `${cp.name || cp.displayName} Card Reactivation`, icon: CreditCard, gradient: CARD_PRODUCT_GRADIENTS[(gIdx + 1) % CARD_PRODUCT_GRADIENTS.length] }
    ];
  });
  return [...BASE_SERVICE_BUTTON_CONFIG, ...cardButtons];
};

const EXPENSE_CATEGORIES = [
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies', icon: FileText },
  { value: 'MEDICAL_SUPPLIES', label: 'Medical Supplies', icon: Package },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: Wrench },
  { value: 'UTILITIES', label: 'Utilities', icon: Receipt },
  { value: 'FOOD_BEVERAGE', label: 'Food & Beverage', icon: HeartPulse },
  { value: 'TRANSPORTATION', label: 'Transportation', icon: TrendingUp },
  { value: 'STAFF_LOAN', label: 'Staff Loan', icon: User },
  { value: 'OTHER', label: 'Other', icon: Layers }
];

const formatCurrency = (amount) => `ETB ${Number(amount || 0).toLocaleString()}`;
const getLocalDateInputValue = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

const DailyCashManagement = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState('');
  const [patientReceipts, setPatientReceipts] = useState([]);
  const [loadingPatientReceipts, setLoadingPatientReceipts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [acceptedSummary, setAcceptedSummary] = useState({
    date: '', currentUser: null, totalAcceptedAmount: 0, totalTransactions: 0, serviceTotals: [], myTransactions: []
  });
  const [loadingAcceptedSummary, setLoadingAcceptedSummary] = useState(false);
  const [selectedServiceBucket, setSelectedServiceBucket] = useState('ALL');
  const [showMyDetails, setShowMyDetails] = useState(false);
  const [depositForm, setDepositForm] = useState({ amount: '', bankName: '', accountNumber: '', transactionNumber: '', notes: '' });
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'OFFICE_SUPPLIES', description: '', vendor: '' });
  const [cardProducts, setCardProducts] = useState([]);

  const SERVICE_BUTTON_CONFIG = useMemo(() => buildServiceButtonConfig(cardProducts), [cardProducts]);

  useEffect(() => {
    fetchCurrentSession();
    fetchAcceptedServicesSummary();
    fetchCardProducts();
  }, [selectedDate]);
  useEffect(() => { if (activeTab === 'transactions') fetchPatientReceipts(); }, [activeTab]);
  useEffect(() => {
    if (activeTab === 'transactions') {
      const t = setTimeout(() => fetchPatientReceipts(), 500);
      return () => clearTimeout(t);
    }
  }, [searchQuery, searchType]);

  const fetchCurrentSession = async () => {
    try { setLoading(true); const r = await api.get('/cash-management/current-session'); setSession(r.data.session); }
    catch (e) { console.error(e); toast.error('Failed to fetch session'); }
    finally { setLoading(false); }
  };

  const fetchAcceptedServicesSummary = async () => {
    try {
      setLoadingAcceptedSummary(true);
      const dateParam = selectedDate || getLocalDateInputValue();
      const r = await api.get(`/cash-management/accepted-services-summary?date=${dateParam}`);
      if (r.data?.success) {
        setAcceptedSummary({
          date: r.data.date, currentUser: r.data.currentUser || null,
          totalAcceptedAmount: r.data.totalAcceptedAmount || 0,
          totalTransactions: r.data.totalTransactions || 0,
          serviceTotals: r.data.serviceTotals || [],
          myTransactions: r.data.myTransactions || []
        });
      }
    } catch (e) { console.error(e); toast.error(e.response?.data?.error || 'Failed to fetch summary'); }
    finally { setLoadingAcceptedSummary(false); }
  };

  const fetchCardProducts = async () => {
    try {
      const r = await api.get('/admin/card-products');
      setCardProducts(r.data?.cardProducts || []);
    } catch (e) { console.error('Failed to fetch card products:', e); }
  };

  const handleAddDeposit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/cash-management/add-deposit', { ...depositForm, amount: parseFloat(depositForm.amount) });
      toast.success('Bank deposit recorded');
      setDepositForm({ amount: '', bankName: '', accountNumber: '', transactionNumber: '', notes: '' });
      fetchCurrentSession();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to record deposit'); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      await api.post('/cash-management/add-expense', { ...expenseForm, amount: parseFloat(expenseForm.amount) });
      toast.success('Expense recorded');
      setExpenseForm({ amount: '', category: 'OFFICE_SUPPLIES', description: '', vendor: '' });
      fetchCurrentSession();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to record expense'); }
  };

  const fetchPatientReceipts = async () => {
    try {
      setLoadingPatientReceipts(true);
      const dateParam = selectedDate || getLocalDateInputValue();
      let url = `/cash-management/patient-receipts?date=${dateParam}`;
      if (searchQuery?.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}&searchType=${searchType}`;
      const r = await api.get(url);
      if (r.data.success) setPatientReceipts(r.data.patients || []);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to fetch receipts'); }
    finally { setLoadingPatientReceipts(false); }
  };

  const printPatientReceipt = (pd) => {
    const w = window.open('', '_blank');
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const svcRows = (pd.services || []).map((s, i) => `
      <div class="row"><span>${i + 1}. ${s.name}</span><span>${s.totalPrice.toFixed(2)} ETB</span></div>
    `).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
      @page{size:A6;margin:0}body{font-family:Arial;margin:0;padding:8mm;background:#f3f4f6}
      .rcpt{width:105mm;min-height:148mm;background:#fff;padding:8mm;margin:0 auto;box-shadow:0 4px 12px rgba(0,0,0,.1)}
      .hdr{border-bottom:2px solid #2563eb;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}
      .cn{font-size:16px;font-weight:800;color:#1e40af}.ci{font-size:9px;color:#64748b}
      .pt{border:1px solid #e2e8f0;background:#f8fafc;padding:8px;border-radius:6px;margin:8px 0}
      .pn{font-size:13px;font-weight:700}.sv{margin:12px 0}.sv h3{font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
      .row{display:flex;justify-content:space-between;font-size:12px;padding:4px 0}.tot{border-top:2px solid #e2e8f0;margin-top:12px;padding-top:8px;display:flex;justify-content:space-between;font-size:15px;font-weight:800}
      .sig{margin-top:20px;text-align:right;border-top:1px solid #334155;width:140px;padding-top:4px;margin-left:auto;font-size:9px;color:#64748b;text-align:center}
      .ftr{text-align:center;font-size:8px;color:#94a3b8;margin-top:20px}
      .nop{text-align:center;margin-bottom:12px}.nop button{background:#2563eb;color:#fff;border:0;padding:8px 20px;border-radius:6px;cursor:pointer}
    </style></head><body>
    <div class="nop"><button onclick="window.print()">Print Receipt</button></div>
    <div class="rcpt"><div class="hdr"><div class="cn">${window.__CS__?.name || 'Clinic'}</div><div><b>Receipt</b><br><span class="ci">${dateStr}<br>${timeStr}</span></div></div>
    <div class="pt"><div class="pn">${pd.patient?.name || 'Patient'}</div></div>
    <div class="sv"><h3>Services</h3>${svcRows}</div>
    <div class="tot"><span>Total</span><span>${pd.totalAmount.toFixed(2)} ETB</span></div>
    <div class="sig">Cashier Signature</div>
    <div class="ftr">${window.__CS__?.name || 'Clinic'} — Generated ${now.toLocaleString()}</div></div>
    <script>setTimeout(()=>window.print(),250)</script></body></html>`);
    w.document.close();
  };

  const handlePrintTransactions = () => {
    if (!filteredTransactions.length) return toast.error('No transactions');
    const w = window.open('', '_blank');
    const total = filteredTransactions.reduce((s, t) => s + (t.type === 'PAYMENT_RECEIVED' ? t.amount : -t.amount), 0);
    const rows = filteredTransactions.map(t => `<tr><td>${new Date(t.createdAt).toLocaleString()}</td><td>${t.description}</td><td>${t.type.replace('_', ' ')}</td><td>${t.paymentMethod}</td><td>${t.patient?.name || '-'}</td><td class="${t.type === 'PAYMENT_RECEIVED' ? 'pos' : 'neg'}">${t.type === 'PAYMENT_RECEIVED' ? '+' : '-'}${formatCurrency(t.amount)}</td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Transactions</title><style>
      @page{margin:20mm}body{font-family:Arial;padding:20px;font-size:10px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f0f0f0}
      .pos{color:#059669}.neg{color:#dc2626}.total{font-weight:700;background:#f9f9f9}
    </style></head><body><h2>Daily Transactions</h2><p>${new Date().toLocaleDateString()}</p>
    <table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Method</th><th>Patient</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr class="total"><td colspan="5" style="text-align:right">Total:</td><td>${formatCurrency(total)}</td></tr></tfoot></table></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  const handleExportExcel = () => {
    if (!filteredTransactions.length) return toast.error('No transactions');
    const headers = ['Date & Time', 'Description', 'Type', 'Payment Method', 'Patient', 'Amount'];
    const rows = filteredTransactions.map(t => [
      new Date(t.createdAt).toLocaleString(), t.description, t.type.replace('_', ' '),
      t.paymentMethod, t.patient?.name || '-',
      `${t.type === 'PAYMENT_RECEIVED' ? '+' : '-'}${formatCurrency(t.amount)}`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions-${selectedDate || 'all'}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast.success('Exported');
  };

  const handleExportPDF = async () => {
    if (!filteredTransactions.length) return toast.error('No transactions');
    try {
      const r = await api.post('/cash-management/export-transactions-pdf', { transactions: filteredTransactions, date: selectedDate || getLocalDateInputValue() });
      const link = document.createElement('a');
      link.href = `${getServerUrl()}${r.data.filePath}`;
      link.download = r.data.fileName;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (e) { toast.error('PDF export failed'); }
  };

  const serviceTotalMap = useMemo(() => {
    const m = new Map();
    (acceptedSummary.serviceTotals || []).forEach(s => m.set(s.key, s));
    return m;
  }, [acceptedSummary.serviceTotals]);

  const filteredMyTransactions = useMemo(() => {
    return (acceptedSummary.myTransactions || []).filter(item =>
      selectedServiceBucket === 'ALL' || item.allocations.some(a => a.key === selectedServiceBucket)
    );
  }, [acceptedSummary.myTransactions, selectedServiceBucket]);

  const filteredTransactions = useMemo(() => {
    if (!session?.transactions) return [];
    if (!selectedDate) return session.transactions;
    const d = new Date(selectedDate); d.setHours(0, 0, 0, 0);
    const nd = new Date(d); nd.setDate(nd.getDate() + 1);
    return session.transactions.filter(t => { const td = new Date(t.createdAt); return td >= d && td < nd; });
  }, [session, selectedDate]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" /></div>;
  if (!session) return <div className="text-center py-16 text-gray-500"><Wallet className="h-16 w-16 mx-auto mb-4 opacity-40" /><p className="text-lg">No active cash session</p></div>;

  const { calculatedTotals } = session;

  return (
    <div className="space-y-6">

      {/* ───── SESSION HEADER ───── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Wallet className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Daily Cash Management</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input type="date" value={selectedDate || getLocalDateInputValue()} onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 hover:bg-white transition-colors" />
                </div>
                <span className="text-sm text-gray-500">{selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : new Date(session.sessionDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span className="text-gray-300">|</span>
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-sm text-gray-500">{session.createdBy?.fullname || 'Cashier'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide ${
              session.status === 'ACTIVE' ? 'bg-green-100 text-green-700 border border-green-200' :
              session.status === 'CLOSED' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
              'bg-blue-100 text-blue-700 border border-blue-200'
            }`}>
              {session.status}
            </span>
            {session.isReset && <span className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wide bg-orange-100 text-orange-700 border border-orange-200">RESET</span>}
            <button onClick={fetchCurrentSession} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ───── HERO METRICS ───── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Starting Cash', value: formatCurrency(session.startingCash), gradient: 'from-blue-500 to-blue-600', icon: Banknote },
          { label: 'Total Received', value: formatCurrency(calculatedTotals.totalReceived), gradient: 'from-emerald-500 to-emerald-600', icon: TrendingUp },
          { label: 'Total Expenses', value: formatCurrency(calculatedTotals.totalExpenses), gradient: 'from-rose-500 to-rose-600', icon: MinusCircle },
          { label: 'Current Cash', value: formatCurrency(calculatedTotals.currentCash), gradient: 'from-violet-500 to-violet-600', icon: PiggyBank },
        ].map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg" style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-90`} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{m.label}</span>
                  <Icon className="h-5 w-5 opacity-60" />
                </div>
                <div className="text-2xl font-bold tracking-tight">{m.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ───── ACCEPTED SERVICES + RECONCILIATION ───── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-500" />
                Accepted / Processed Services
              </h2>
              <p className="text-sm text-gray-500">
                {acceptedSummary.date ? new Date(acceptedSummary.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Today'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-sm">
                <span className="text-gray-600">Total: </span>
                <span className="font-bold text-indigo-700">{formatCurrency(acceptedSummary.totalAcceptedAmount || 0)}</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm">
                <span className="text-gray-600">Tx: </span>
                <span className="font-bold text-gray-800">{acceptedSummary.totalTransactions || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2.5">
            {SERVICE_BUTTON_CONFIG.map((sb) => {
              const Icon = sb.icon;
              const stat = serviceTotalMap.get(sb.key);
              const amount = sb.key === 'ALL' ? (acceptedSummary.totalAcceptedAmount || 0) : (stat?.amount || 0);
              const txCount = sb.key === 'ALL' ? (acceptedSummary.totalTransactions || 0) : (stat?.transactions || 0);
              const isActive = selectedServiceBucket === sb.key;
              return (
                <button key={sb.key} onClick={() => setSelectedServiceBucket(sb.key)}
                  className={`relative rounded-xl p-3 text-left transition-all duration-200 ${
                    isActive ? 'ring-2 ring-indigo-400 ring-offset-2 shadow-md scale-[1.02]' : 'hover:shadow-md hover:scale-[1.02]'
                  }`}
                  style={{ backgroundColor: isActive ? '#EEF2FF' : '#F9FAFB', border: `1px solid ${isActive ? '#A5B4FC' : '#E5E7EB'}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-1.5 rounded-lg ${sb.key === 'ALL' ? 'bg-gray-100' : 'bg-white'}`}>
                      <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`} />
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400">{txCount} tx</span>
                  </div>
                  <div className="text-[11px] font-medium text-gray-700 leading-tight mb-1">{sb.label}</div>
                  <div className="text-sm font-bold text-gray-900">{amount > 0 ? formatCurrency(amount) : '—'}</div>
                </button>
              );
            })}
          </div>

          {/* My Processed Payments */}
          <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  My Processed Payments {acceptedSummary.currentUser?.name ? `— ${acceptedSummary.currentUser.name}` : ''}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Transactions you personally processed</p>
              </div>
              <button onClick={() => setShowMyDetails(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
                {showMyDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showMyDetails ? 'Hide' : 'Show'}
              </button>
            </div>
            {loadingAcceptedSummary ? (
              <div className="flex justify-center py-6"><div className="animate-spin h-6 w-6 border-b-2 border-gray-400 rounded-full" /></div>
            ) : !showMyDetails ? (
              <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">Click "Show" to view your daily transactions</div>
            ) : filteredMyTransactions.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">No transactions for selected service/date</div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {filteredMyTransactions.map(item => (
                  <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{item.patientName}</p>
                          <p className="text-xs text-gray-500">{item.patientId || ''} • {new Date(item.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(item.amount)}</p>
                        <p className="text-xs text-gray-500">{item.paymentMethod}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.allocations.map(a => (
                        <span key={`${item.id}-${a.key}`} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          {a.label}: {formatCurrency(a.amount)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ───── CASH RECONCILIATION ───── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-indigo-500" />
            Cash Reconciliation
          </h2>
        </div>
        <div className="p-5">
          <div className="max-w-2xl mx-auto space-y-1">
            {[
              { label: 'Starting Cash', amount: session.startingCash, sign: '+', color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-500' },
              { label: 'Money Received Today', amount: calculatedTotals.totalReceived, sign: '+', color: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
              { label: 'Expenses', amount: calculatedTotals.totalExpenses, sign: '-', color: 'text-rose-600', bg: 'bg-rose-50', bar: 'bg-rose-500' },
              { label: 'Bank Deposits', amount: calculatedTotals.totalBankDeposit, sign: '-', color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500' },
            ].map((row, i) => {
              const maxVal = Math.max(session.startingCash + calculatedTotals.totalReceived, 1);
              const pct = Math.min((row.amount / maxVal) * 100, 100);
              return (
                <div key={i} className={`p-4 rounded-xl ${row.bg} border border-transparent`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">{row.label}</span>
                    <span className={`text-lg font-bold ${row.color}`}>{row.sign} {formatCurrency(row.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                    <div className={`h-full rounded-full ${row.bar} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 mt-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-indigo-700">Expected Cash in Drawer</p>
                  <p className="text-xs text-indigo-500 mt-0.5">Starting Cash + Received − Expenses − Deposits</p>
                </div>
                <span className="text-3xl font-bold text-indigo-900">{formatCurrency(calculatedTotals.currentCash)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───── TABS ───── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="border-b border-gray-100 px-5">
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'transactions', label: 'Transactions', icon: Wallet },
              { id: 'deposits', label: 'Bank Deposits', icon: Landmark },
              { id: 'expenses', label: 'Expenses', icon: Receipt },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition ${
                    isActive ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}>
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5">

          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-indigo-500" />
                  Recent Transactions
                </h3>
                <div className="space-y-2">
                  {(session.transactions || []).slice(0, 8).map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                        t.type === 'PAYMENT_RECEIVED' ? 'bg-emerald-100' : 'bg-red-100'
                      }`}>
                        {t.type === 'PAYMENT_RECEIVED' ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.description}</p>
                        <p className="text-xs text-gray-500">{t.type.replace(/_/g, ' ')} • {t.paymentMethod}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${t.type === 'PAYMENT_RECEIVED' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.type === 'PAYMENT_RECEIVED' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                        <p className="text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                  {(!session.transactions || session.transactions.length === 0) && (
                    <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">No transactions today</div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-rose-500" />
                  Recent Expenses
                </h3>
                <div className="space-y-2">
                  {(session.expenses || []).slice(0, 8).map(e => (
                    <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100 hover:bg-rose-100 transition">
                      <div className="h-9 w-9 rounded-xl bg-rose-100 flex items-center justify-center">
                        <MinusCircle className="h-4 w-4 text-rose-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{e.description}</p>
                        <p className="text-xs text-gray-500">{e.category.replace(/_/g, ' ')} {e.vendor ? `• ${e.vendor}` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-rose-600">-{formatCurrency(e.amount)}</p>
                        <p className="text-[10px] text-gray-400">{new Date(e.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                  {(!session.expenses || session.expenses.length === 0) && (
                    <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">No expenses recorded</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TRANSACTIONS TAB ═══ */}
          {activeTab === 'transactions' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                      className="pl-10 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
                  </div>
                  {selectedDate && <button onClick={() => setSelectedDate('')} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>}
                  <button onClick={fetchPatientReceipts} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">
                    <RefreshCw className="h-4 w-4" /> Refresh
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition">
                    <Download className="h-4 w-4" /> Excel
                  </button>
                  <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition">
                    <FileText className="h-4 w-4" /> PDF
                  </button>
                  <button onClick={handlePrintTransactions} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition">
                    <Printer className="h-4 w-4" /> Print
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" placeholder={`Search by ${searchType === 'name' ? 'patient name' : 'phone'}...`}
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
                </div>
                <select value={searchType} onChange={e => { setSearchType(e.target.value); setSearchQuery(''); }}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-400">
                  <option value="name">By Name</option>
                  <option value="phone">By Phone</option>
                </select>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {loadingPatientReceipts ? (
                <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 border-b-2 border-indigo-600 rounded-full" /></div>
              ) : patientReceipts.length === 0 ? (
                <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                  <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-base font-medium">{searchQuery ? 'No matching receipts found' : 'No receipts for this date'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patientReceipts.map((pd, i) => (
                    <div key={pd.patient?.id || i} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                              <User className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-gray-900">{pd.patient?.name}</h4>
                              <p className="text-sm text-gray-500 flex items-center gap-2">
                                {pd.patient?.mobile && <><PhoneIcon /> {pd.patient.mobile} <span className="text-gray-300">|</span></>}
                                {pd.patient?.id && <>ID: {pd.patient.id}</>}
                                {pd.visitCount > 0 && <> <span className="text-gray-300">|</span> {pd.visitCount} visit(s)</>}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-indigo-600">{formatCurrency(pd.totalAmount)}</div>
                            <button onClick={() => printPatientReceipt(pd)}
                              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">
                              <Printer className="h-4 w-4" /> Print Receipt
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              {['#', 'Service Name', 'Code', 'Qty', 'Unit Price', 'Total'].map(h => (
                                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(pd.services || []).map((s, j) => (
                              <tr key={j} className="hover:bg-gray-50">
                                <td className="px-5 py-3 text-gray-500">{j + 1}</td>
                                <td className="px-5 py-3 font-medium text-gray-900">{s.name}</td>
                                <td className="px-5 py-3 text-gray-500">{s.code || '—'}</td>
                                <td className="px-5 py-3 text-gray-500">{s.quantity}</td>
                                <td className="px-5 py-3 text-gray-500">{formatCurrency(s.unitPrice)}</td>
                                <td className="px-5 py-3 font-semibold text-gray-900">{formatCurrency(s.totalPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t-2 border-gray-200">
                              <td colSpan="5" className="px-5 py-3 text-right text-sm font-semibold text-gray-700">Total:</td>
                              <td className="px-5 py-3 text-right font-bold text-gray-900">{formatCurrency(pd.totalAmount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ BANK DEPOSITS TAB ═══ */}
          {activeTab === 'deposits' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-amber-500" />
                    Record Bank Deposit
                  </h3>
                  <p className="text-xs text-gray-500 mb-5">Log money transferred from cash drawer to bank</p>
                  <form onSubmit={handleAddDeposit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ETB)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input type="number" step="0.01" value={depositForm.amount} required
                          onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400" placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank / Wallet</label>
                      <BankMethodSelect value={depositForm.bankName} required
                        onChange={e => setDepositForm({ ...depositForm, bankName: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                      <input type="text" value={depositForm.accountNumber}
                        onChange={e => setDepositForm({ ...depositForm, accountNumber: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-400" placeholder="Optional" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Number</label>
                      <input type="text" value={depositForm.transactionNumber}
                        onChange={e => setDepositForm({ ...depositForm, transactionNumber: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-400" placeholder="Optional" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea value={depositForm.notes} rows={2}
                        onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-400" placeholder="Optional" />
                    </div>
                    <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-sm hover:from-amber-600 hover:to-amber-700 transition shadow-lg shadow-amber-200">
                      <PlusCircle className="h-4 w-4 inline mr-1.5" /> Record Deposit
                    </button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-3">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-amber-500" />
                  Deposit History
                </h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {(session.bankDeposits || []).length === 0 ? (
                    <div className="text-center py-12 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                      <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      No deposits recorded
                    </div>
                  ) : (
                    (session.bankDeposits || []).map(d => (
                      <div key={d.id} className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition">
                        <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{d.bankName}</p>
                          <p className="text-xs text-gray-500">{d.accountNumber ? `Account: ${d.accountNumber}` : ''} {d.transactionNumber ? `TXN: ${d.transactionNumber}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-amber-700">{formatCurrency(d.amount)}</p>
                          <p className="text-[10px] text-gray-400">{new Date(d.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ EXPENSES TAB ═══ */}
          {activeTab === 'expenses' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-rose-500" />
                    Record Expense
                  </h3>
                  <p className="text-xs text-gray-500 mb-5">Log cash paid out for clinic expenses</p>
                  <form onSubmit={handleAddExpense} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ETB)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input type="number" step="0.01" value={expenseForm.amount} required
                          onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400" placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select value={expenseForm.category}
                        onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-rose-400">
                        {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input type="text" value={expenseForm.description} required
                        onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-rose-400" placeholder="What was this for?" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vendor (Optional)</label>
                      <input type="text" value={expenseForm.vendor}
                        onChange={e => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-rose-400" placeholder="Paid to..." />
                    </div>
                    <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold text-sm hover:from-rose-600 hover:to-rose-700 transition shadow-lg shadow-rose-200">
                      <MinusCircle className="h-4 w-4 inline mr-1.5" /> Record Expense
                    </button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-3">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-rose-500" />
                  Expense History
                </h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {(session.expenses || []).length === 0 ? (
                    <div className="text-center py-12 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                      <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      No expenses recorded
                    </div>
                  ) : (
                    (session.expenses || []).map(e => (
                      <div key={e.id} className="flex items-center gap-4 p-4 rounded-xl bg-rose-50 border border-rose-100 hover:bg-rose-100 transition">
                        <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-rose-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{e.description}</p>
                          <p className="text-xs text-gray-500">{e.category.replace(/_/g, ' ')} {e.vendor ? `• ${e.vendor}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-rose-700">-{formatCurrency(e.amount)}</p>
                          <p className="text-[10px] text-gray-400">{new Date(e.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
};

const PhoneIcon = () => (
  <svg className="h-3.5 w-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export default DailyCashManagement;
