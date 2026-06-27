import React, { useState, useEffect, useMemo } from 'react';
import { TestTube, X, CheckCircle, Search } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const LabOrdering = ({ visitId, patientId, patient, visit, onOrdersPlaced, existingOrders = [] }) => {
  const [organizedTests, setOrganizedTests] = useState({});
  const [selectedTestIds, setSelectedTestIds] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingTests, setFetchingTests] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLabTests();
  }, []);

  const fetchLabTests = async () => {
    try {
      setFetchingTests(true);
      const response = await api.get('/doctors/lab-tests/for-ordering');
      if (!response.data?.organized) {
        toast.error('Invalid response format from server');
        return;
      }
      setOrganizedTests(response.data.organized);
      const keys = Object.keys(response.data.organized);
      if (keys.length > 0) setActiveCategory(keys[0]);
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Lab tests endpoint not found.');
      } else if (error.response?.status === 403) {
        toast.error('Permission denied.');
      } else {
        toast.error(`Failed to fetch lab tests: ${error.message}`);
      }
    } finally {
      setFetchingTests(false);
    }
  };

  const handlePanelSelect = (panel) => {
    const ids = panel.tests.map(t => t.id).filter(id => !isTestOrdered(id));
    if (ids.length === 0) return;
    const allSelected = ids.every(id => selectedTestIds.has(id));
    setSelectedTestIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleTestSelect = (testId) => {
    if (isTestOrdered(testId)) return;
    setSelectedTestIds(prev => {
      const next = new Set(prev);
      next.has(testId) ? next.delete(testId) : next.add(testId);
      return next;
    });
  };

  const isTestOrdered = (testId) => {
    return existingOrders.some(order => {
      if (order.labTest) return order.labTest.id === testId;
      if (order.orders) return order.orders.some(o => o.labTest?.id === testId);
      if (order.services) return order.services.some(s => s.service?.id === testId);
      return false;
    });
  };

  const isPanelFullySelected = (panel) => {
    if (!panel.tests?.length) return false;
    return panel.tests.every(t => selectedTestIds.has(t.id));
  };

  const isPanelPartiallySelected = (panel) => {
    if (!panel.tests?.length) return false;
    const c = panel.tests.filter(t => selectedTestIds.has(t.id)).length;
    return c > 0 && c < panel.tests.length;
  };

  const getSelectedTests = () => {
    const result = [];
    Object.values(organizedTests).forEach(cat => {
      cat.panels?.forEach(panel => {
        panel.tests?.forEach(t => {
          if (selectedTestIds.has(t.id)) result.push({ ...t, groupName: panel.name, panelId: panel.id, panelPrice: panel.price || 0 });
        });
      });
      cat.standalone?.forEach(t => {
        if (selectedTestIds.has(t.id)) result.push(t);
      });
    });
    return result;
  };

  const handleSubmit = async () => {
    if (selectedTestIds.size === 0) { toast.error('Please select at least one lab test'); return; }
    setLoading(true);
    try {
      await api.post('/batch-orders/lab-tests', {
        visitId: parseInt(visitId),
        patientId: patientId.toString(),
        labTestIds: Array.from(selectedTestIds),
        instructions
      });
      toast.success(`Lab orders placed (${selectedTestIds.size} test(s))`);
      if (onOrdersPlaced) onOrdersPlaced();
      setSelectedTestIds(new Set());
      setInstructions('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to place lab orders');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const tests = getSelectedTests();
    const panelTotals = {};
    let total = 0;
    tests.forEach(t => {
      if (t.panelId) {
        if (!panelTotals[t.panelId]) {
          panelTotals[t.panelId] = t.panelPrice || 0;
        }
      } else {
        total += t.price || 0;
      }
    });
    Object.values(panelTotals).forEach(p => total += p);
    return total;
  };

  const allTestsFlat = useMemo(() => {
    const tests = [];
    Object.entries(organizedTests).forEach(([cat, data]) => {
      data.panels?.forEach(p => p.tests?.forEach(t => tests.push({ ...t, cat, panelName: p.name })));
      data.standalone?.forEach(t => tests.push({ ...t, cat }));
    });
    return tests;
  }, [organizedTests]);

  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return allTestsFlat.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.cat.toLowerCase().includes(q) ||
      t.panelName?.toLowerCase().includes(q)
    );
  }, [searchQuery, allTestsFlat]);

  if (fetchingTests) {
    return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /><span className="ml-2 text-gray-500">Loading lab tests...</span></div>;
  }

  const categoryKeys = Object.keys(organizedTests);
  const activeData = organizedTests[activeCategory] || { panels: [], standalone: [] };
  const selectedTests = getSelectedTests();
  const selectedCount = selectedTests.length;
  const total = calculateTotal();

  const renderTestRow = (test) => {
    const sel = selectedTestIds.has(test.id);
    const ord = isTestOrdered(test.id);
    return (
      <label key={test.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors bg-white ${ord ? 'opacity-30 cursor-not-allowed' : sel ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
        <input
          type="checkbox"
          checked={sel}
          disabled={ord}
          onChange={() => handleTestSelect(test.id)}
          className="w-4 h-4 text-indigo-600 rounded border-gray-300"
        />
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${sel ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{test.name}</span>
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">{test.price != null ? `${Number(test.price).toLocaleString()} ETB` : '-'}</span>
      </label>
    );
  };

  const renderPanelButton = (panel) => {
    const fullySel = isPanelFullySelected(panel);
    const partialSel = isPanelPartiallySelected(panel);
    const allOrdered = panel.tests?.every(t => isTestOrdered(t.id)) || false;
    return (
      <div key={panel.id} className="flex items-center gap-2">
        <button
          onClick={() => handlePanelSelect(panel)}
          disabled={allOrdered}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
            allOrdered ? 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed' :
            fullySel ? 'bg-indigo-700 text-white' : partialSel ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fullySel}
              disabled={allOrdered}
              ref={el => { if (el) el.indeterminate = partialSel && !fullySel; }}
              onChange={() => handlePanelSelect(panel)}
              className="w-4 h-4 rounded border-gray-300"
              onClick={e => e.stopPropagation()}
            />
            <span>{panel.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${allOrdered ? 'bg-gray-200 text-gray-500' : fullySel ? 'bg-white/20' : partialSel ? 'bg-white/20' : 'bg-indigo-200 text-indigo-800'}`}>{panel.tests?.length || 0}</span>
          </div>
        </button>
        {!allOrdered && partialSel && !fullySel && (
          <button
            onClick={() => handlePanelSelect(panel)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Select All
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-5 h-full">
      {/* Left: Categories */}
      <div className="w-48 flex-shrink-0 space-y-1">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Lab Categories</div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg mb-2 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-0.5 max-h-[calc(100vh-220px)] overflow-y-auto">
          {categoryKeys.map(cat => {
            const data = organizedTests[cat];
            const panelTestCount = data?.panels?.reduce((s, p) => s + (p.tests?.length || 0), 0) || 0;
            const standaloneCount = data?.standalone?.length || 0;
            const totalTests = panelTestCount + standaloneCount;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{cat}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{totalTests}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center: Panel Buttons + Flat Test List */}
      <div className="flex-1 min-w-0">
        {searchQuery && filteredTests ? (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">Search Results ({filteredTests.length})</div>
            <div className="p-2 max-h-[500px] overflow-y-auto">
              {filteredTests.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No matches</div>
              ) : (
                filteredTests.map(t => renderTestRow(t))
              )}
            </div>
          </div>
        ) : activeCategory ? (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">{activeCategory}</h3>

            {/* Panel Buttons */}
            {activeData.panels?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeData.panels.map(p => renderPanelButton(p))}
              </div>
            )}

            {/* All Tests Flat List */}
            <div>
              {activeData.panels?.length > 0 && activeData.standalone?.length > 0 && (
                <h4 className="text-sm font-semibold text-gray-600 mb-2">All Tests</h4>
              )}
              {(activeData.panels?.length > 0 || activeData.standalone?.length > 0) ? (
                <div className="grid grid-cols-2 gap-px bg-gray-200 rounded-xl overflow-hidden">
                  {activeData.panels?.map(p =>
                    p.tests?.map(t => renderTestRow(t))
                  )}
                  {activeData.standalone?.map(t => renderTestRow(t))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic py-8 text-center">No tests in this category</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic py-8 text-center">Select a category</div>
        )}
      </div>

      {/* Right: Selected Summary */}
      <div className="w-72 flex-shrink-0">
        <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-4 space-y-3">
          <div className="text-sm font-semibold text-gray-700 flex items-center justify-between">
            <span>Selected Tests</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{selectedCount}</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto space-y-1.5 -mx-1 px-1">
            {selectedTests.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-6">No tests selected</div>
            ) : (
              selectedTests.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-800 truncate">{t.name}</div>
                    <div className="text-gray-400 truncate">{t.groupName || ''}</div>
                  </div>
                  <button onClick={() => handleTestSelect(t.id)} className="ml-2 p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          {selectedCount > 0 && (
            <>
              <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm font-bold text-gray-900">
                <span>Total</span>
                <span>{total.toLocaleString()} ETB</span>
              </div>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={2}
                placeholder="Notes..."
                className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                {loading ? 'Ordering...' : `Order (${selectedCount})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LabOrdering;
