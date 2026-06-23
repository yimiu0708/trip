import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

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
  draftReady: boolean;
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

const RECALL_DRAFT_VERSION = 1;
const recallDraftKey = (userId: number) => `trip_recall_draft_v1:${userId}`;

interface RecallDraftV1 {
  version: 1;
  selectedCities: RecallCity[];
  selectedAttractionIds: number[];
}

function readRecallDraft(userId: number): RecallDraftV1 | null {
  try {
    const raw = localStorage.getItem(recallDraftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecallDraftV1>;
    const validCities = Array.isArray(parsed.selectedCities) && parsed.selectedCities.every((city) => (
      Number.isInteger(city?.id)
      && typeof city?.name === 'string'
      && Number.isInteger(city?.province_id)
      && typeof city?.province_name === 'string'
      && Number.isInteger(city?.total_attractions)
    ));
    const validAttractions = Array.isArray(parsed.selectedAttractionIds)
      && parsed.selectedAttractionIds.every((id) => Number.isInteger(id) && id > 0);
    if (parsed.version !== RECALL_DRAFT_VERSION || !validCities || !validAttractions) throw new Error('Invalid recall draft');
    return {
      version: RECALL_DRAFT_VERSION,
      selectedCities: parsed.selectedCities as RecallCity[],
      selectedAttractionIds: Array.from(new Set(parsed.selectedAttractionIds as number[])),
    };
  } catch {
    try {
      localStorage.removeItem(recallDraftKey(userId));
    } catch {
      // Ignore storage restrictions in private browsing modes.
    }
    return null;
  }
}

export function RecallProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [selectedCities, setSelectedCities] = useState<RecallCity[]>([]);
  const [selectedAttractionIds, setSelectedAttractionIds] = useState<number[]>([]);
  const [lastResult, setLastResult] = useState<RecallResult | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftActive, setDraftActive] = useState(false);
  const hydratedUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) {
      setDraftReady(false);
      return;
    }
    setLastResult(null);
    if (userId === null) {
      hydratedUserIdRef.current = null;
      setSelectedCities([]);
      setSelectedAttractionIds([]);
      setDraftActive(false);
      setDraftReady(true);
      return;
    }
    const draft = readRecallDraft(userId);
    hydratedUserIdRef.current = userId;
    setSelectedCities(draft?.selectedCities || []);
    setSelectedAttractionIds(draft?.selectedAttractionIds || []);
    setDraftActive(Boolean(draft));
    setDraftReady(true);
  }, [authLoading, userId]);

  useEffect(() => {
    if (!draftReady || userId === null || hydratedUserIdRef.current !== userId) return;
    try {
      if (!draftActive || selectedCities.length === 0) {
        localStorage.removeItem(recallDraftKey(userId));
        return;
      }
      const draft: RecallDraftV1 = {
        version: RECALL_DRAFT_VERSION,
        selectedCities,
        selectedAttractionIds,
      };
      localStorage.setItem(recallDraftKey(userId), JSON.stringify(draft));
    } catch {
      // Browsing can continue even if storage is unavailable.
    }
  }, [draftActive, draftReady, selectedAttractionIds, selectedCities, userId]);

  const value = useMemo<RecallState>(() => ({
    draftReady,
    selectedCity: selectedCities[0] || null,
    selectedCities,
    selectedAttractionIds,
    lastResult,
    setSelectedCity: (city) => {
      setDraftActive(Boolean(city));
      setSelectedCities(city ? [city] : []);
      setSelectedAttractionIds([]);
      setLastResult(null);
    },
    toggleCity: (city) => {
      setDraftActive(true);
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
      setDraftActive(true);
      setSelectedCities((prev) => prev.filter((item) => item.id !== cityId));
      setSelectedAttractionIds([]);
      setLastResult(null);
    },
    clearCities: () => {
      setDraftActive(false);
      setSelectedCities([]);
      setSelectedAttractionIds([]);
      setLastResult(null);
    },
    toggleAttraction: (id) => {
      setDraftActive(true);
      setSelectedAttractionIds((prev) => (
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      ));
    },
    clearAttractions: () => {
      setDraftActive(true);
      setSelectedAttractionIds([]);
    },
    setLastResult: (result) => {
      setLastResult(result);
      if (result) setDraftActive(false);
    },
    resetRecall: () => {
      setDraftActive(false);
      setSelectedCities([]);
      setSelectedAttractionIds([]);
      setLastResult(null);
    },
  }), [draftReady, lastResult, selectedAttractionIds, selectedCities]);

  return <RecallContext.Provider value={value}>{children}</RecallContext.Provider>;
}

export function useRecall() {
  const context = useContext(RecallContext);
  if (!context) throw new Error('useRecall must be used within RecallProvider');
  return context;
}
