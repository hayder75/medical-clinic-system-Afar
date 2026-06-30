import React, { useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Scan, DollarSign } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const formatCurrency = (value) => `ETB ${Number(value || 0).toLocaleString()}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const RadiologistDailyWork = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [monthlyData, setMonthlyData] = useState([]);
  const [hasCommission, setHasCommission] = useState(false);
  const [commissionPct, setCommissionPct] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetails, setDayDetails] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);

  useEffect(() => {
    fetchMonthly();
    const interval = setInterval(fetchMonthly, 30000);
    return () => clearInterval(interval);
  }, [year, month]);

  // Auto-select today's date and fetch day details on mount
  useEffect(() => {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setSelectedDay(todayStr);
    fetchDayDetails(todayStr);
  }, []);

  const fetchMonthly = async () => {
    try {
      setLoading(true);
      const res = await api.get('/radiologies/daily-work/monthly', {
        params: { year, month: month + 1 },
      });
      setMonthlyData(res.data.daily || []);
      setHasCommission(res.data.hasCommission);
      setCommissionPct(res.data.commissionPct);
      setTotalOrders(res.data.totalOrders);
      setTotalCommission(res.data.totalCommission);
    } catch (err) {
      toast.error('Failed to load daily work');
    } finally {
      setLoading(false);
    }
  };

  const fetchDayDetails = async (date) => {
    try {
      setDayLoading(true);
      setSelectedDay(date);
      const res = await api.get('/radiologies/daily-work/day-details', {
        params: { date },
      });
      setDayDetails(res.data);
    } catch (err) {
      toast.error('Failed to load day details');
    } finally {
      setDayLoading(false);
    }
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const dayMap = {};
  monthlyData.forEach((d) => { dayMap[d.day] = d; });

  const selectedDayData = selectedDay ? dayMap[parseInt(selectedDay.split('-')[2])] : null;
  const selectedDayOrders = dayDetails?.orders || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <Scan className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">My Daily Work</h1>
              <p className="text-sm text-gray-500">Radiology orders completed</p>
            </div>
          </div>
          <button onClick={fetchMonthly} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <button onClick={() => { setMonth((m) => (m === 0 ? (setYear((y) => y - 1), 11) : m - 1)); setSelectedDay(null); setDayDetails(null); }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
            <ChevronLeft className="h-4 w-4" /> {MONTHS[month === 0 ? 11 : month - 1]}
          </button>
          <div className="text-lg font-bold text-gray-900">{MONTHS[month]} {year}</div>
          <button onClick={() => { setMonth((m) => (m === 11 ? (setYear((y) => y + 1), 0) : m + 1)); setSelectedDay(null); setDayDetails(null); }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
            {MONTHS[month === 11 ? 0 : month + 1]} <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Orders</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totalOrders}</p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">This Month</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{monthlyData.filter((d) => d.orders > 0).length} days</p>
          </div>
          {hasCommission && (
            <>
              <div className="rounded-xl border bg-purple-50 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">This Month</p>
                <p className="mt-1 text-2xl font-bold text-purple-700">{formatCurrency(totalCommission)}</p>
              </div>
              <div className="rounded-xl border bg-purple-50 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Your Share</p>
                <p className="mt-1 text-2xl font-bold text-purple-700">{commissionPct}%</p>
              </div>
            </>
          )}
        </div>

        {/* Day commission card */}
        {hasCommission && selectedDay && dayDetails?.summary?.totalCommission > 0 && (
          <div className="px-6 pb-2">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm inline-block">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-600">
                Commission for {selectedDay}
              </p>
              <p className="mt-1 text-2xl font-bold text-green-700">
                {formatCurrency(dayDetails.summary.totalCommission)}
              </p>
            </div>
          </div>
        )}

        {/* Calendar */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="px-6 pb-4">
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 text-center">{d}</div>
              ))}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white p-2 min-h-[70px]" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const data = dayMap[day];
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = selectedDay === dateStr;
                const isToday = dateStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                return (
                  <button key={day} onClick={() => fetchDayDetails(dateStr)}
                    className={`bg-white p-2 min-h-[70px] text-left transition border-b border-gray-100 ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50'}`}>
                    <div className={`text-xs font-bold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{day}</div>
                    {data && data.orders > 0 && (
                      <>
                        <div className="text-[10px] font-semibold text-gray-600">{data.orders} orders</div>
                        <div className="text-[10px] text-gray-500">{formatCurrency(data.totalPrice)}</div>
                        {hasCommission && data.commissionAmount > 0 && (
                          <div className="text-[10px] font-semibold text-purple-600">{formatCurrency(data.commissionAmount)}</div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Day Details */}
        {selectedDay && (
          <div className="border-t px-6 py-4">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Orders for {selectedDay}</h2>
            {dayLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : selectedDayOrders.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-4 text-center">No orders completed on this day</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Patient</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Test</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Price</th>
                      {hasCommission && <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Commission</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedDayOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{o.patientName}</td>
                        <td className="px-4 py-2.5 text-gray-700">{o.testName}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900 font-medium">{formatCurrency(o.price)}</td>
                        {hasCommission && (
                          <td className="px-4 py-2.5 text-right">
                            <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                              {formatCurrency(o.commissionAmount)} ({o.commissionPct}%)
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan="2" className="px-4 py-2.5 font-semibold text-gray-700">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                        {formatCurrency(dayDetails?.summary?.totalPrice || 0)}
                      </td>
                      {hasCommission && (
                        <td className="px-4 py-2.5 text-right font-bold text-purple-700">
                          {formatCurrency(dayDetails?.summary?.totalCommission || 0)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RadiologistDailyWork;