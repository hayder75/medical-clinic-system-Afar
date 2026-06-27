import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Save, Settings, X } from 'lucide-react';
import api from '../../services/api';
import {
  ACTIVE_DOCTOR_TAB_OPTIONS,
  COMPLETED_DOCTOR_TAB_OPTIONS,
  DOCTOR_WORKSPACE_PROFILES,
  DOCTOR_WORKSPACE_PROFILE_LABELS,
  TRIAGE_DOCTOR_TAB_OPTIONS,
  parseDoctorWorkspaceConfig
} from '../../utils/doctorWorkspace';

const SystemSettings = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    cardExpiryPeriodDays: '30',
    oldPatientRegistrationMode: false,
    enableDoctorTransfer: true,
    doctorWorkspaceConfig: parseDoctorWorkspaceConfig(null)
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/system-settings');
      const fetchedSettings = response.data.settings || {};

      setSettings({
      cardExpiryPeriodDays: fetchedSettings.cardExpiryPeriodDays?.value || '30',
      oldPatientRegistrationMode: String(fetchedSettings.oldPatientRegistrationMode?.value || 'false').toLowerCase() === 'true',
      enableDoctorTransfer: String(fetchedSettings.enableDoctorTransfer?.value || 'true').toLowerCase() === 'true',
        doctorWorkspaceConfig: parseDoctorWorkspaceConfig(fetchedSettings.doctorWorkspaceConfig?.value)
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to fetch system settings');
    } finally {
      setLoading(false);
    }
  };

  const updateDoctorWorkspaceConfig = (updater) => {
    setSettings((previous) => ({
      ...previous,
      doctorWorkspaceConfig: updater(previous.doctorWorkspaceConfig)
    }));
  };

  const toggleDoctorTab = (sectionKey, profile, tabId) => {
    updateDoctorWorkspaceConfig((previous) => {
      const currentTabs = previous[sectionKey][profile] || [];
      const nextTabs = currentTabs.includes(tabId)
        ? currentTabs.filter((entry) => entry !== tabId)
        : [...currentTabs, tabId];

      return {
        ...previous,
        [sectionKey]: {
          ...previous[sectionKey],
          [profile]: nextTabs
        }
      };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await api.put('/admin/system-settings/cardExpiryPeriodDays', {
        value: settings.cardExpiryPeriodDays,
        description: 'Number of days before a card expires after activation'
      });

      await api.put('/admin/system-settings/oldPatientRegistrationMode', {
        value: settings.oldPatientRegistrationMode,
        description: 'Enable old-patient registration mode so billing can waive card registration fee during migration'
      });

      await api.put('/admin/system-settings/doctorWorkspaceConfig', {
        value: JSON.stringify(settings.doctorWorkspaceConfig),
        description: 'Doctor workspace configuration for completed-visit review and role-based tab visibility'
      });

      await api.put('/admin/system-settings/enableDoctorTransfer', {
        value: settings.enableDoctorTransfer,
        description: 'Enable/disable the doctor-to-doctor patient transfer feature'
      });

      toast.success('System settings updated successfully');
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const renderTabMatrix = (title, description, sectionKey, tabOptions) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {DOCTOR_WORKSPACE_PROFILES.map((profile) => {
          const selectedTabs = settings.doctorWorkspaceConfig[sectionKey][profile] || [];
          return (
            <div key={profile} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-3">
                <p className="font-semibold text-gray-900">{DOCTOR_WORKSPACE_PROFILE_LABELS[profile]}</p>
                <p className="text-xs text-gray-500 mt-1">Visible tabs: {selectedTabs.length}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tabOptions.map((tab) => {
                  const checked = selectedTabs.includes(tab.id);
                  return (
                    <label
                      key={`${profile}-${sectionKey}-${tab.id}`}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDoctorTab(sectionKey, profile, tab.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-800">{tab.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-50 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 bg-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
          </div>
        ) : (
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(92vh-80px)]">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Expiry Period (Days)
                </label>
                <input
                  type="number"
                  value={settings.cardExpiryPeriodDays}
                  onChange={(event) => setSettings((previous) => ({ ...previous, cardExpiryPeriodDays: event.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                  step="1"
                  placeholder="30"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Cards deactivate automatically after this many days from activation date.
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Old Patient Registration Mode</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Billing registration shows an Old Patient option that creates card registration billing at 0 ETB.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings((previous) => ({ ...previous, oldPatientRegistrationMode: !previous.oldPatientRegistrationMode }))}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${settings.oldPatientRegistrationMode ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'}`}
                  >
                    {settings.oldPatientRegistrationMode ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-purple-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-purple-900">Doctor Transfer Feature</p>
                    <p className="text-xs text-purple-700 mt-1">
                      Enables the Transfer button on consultation pages so doctors can send patients to other doctors. Disabling hides the button.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings((previous) => ({ ...previous, enableDoctorTransfer: !previous.enableDoctorTransfer }))}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${settings.enableDoctorTransfer ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'}`}
                  >
                    {settings.enableDoctorTransfer ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Completed Visits Review Queue</p>
                  <p className="text-xs text-emerald-800 mt-1">
                    Adds a doctor-side completed queue and opens finished visits in restricted review mode.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateDoctorWorkspaceConfig((previous) => ({
                    ...previous,
                    completedVisitsEnabled: !previous.completedVisitsEnabled
                  }))}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${settings.doctorWorkspaceConfig.completedVisitsEnabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'}`}
                >
                  {settings.doctorWorkspaceConfig.completedVisitsEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-cyan-900">Triage Queue</p>
                  <p className="text-xs text-cyan-800 mt-1">
                    Controls whether doctors can open triage queue and use triage-mode consultation tab set.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateDoctorWorkspaceConfig((previous) => ({
                    ...previous,
                    triageQueueEnabled: !previous.triageQueueEnabled
                  }))}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${settings.doctorWorkspaceConfig.triageQueueEnabled ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'}`}
                >
                  {settings.doctorWorkspaceConfig.triageQueueEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>

            {renderTabMatrix(
              'Active Queue Tab Visibility',
              'Control which consultation tabs each doctor profile sees while working active patients from the queue.',
              'activeTabVisibility',
              ACTIVE_DOCTOR_TAB_OPTIONS
            )}

            {renderTabMatrix(
              'Completed Review Tab Visibility',
              'Control which consultation tabs appear when opening a patient from the completed queue. Tabs hidden in Active Queue settings remain hidden here too.',
              'completedTabVisibility',
              COMPLETED_DOCTOR_TAB_OPTIONS
            )}

            {renderTabMatrix(
              'Triage Queue Tab Visibility',
              'Control which consultation tabs appear when opening a patient from the triage queue. Tabs hidden in Active Queue settings remain hidden here too.',
              'triageTabVisibility',
              TRIAGE_DOCTOR_TAB_OPTIONS
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !settings.cardExpiryPeriodDays || parseInt(settings.cardExpiryPeriodDays, 10) <= 0}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemSettings;