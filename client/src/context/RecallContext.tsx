import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface RecallCity {
  id: number;
  name: string;
  province_id: number;
  province_name: string;
  total_attractions: number;
}

export interface RecallAttraction {
  id: number;
  name: string;
  city_id?: number;
  level?: string;
  province_name: string;
  city_name?: string;
  category_name?: string;
  tags?: { id: number; name: string }[];
}

export interface RecallResult {
  litIds: number[];
  skippedIds: number[];
  newAchievements: { id: number; name: string; display_name?: string }[];
  delta?: {
    provinces: number;
    cities: number;
    attractions: number;
    visits: number;
  };
  cumulative?: {
    provinces: number;
    cities: number;
    attractions: number;
  };
}

interface RecallState {
  selectedCity: RecallCity | null;
  selectedCities: RecallCity[];
  selectedAttractionIds: number[];
  lastResult: RecallResult | null;
  setSelectedCity: (city: RecallCity | null) => void;
  toggleCity: (city: RecallCity) => void;
  removeCity: (cityId: number) => void;
  clearCities: () => void;
  toggleAttraction: (id: number) => void;
  clearAttractions: () => void;
  setLastResult: (result: RecallResult | null) => void;
  resetRecall: () => void;
}

const RecallContext = createContext<RecallState | null>(null);

export function RecallProvider({ children }: { children: ReactNode }) {
  const [selectedCities, setSelectedCities] = useState<RecallCity[]>([]);
  const [selectedAttractionIds, setSelectedAttractionIds] = useState<number[]>([]);
  const [lastResult, setLastResult] = useState<RecallResult | null>(null);

  const value = useMemo<RecallState>(() => ({
    selectedCity: selectedCities[0] || null,
    selectedCities,
    selectedAttractionIds,
    lastResult,
    setSelectedCity: (city) => {
      setSelectedCities(city ? [city] : []);
      setSelectedAttractionIds([]);
      setLastResult(null);
    },
    toggleCity: (city) => {
      setSelectedCities((prev) => {
        const exists = prev.some((item) => item.id === city.id);
        if (exists) return prev.filter((item) => item.id !== city.id);
        if (prev.length >= 20) return prev;
        return [...prev, city];
      });
      setSelectedAttractionIds([]);
      setLastResult(null);
    },
    removeCity: (cityId) => {
      setSelectedCities((prev) => prev.filter((item) => item.id !== cityId));
      setSelectedAttractionIds([]);
      setLastResult(null);
    },
    clearCities: () => {
      setSelectedCities([]);
      setSelectedAttractionIds([]);
      setLastResult(null);
    },
    toggleAttraction: (id) => {
      setSelectedAttractionIds((prev) => (
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      ));
    },
    clearAttractions: () => setSelectedAttractionIds([]),
    setLastResult,
    resetRecall: () => {
      setSelectedCities([]);
      setSelectedAttractionIds([]);
      setLastResult(null);
    },
  }), [lastResult, selectedAttractionIds, selectedCities]);

  return <RecallContext.Provider value={value}>{children}</RecallContext.Provider>;
}

export function useRecall() {
  const context = useContext(RecallContext);
  if (!context) throw new Error('useRecall must be used within RecallProvider');
  return context;
}
