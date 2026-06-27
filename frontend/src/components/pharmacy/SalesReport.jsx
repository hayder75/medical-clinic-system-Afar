import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { ChevronLeft, ChevronRight, ShoppingCart, Pill, DollarSign, Printer, Eye, Calendar } from 'lucide-react';

const SalesReport = () => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(today); d.setHours(0,0,0,0); return d;
  });
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState(null);

  const dateStr = useMemo(() => {
    return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  }, [selectedDate]);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const from = new Date(selectedDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(selectedDate);
      to.setHours(23, 59, 59, 999);
      const response = await api.get(`/pharmacy-billing/invoices?dateFrom=${from.toISOString()}&dateTo=${to.toISOString()}`);
      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const goToToday = () => {
    setSelectedDate(new Date(today));
  };

  const handleDateChange = (e) => {
    const parts = e.target.value.split('-');
    if (parts.length === 3) {
      setSelectedDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    }
  };

  const isToday = selectedDate.toDateString() === today.toDateString();

  const getCustomerName = (inv) => {
    if (inv.patient?.name) return inv.patient.name;
    if (inv.notes?.startsWith('Walk-in:')) {
      const rest = inv.notes.replace('Walk-in:', '').trim();
      return rest.split('(')[0].trim() || 'Walk-in Customer';
    }
    return 'Walk-in Customer';
  };

  const getCustomerId = (inv) => {
    if (inv.patient?.id) return inv.patient.id;
    return 'Walk-in';
  };

  const stats = useMemo(() => {
    const walkIn = invoices.filter(i => i.type === 'WALK_IN_SALE');
    const prescription = invoices.filter(i => i.type === 'DOCTOR_PRESCRIPTION');
    return {
      total: invoices.reduce((s, i) => s + i.totalAmount, 0),
      walkInTotal: walkIn.reduce((s, i) => s + i.totalAmount, 0),
      prescriptionTotal: prescription.reduce((s, i) => s + i.totalAmount, 0),
      walkInCount: walkIn.length,
      prescriptionCount: prescription.length,
      totalCount: invoices.length,
    };
  }, [invoices]);

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const handlePrint = (inv) => {
    const w = window.open('', '_blank');
    const name = getCustomerName(inv).toUpperCase();
    const itemsHtml = (inv.pharmacyInvoiceItems || []).map(item => `
      <div class="item-row">
        <span class="item-name">${item.name} ${item.strength ? '- ' + item.strength : ''} (${item.dosageForm})</span>
        <span class="item-qty">${item.quantity}</span>
        <span class="item-price">ETB ${item.totalPrice.toLocaleString()}</span>
      </div>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt - ${name}</title>
      <style>
        @media print { @page { size: 80mm 297mm; margin: 0; } body { margin: 0; padding: 0; } }
        body { font-family: 'Segoe UI', sans-serif; margin: 0; color: #333; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; }
        .receipt-container { width: 72mm; min-height: 100mm; background: white; padding: 4mm; box-sizing: border-box; }
        .header { text-align: center; border-bottom: 1px solid #2563eb; padding-bottom: 4px; margin-bottom: 6px; }
        .clinic-name { font-size: 12px; font-weight: 800; margin: 0; color: #1e40af; }
        .receipt-title { font-size: 10px; font-weight: 700; margin: 2px 0; text-transform: uppercase; }
        .info-row { font-size: 9px; margin-bottom: 4px; padding: 3px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 2px; }
        .info-label { font-weight: 700; color: #64748b; }
        .item-row { display: flex; justify-content: space-between; font-size: 9px; padding: 2px 0; border-bottom: 1px dashed #e2e8f0; }
        .item-name { font-weight: 600; flex: 1; }
        .item-qty { width: 30px; text-align: center; }
        .item-price { width: 70px; text-align: right; }
        .total-section { margin-top: 6px; border-top: 1px solid #2563eb; padding-top: 4px; }
        .total-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #1e3a8a; }
        .footer { margin-top: 8px; text-align: center; font-size: 8px; color: #64748b; }
      </style></head><body>
      <div class="receipt-container">
        <div class="header">
          <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
          <h2 class="receipt-title">Pharmacy Receipt</h2>
          <div style="font-size: 8px; color: #64748b;">${selectedDate.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })} ${formatTime(inv.createdAt)}</div>
        </div>
        <div class="info-row">
          <span class="info-label">Customer:</span> ${name} &nbsp;|&nbsp; <span class="info-label">ID:</span> #${getCustomerId(inv)}
          &nbsp;|&nbsp; <span class="info-label">Invoice:</span> #${inv.invoiceNumber || inv.id.substring(0, 8)}
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 8px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
          <span style="flex: 1;">Item</span>
          <span style="width: 30px; text-align: center;">Qty</span>
          <span style="width: 70px; text-align: right;">Amount</span>
        </div>
        ${itemsHtml}
        <div class="total-section">
          <div class="total-row"><span>TOTAL</span><span>ETB ${inv.totalAmount.toLocaleString()}</span></div>
        </div>
        <div class="footer">${window.__CS__?.tagline || 'Thank you'}</div>
      </div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Daily Sales Report</h2>
          <p className="text-gray-600">Pharmacy sales for a specific day</p>
        </div>
        <button onClick={fetchInvoices} className="btn btn-sm btn-outline">Refresh</button>
      </div>

      {/* Date Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-center gap-4">
          <button onClick={goToPrevDay} className="btn btn-square btn-sm btn-ghost">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <input
              type="date"
              className="input input-sm text-center font-medium"
              value={dateStr}
              onChange={handleDateChange}
            />
            {!isToday && (
              <button onClick={goToToday} className="btn btn-sm btn-primary">
                Today
              </button>
            )}
            {isToday && (
              <span className="badge badge-success badge-sm">Today</span>
            )}
          </div>
          <button
            onClick={goToNextDay}
            disabled={isToday}
            className={`btn btn-square btn-sm btn-ghost ${isToday ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-50">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">ETB {stats.total.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-green-50">
              <ShoppingCart className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Walk-in Sales</p>
              <p className="text-2xl font-bold text-gray-900">ETB {stats.walkInTotal.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{stats.walkInCount} transaction{stats.walkInCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-purple-50">
              <Pill className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Prescription Sales</p>
              <p className="text-2xl font-bold text-gray-900">ETB {stats.prescriptionTotal.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{stats.prescriptionCount} transaction{stats.prescriptionCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-50">
              <Calendar className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{invoices.length > 0 ? 'All Transactions' : 'No Sales'}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCount}</p>
              <p className="text-xs text-gray-400">
                {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
          <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No sales on this day</p>
          <p>Select a different date to view sales</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-xs uppercase tracking-wider text-gray-500">Time</th>
                  <th className="text-xs uppercase tracking-wider text-gray-500">Customer</th>
                  <th className="text-xs uppercase tracking-wider text-gray-500">ID</th>
                  <th className="text-xs uppercase tracking-wider text-gray-500">Type</th>
                  <th className="text-xs uppercase tracking-wider text-gray-500">Items</th>
                  <th className="text-xs uppercase tracking-wider text-gray-500">Amount</th>
                  <th className="text-xs uppercase tracking-wider text-gray-500">Status</th>
                  <th className="text-xs uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <React.Fragment key={inv.id}>
                    <tr
                      onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="text-sm text-gray-600 whitespace-nowrap">{formatTime(inv.createdAt)}</td>
                      <td><p className="font-medium text-sm">{getCustomerName(inv)}</p></td>
                      <td className="text-sm text-gray-500 font-mono">{getCustomerId(inv)}</td>
                      <td>
                        <span className={`badge badge-sm ${inv.type === 'WALK_IN_SALE' ? 'badge-success' : 'badge-info'}`}>
                          {inv.type === 'WALK_IN_SALE' ? 'Walk-in' : 'Prescription'}
                        </span>
                      </td>
                      <td className="text-sm">{inv.pharmacyInvoiceItems?.length || 0}</td>
                      <td className="font-semibold text-sm">ETB {inv.totalAmount.toLocaleString()}</td>
                      <td>
                        <span className={`badge badge-sm ${inv.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handlePrint(inv); }} className="btn btn-ghost btn-xs" title="Print receipt">
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id); }} className="btn btn-ghost btn-xs" title="View items">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedInvoice === inv.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="p-4">
                          <div className="text-sm">
                            <p className="font-semibold text-gray-700 mb-2">Medications ({inv.pharmacyInvoiceItems?.length || 0})</p>
                            {(!inv.pharmacyInvoiceItems || inv.pharmacyInvoiceItems.length === 0) ? (
                              <p className="text-gray-400 italic">No item details</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="table table-xs">
                                  <thead>
                                    <tr className="text-gray-500">
                                      <th>Name</th>
                                      <th>Dosage</th>
                                      <th>Strength</th>
                                      <th>Qty</th>
                                      <th>Unit Price</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.pharmacyInvoiceItems.map((item, idx) => (
                                      <tr key={idx}>
                                        <td className="font-medium">{item.name}</td>
                                        <td>{item.dosageForm}</td>
                                        <td>{item.strength}</td>
                                        <td>{item.quantity}</td>
                                        <td>ETB {item.unitPrice.toFixed(2)}</td>
                                        <td>ETB {item.totalPrice.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            <div className="mt-2 text-right font-bold text-gray-800">
                              Total: ETB {inv.totalAmount.toLocaleString()}
                            </div>
                            {inv.notes && <p className="mt-1 text-xs text-gray-400">Notes: {inv.notes}</p>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
