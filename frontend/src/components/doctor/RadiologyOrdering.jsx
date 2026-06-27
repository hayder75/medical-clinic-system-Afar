import React, { useState, useEffect, useMemo } from 'react';
import { Scan, X, CheckCircle, Search } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CATEGORY_ORDER = [
  'Head', 'Chest', 'Upper extremity', 'Abdomen', 'Back',
  'Pelvis', 'Lower limb', 'Angiography', 'CT Scan', 'Ultrasound'
];

const RadiologyOrdering = ({ visitId, patientId, onOrdersPlaced, existingOrders = [] }) => {
  const [organizedTests, setOrganizedTests] = useState({});
  const [selectedTests, setSelectedTests] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingTests, setFetchingTests] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRadiologyTests();
  }, []);

  const fetchRadiologyTests = async () => {
    try {
      setFetchingTests(true);
      const res = await api.get('/radiologies/investigation-types/organized');
      if (!res.data?.organized) { toast.error('Invalid response'); return; }
      setOrganizedTests(res.data.organized);
      const keys = Object.keys(res.data.organized);
      if (keys.length > 0) setActiveCategory(keys[0]);
    } catch (error) {
      toast.error(error.response?.status === 403 ? 'Permission denied.' : `Failed to load: ${error.message}`);
    } finally {
      setFetchingTests(false);
    }
  };

  const toggleTest = (test) => {
    const isAlreadyOrdered = isTestOrdered(test.id);
    if (isAlreadyOrdered) {
      toast.error('This test has already been ordered for this visit');
      return;
    }

    setSelectedTests(prev => {
      const isSelected = prev.some(t => t.id === test.id);
      if (isSelected) {
        return prev.filter(t => t.id !== test.id);
      } else {
        return [...prev, test];
      }
    });
  };

  const handleSubmitOrders = async () => {
    if (selectedTests.length === 0) {
      toast.error('Please select at least one radiology test');
      return;
    }

    setLoading(true);
    try {
      const batchOrderData = {
        visitId: parseInt(visitId),
        patientId,
        type: 'RADIOLOGY',
        instructions: instructions || 'Radiology tests ordered by doctor',
        services: selectedTests.map(test => ({
          serviceId: test.serviceId || test.id.toString(),
          investigationTypeId: test.id,
          instructions: instructions || `Radiology test: ${test.name}`
        }))
      };

      await api.post('/batch-orders/create', batchOrderData);

      toast.success(`${selectedTests.length} radiology test(s) ordered successfully`);

      setSelectedTests([]);
      setInstructions('');

      if (onOrdersPlaced) {
        onOrdersPlaced();
      }
    } catch (error) {
      console.error('Error ordering radiology tests:', error);
      toast.error(error.response?.data?.error || 'Failed to order radiology tests');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return selectedTests.reduce((sum, test) => sum + (test.price || 0), 0);
  };

  const isTestOrdered = (testId) => {
    return existingOrders.some(order =>
      order.services?.some(s =>
        s.investigationTypeId === testId || s.service?.id === testId
      )
    );
  };

  const allTestsFlat = useMemo(() => {
    const tests = [];
    Object.entries(organizedTests).forEach(([cat, data]) => {
      data.tests?.forEach(t => tests.push({ ...t, cat }));
    });
    return tests;
  }, [organizedTests]);

  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return allTestsFlat.filter(t =>
      t.name.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q)
    );
  }, [searchQuery, allTestsFlat]);

  if (fetchingTests) {
    return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /><span className="ml-2 text-gray-500">Loading...</span></div>;
  }

  const categoryKeys = Object.keys(organizedTests).sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a) !== -1 ? CATEGORY_ORDER.indexOf(a) : 99) - (CATEGORY_ORDER.indexOf(b) !== -1 ? CATEGORY_ORDER.indexOf(b) : 99)
  );
  const activeData = organizedTests[activeCategory] || { tests: [] };
  const selectedCount = selectedTests.length;
  const total = calculateTotal();

  const renderTestRow = (test) => {
    const sel = selectedTests.some(t => t.id === test.id);
    const ord = isTestOrdered(test.id);
    return (
      <label key={test.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors bg-white ${ord ? 'opacity-30 cursor-not-allowed' : sel ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
        <input
          type="checkbox"
          checked={sel}
          disabled={ord}
          onChange={() => !ord && toggleTest(test)}
          className="w-4 h-4 text-purple-600 rounded border-gray-300"
        />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`text-sm ${sel ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{test.name}</span>
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">{test.price ? `${test.price.toLocaleString()} ETB` : '-'}</span>
      </label>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-5">
      {/* Left: Categories — horizontal scroll on mobile, vertical sidebar on desktop */}
      <div className="w-full md:w-48 flex-shrink-0">
        <div className="flex md:flex-col items-center md:items-stretch gap-2 mb-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:block px-2">Categories</div>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
        <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto md:max-h-[calc(100vh-280px)] pb-2 md:pb-0">
          {categoryKeys.map(cat => {
            const data = organizedTests[cat];
            const totalT = data?.tests?.length || 0;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
                className={`whitespace-nowrap md:whitespace-normal flex-shrink-0 md:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{cat}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{totalT}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center: Tests */}
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
            <div className="text-xs text-gray-500 mb-2">{activeData.tests?.length || 0} test(s) available</div>
            {activeData.tests && activeData.tests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 rounded-xl overflow-hidden">
                {activeData.tests.map(test => renderTestRow(test))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic py-8 text-center">No tests in this category</div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic py-8 text-center">Select a category</div>
        )}
      </div>

      {/* Right: Selected Summary — below on mobile, sticky sidebar on desktop */}
      <div className="w-full md:w-72 flex-shrink-0">
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:sticky md:top-4 space-y-3">
          <div className="text-sm font-semibold text-gray-700 flex items-center justify-between">
            <span>Selected Tests</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{selectedCount}</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto space-y-1.5 -mx-1 px-1">
            {selectedTests.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-6">No tests selected</div>
            ) : (
              selectedTests.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-800 truncate">{t.name}</div>
                    <div className="text-gray-400 truncate">{t.cat}</div>
                  </div>
                  <button onClick={() => toggleTest(t)} className="ml-2 p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
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
                className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={handleSubmitOrders}
                disabled={loading}
                className="w-full py-2.5 text-sm font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Scan className="w-4 h-4" />
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

export default RadiologyOrdering;