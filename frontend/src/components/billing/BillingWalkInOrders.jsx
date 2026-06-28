import React, { useState, useEffect, useMemo } from 'react';
import {
    UserPlus, User, Phone, TestTube, X, Check, AlertCircle,
    Scan, Search
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CATEGORY_ORDER = [
    'Head', 'Chest', 'Upper extremity', 'Abdomen', 'Back',
    'Pelvis', 'Lower limb', 'Angiography', 'CT Scan', 'Ultrasound'
];

const BillingWalkInOrders = () => {
    const [activeTab, setActiveTab] = useState('lab');
    const [formData, setFormData] = useState({
        name: '', phone: '', gender: '', age: '', bloodType: '',
        referringDoctor: '', notes: ''
    });
    const [selectedTestIds, setSelectedTestIds] = useState(new Set());
    const [organizedTests, setOrganizedTests] = useState({});
    const [radiologyTypes, setRadiologyTypes] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);

    // Lab sidebar state
    const [labActiveCategory, setLabActiveCategory] = useState(null);
    const [labSearchQuery, setLabSearchQuery] = useState('');

    // Radiology sidebar state
    const [radiologyActiveCategory, setRadiologyActiveCategory] = useState(null);
    const [radiologySearchQuery, setRadiologySearchQuery] = useState('');

    useEffect(() => {
        if (activeTab === 'lab') fetchLabTests();
        else fetchRadiologyTypes();
        setSelectedTestIds(new Set());
    }, [activeTab]);

    const fetchLabTests = async () => {
        try {
            setLoading(true);
            const response = await api.get('/labs/tests/for-ordering');
            if (response.data?.organized) {
                setOrganizedTests(response.data.organized);
                const keys = Object.keys(response.data.organized);
                if (keys.length > 0) setLabActiveCategory(keys[0]);
            }
        } catch (error) {
            toast.error('Failed to load lab tests');
        } finally {
            setLoading(false);
        }
    };

    const fetchRadiologyTypes = async () => {
        try {
            setLoading(true);
            const response = await api.get('/radiologies/investigation-types/organized');
            if (response.data?.organized) {
                setRadiologyTypes(response.data.organized);
                const keys = Object.keys(response.data.organized);
                if (keys.length > 0) setRadiologyActiveCategory(keys[0]);
            }
        } catch (error) {
            toast.error('Failed to load radiology types');
        } finally {
            setLoading(false);
        }
    };

    const handleTestSelect = (testId) => {
        setSelectedTestIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(testId)) newSet.delete(testId);
            else newSet.add(testId);
            return newSet;
        });
    };

    const handlePanelSelect = (group) => {
        const allTestIds = group.tests.map(test => test.id);
        const allSelected = allTestIds.every(id => selectedTestIds.has(id));
        setSelectedTestIds(prev => {
            const newSet = new Set(prev);
            allTestIds.forEach(id => {
                if (allSelected) newSet.delete(id);
                else newSet.add(id);
            });
            return newSet;
        });
    };

    const isPanelFullySelected = (group) => {
        if (!group.tests || group.tests.length === 0) return false;
        return group.tests.every(test => selectedTestIds.has(test.id));
    };

    const isPanelPartiallySelected = (group) => {
        if (!group.tests || group.tests.length === 0) return false;
        const selectedCount = group.tests.filter(test => selectedTestIds.has(test.id)).length;
        return selectedCount > 0 && selectedCount < group.tests.length;
    };

    const getSelectedLabTests = () => {
        const selected = [];
        Object.values(organizedTests).forEach(category => {
            category.panels?.forEach(panel => {
                panel.tests?.forEach(test => {
                    if (selectedTestIds.has(test.id)) selected.push({ ...test, groupName: panel.name, panelId: panel.id });
                });
            });
            category.standalone?.forEach(test => {
                if (selectedTestIds.has(test.id)) selected.push(test);
            });
        });
        return selected;
    };

    const getSelectedRadiologyTypes = () => {
        const selected = [];
        Object.entries(radiologyTypes).forEach(([cat, data]) => {
            data.tests?.forEach(test => {
                if (selectedTestIds.has(test.id)) selected.push({ ...test, category: cat });
            });
        });
        return selected;
    };

    // Lab flat list for search
    const allLabTestsFlat = useMemo(() => {
        const tests = [];
        Object.entries(organizedTests).forEach(([cat, data]) => {
            data.panels?.forEach(panel => {
                panel.tests?.forEach(t => tests.push({ ...t, cat, groupName: panel.name, panelPrice: panel.price }));
            });
            data.standalone?.forEach(t => tests.push({ ...t, cat }));
        });
        return tests;
    }, [organizedTests]);

    const filteredLabTests = useMemo(() => {
        if (!labSearchQuery.trim()) return null;
        const q = labSearchQuery.toLowerCase();
        return allLabTestsFlat.filter(t =>
            t.name.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q)
        );
    }, [labSearchQuery, allLabTestsFlat]);

    // Radiology flat list for search
    const allRadiologyTestsFlat = useMemo(() => {
        const tests = [];
        Object.entries(radiologyTypes).forEach(([cat, data]) => {
            data.tests?.forEach(t => tests.push({ ...t, cat }));
        });
        return tests;
    }, [radiologyTypes]);

    const filteredRadiologyTests = useMemo(() => {
        if (!radiologySearchQuery.trim()) return null;
        const q = radiologySearchQuery.toLowerCase();
        return allRadiologyTestsFlat.filter(t =>
            t.name.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q)
        );
    }, [radiologySearchQuery, allRadiologyTestsFlat]);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            toast.error('Please fill in patient name and phone number');
            return;
        }
        if (selectedTestIds.size === 0) {
            toast.error('Please select at least one test');
            return;
        }
        try {
            setSubmitting(true);
            if (activeTab === 'lab') {
                const response = await api.post('/walk-in-orders/lab', {
                    name: formData.name, phone: formData.phone, gender: formData.gender,
                    age: formData.age, bloodType: formData.bloodType,
                    referringDoctor: formData.referringDoctor,
                    labTestIds: Array.from(selectedTestIds), notes: formData.notes
                });
                toast.success(`Walk-in lab order created! ID: ${response.data.outsider.id}`);
            } else {
                const response = await api.post('/walk-in-orders/radiology', {
                    name: formData.name, phone: formData.phone, gender: formData.gender,
                    age: formData.age, bloodType: formData.bloodType,
                    referringDoctor: formData.referringDoctor,
                    testTypes: Array.from(selectedTestIds).map(id => parseInt(id)), notes: formData.notes
                });
                toast.success(`Walk-in radiology order created! ID: ${response.data.outsider.id}`);
            }
            setFormData({ name: '', phone: '', gender: '', age: '', bloodType: '', referringDoctor: '', notes: '' });
            setSelectedTestIds(new Set());
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create walk-in order');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedTests = activeTab === 'lab' ? getSelectedLabTests() : getSelectedRadiologyTypes();

    const totalPrice = useMemo(() => {
        if (activeTab !== 'lab') {
            return selectedTests.reduce((sum, test) => sum + (test.price || 0), 0);
        }
        const panelPrices = {};
        let total = 0;
        Object.values(organizedTests).forEach(category => {
            category.panels?.forEach(panel => {
                const hasSelected = panel.tests?.some(t => selectedTestIds.has(t.id));
                if (hasSelected && !panelPrices[panel.id]) {
                    panelPrices[panel.id] = panel.price || 0;
                }
            });
            category.standalone?.forEach(test => {
                if (selectedTestIds.has(test.id)) total += (test.price || 0);
            });
        });
        Object.values(panelPrices).forEach(p => total += p);
        return total;
    }, [activeTab, selectedTests, organizedTests, selectedTestIds]);

    const renderTestCheckbox = (test, panelPrice) => {
        const sel = selectedTestIds.has(test.id);
        return (
            <label key={test.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors bg-white ${sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <input type="checkbox" checked={sel} onChange={() => handleTestSelect(test.id)} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className={`text-sm ${sel ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{test.name}</span>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                    {panelPrice ? `${panelPrice.toLocaleString()} ETB` : test.price ? `${test.price.toLocaleString()} ETB` : '-'}
                </span>
            </label>
        );
    };

    const renderPanelButton = (panel) => {
        const fullySel = isPanelFullySelected(panel);
        const partialSel = isPanelPartiallySelected(panel);
        return (
            <button
                key={panel.id}
                type="button"
                onClick={() => handlePanelSelect(panel)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                    fullySel ? 'bg-blue-700 text-white' : partialSel ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
            >
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={fullySel}
                        ref={el => { if (el) el.indeterminate = partialSel && !fullySel; }}
                        onChange={() => handlePanelSelect(panel)}
                        className="w-4 h-4 rounded border-gray-300"
                        onClick={e => e.stopPropagation()}
                    />
                    <span>{panel.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${fullySel ? 'bg-white/20' : 'bg-blue-200 text-blue-800'}`}>{panel.tests?.length || 0}</span>
                </div>
            </button>
        );
    };

    const renderLabCategoryContent = (category) => {
        const data = organizedTests[category];
        if (!data) return null;
        const hasPanels = data.panels?.length > 0;
        const hasStandalone = data.standalone?.length > 0;
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">{category}</h3>
                {hasPanels && (
                    <div className="flex flex-wrap gap-2">
                        {data.panels.map(p => renderPanelButton(p))}
                    </div>
                )}
                <div>
                    {hasPanels && hasStandalone && (
                        <h4 className="text-sm font-semibold text-gray-600 mb-2">All Tests</h4>
                    )}
                    {(hasPanels || hasStandalone) ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 rounded-xl overflow-hidden">
                            {data.panels?.map(p =>
                                p.tests?.map(t => renderTestCheckbox(t, p.price))
                            )}
                            {data.standalone?.map(t => renderTestCheckbox(t))}
                        </div>
                    ) : (
                        <div className="text-sm text-gray-400 italic py-8 text-center">No tests in this category</div>
                    )}
                </div>
            </div>
        );
    };

    const renderLabCenter = () => {
        if (labSearchQuery && filteredLabTests) {
            return (
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">Search Results ({filteredLabTests.length})</div>
                    <div className="p-2 max-h-[500px] overflow-y-auto">
                        {filteredLabTests.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No matches</div> : filteredLabTests.map(t => renderTestCheckbox(t, t.panelPrice))}
                    </div>
                </div>
            );
        }
        if (!labActiveCategory) return <div className="text-sm text-gray-400 italic py-8 text-center">Select a category</div>;
        return renderLabCategoryContent(labActiveCategory);
    };

    const renderRadiologyCenter = () => {
        if (radiologySearchQuery && filteredRadiologyTests) {
            return (
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">Search Results ({filteredRadiologyTests.length})</div>
                    <div className="p-2 max-h-[500px] overflow-y-auto">
                        {filteredRadiologyTests.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No matches</div> : filteredRadiologyTests.map(t => renderTestCheckbox(t))}
                    </div>
                </div>
            );
        }
        if (!radiologyActiveCategory) return <div className="text-sm text-gray-400 italic py-8 text-center">Select a category</div>;
        const activeData = radiologyTypes[radiologyActiveCategory] || { tests: [] };
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">{radiologyActiveCategory}</h3>
                <div className="text-xs text-gray-500 mb-2">{activeData.tests?.length || 0} test(s) available</div>
                {activeData.tests?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 rounded-xl overflow-hidden">
                        {activeData.tests.map(test => renderTestCheckbox(test))}
                    </div>
                ) : (
                    <div className="text-sm text-gray-400 italic py-8 text-center">No tests in this category</div>
                )}
            </div>
        );
    };

    const categoryKeys = Object.keys(organizedTests);
    const radiologyCategoryKeys = Object.keys(radiologyTypes).sort(
        (a, b) => (CATEGORY_ORDER.indexOf(a) !== -1 ? CATEGORY_ORDER.indexOf(a) : 99) - (CATEGORY_ORDER.indexOf(b) !== -1 ? CATEGORY_ORDER.indexOf(b) : 99)
    );

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="bg-white rounded-xl shadow-md">
                {/* Header + Tabs */}
                <div className="flex items-center justify-between px-6 pt-6 pb-0">
                    <div className="flex items-center gap-3">
                        <UserPlus className="h-7 w-7 text-blue-600" />
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Walk-In Orders</h1>
                            <p className="text-sm text-gray-500">Create lab or radiology orders for walk-in patients</p>
                        </div>
                    </div>
                </div>
                <div className="flex border-b border-gray-200 px-6 mt-4">
                    <button onClick={() => setActiveTab('lab')} className={`flex items-center px-5 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'lab' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <TestTube className="h-4 w-4 mr-2" />Lab Tests
                    </button>
                    <button onClick={() => setActiveTab('radiology')} className={`flex items-center px-5 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'radiology' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <Scan className="h-4 w-4 mr-2" />Radiology
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Patient Info - compact row */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-semibold text-gray-700">Patient Information</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Phone *</label>
                                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                                    <option value="">-</option>
                                    <option value="MALE">Male</option>
                                    <option value="FEMALE">Female</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Age</label>
                                <input type="text" name="age" value={formData.age} onChange={handleInputChange} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. 45" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Blood Type</label>
                                <select name="bloodType" value={formData.bloodType} onChange={handleInputChange} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                                    <option value="">-</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Dr.</label>
                                <input type="text" name="referringDoctor" value={formData.referringDoctor} onChange={handleInputChange} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Optional" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                                <input type="text" name="notes" value={formData.notes} onChange={handleInputChange} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Optional" />
                            </div>
                        </div>
                    </div>

                    {/* Loading state */}
                    {loading && (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                            <p className="text-gray-500 mt-3 text-sm">Loading...</p>
                        </div>
                    )}

                    {/* Lab: 3-column doctor-style layout */}
                    {!loading && activeTab === 'lab' && categoryKeys.length > 0 && (
                        <div className="flex flex-col md:flex-row gap-5">
                            {/* Left sidebar: categories */}
                            <div className="w-full md:w-48 flex-shrink-0">
                                <div className="flex md:flex-col items-center md:items-stretch gap-2 mb-2">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:block px-2">Categories</div>
                                    <div className="relative flex-1 w-full">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                        <input type="text" value={labSearchQuery} onChange={e => setLabSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                </div>
                                <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto md:max-h-[500px] pb-2 md:pb-0">
                                    {categoryKeys.map(cat => {
                                        const data = organizedTests[cat];
                                        const count = (data?.panels?.reduce((s, p) => s + (p.tests?.length || 0), 0) || 0) + (data?.standalone?.length || 0);
                                        const isActive = labActiveCategory === cat;
                                        return (
                                            <button key={cat} type="button"
                                                onClick={() => { setLabActiveCategory(cat); setLabSearchQuery(''); }}
                                                className={`whitespace-nowrap md:whitespace-normal flex-shrink-0 md:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
                                            >
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="truncate">{cat}</span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{count}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* Center: tests */}
                            <div className="flex-1 min-w-0">
                                {renderLabCenter()}
                            </div>
                            {/* Right: selected summary */}
                            <div className="w-full md:w-64 flex-shrink-0">
                                <div className="bg-white border border-gray-200 rounded-xl p-4 md:sticky md:top-4 space-y-3">
                                    <div className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                        <span>Selected</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{selectedTests.length}</span>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto space-y-1.5 -mx-1 px-1">
                                        {selectedTests.length === 0 ? <div className="text-xs text-gray-400 text-center py-6">None selected</div> : (
                                            selectedTests.map(t => (
                                                <div key={t.id} className="flex items-center justify-between text-xs">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-gray-800 truncate">{t.name}</div>
                                                        {t.groupName && <div className="text-blue-500 truncate">{t.groupName}</div>}
                                                    </div>
                                                    <button type="button" onClick={() => handleTestSelect(t.id)} className="ml-2 p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {selectedTests.length > 0 && (
                                        <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm font-bold text-gray-900">
                                            <span>Total</span>
                                            <span>{totalPrice.toLocaleString()} ETB</span>
                                        </div>
                                    )}
                                    {activeTab === 'lab' && selectedTests.some(t => t.panelId) && (
                                        <div className="text-xs text-blue-600 text-center">Panel price charged once per panel</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && activeTab === 'lab' && categoryKeys.length === 0 && (
                        <p className="text-gray-500 text-center py-8 text-sm">No lab tests available</p>
                    )}

                    {/* Radiology: 3-column doctor-style layout */}
                    {!loading && activeTab === 'radiology' && radiologyCategoryKeys.length > 0 && (
                        <div className="flex flex-col md:flex-row gap-5">
                            {/* Left sidebar: categories */}
                            <div className="w-full md:w-48 flex-shrink-0">
                                <div className="flex md:flex-col items-center md:items-stretch gap-2 mb-2">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:block px-2">Categories</div>
                                    <div className="relative flex-1 w-full">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                        <input type="text" value={radiologySearchQuery} onChange={e => setRadiologySearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500" />
                                    </div>
                                </div>
                                <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto md:max-h-[500px] pb-2 md:pb-0">
                                    {radiologyCategoryKeys.map(cat => {
                                        const data = radiologyTypes[cat];
                                        const count = data?.tests?.length || 0;
                                        const isActive = radiologyActiveCategory === cat;
                                        return (
                                            <button key={cat} type="button"
                                                onClick={() => { setRadiologyActiveCategory(cat); setRadiologySearchQuery(''); }}
                                                className={`whitespace-nowrap md:whitespace-normal flex-shrink-0 md:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
                                            >
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="truncate">{cat}</span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{count}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* Center: tests */}
                            <div className="flex-1 min-w-0">
                                {renderRadiologyCenter()}
                            </div>
                            {/* Right: selected summary */}
                            <div className="w-full md:w-64 flex-shrink-0">
                                <div className="bg-white border border-gray-200 rounded-xl p-4 md:sticky md:top-4 space-y-3">
                                    <div className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                        <span>Selected</span>
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{selectedTests.length}</span>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto space-y-1.5 -mx-1 px-1">
                                        {selectedTests.length === 0 ? <div className="text-xs text-gray-400 text-center py-6">None selected</div> : (
                                            selectedTests.map(t => (
                                                <div key={t.id} className="flex items-center justify-between text-xs">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-gray-800 truncate">{t.name}</div>
                                                        {t.category && <div className="text-purple-500 truncate">{t.category}</div>}
                                                    </div>
                                                    <button type="button" onClick={() => handleTestSelect(t.id)} className="ml-2 p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {selectedTests.length > 0 && (
                                        <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm font-bold text-gray-900">
                                            <span>Total</span>
                                            <span>{totalPrice.toLocaleString()} ETB</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && activeTab === 'radiology' && radiologyCategoryKeys.length === 0 && (
                        <p className="text-gray-500 text-center py-8 text-sm">No radiology tests available</p>
                    )}

                    {/* Submit */}
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center text-xs text-gray-500">
                            <AlertCircle className="w-3.5 h-3.5 mr-1" />Order will appear in billing queue for payment
                        </div>
                        <button type="submit" disabled={submitting || selectedTestIds.size === 0}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm flex items-center gap-2 shadow-sm">
                            {submitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />}
                            {submitting ? 'Creating...' : `Create Order (${selectedTests.length})`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BillingWalkInOrders;
