import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadClinicSettings, getClinicSettings } from '../services/clinicSettings';

const ClinicSettingsContext = createContext();

export function ClinicSettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClinicSettings().then(s => {
      setSettings(s);
      document.title = s?.name || 'Medical Clinic';
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    setLoading(true);
    const s = await loadClinicSettings();
    setSettings(s);
    setLoading(false);
  };

  return (
    <ClinicSettingsContext.Provider value={{ settings: settings || getClinicSettings(), loading, refresh }}>
      {children}
    </ClinicSettingsContext.Provider>
  );
}

export function useClinicSettings() {
  return useContext(ClinicSettingsContext);
}
