import { useCallback, useEffect, useState } from 'react';
import { academicYearsService } from '../services/academicYearsService';

export function useAcademicYears() {
  const [savedAcademicYears, setSavedAcademicYears] = useState<string[]>([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState<string | null>(null);
  const [masterConnected, setMasterConnected] = useState(true);
  const [masterWarning, setMasterWarning] = useState<string | null>(null);
  const [masterLoading, setMasterLoading] = useState(true);
  const reloadAcademicYears = useCallback(async () => {
    setMasterLoading(true);
    const result = await academicYearsService.loadAcademicYears();
    setSavedAcademicYears(result.years);
    setActiveAcademicYear(result.activeYear);
    setMasterConnected(result.connected);
    setMasterWarning(result.warning);
    setMasterLoading(false);
    return result;
  }, []);

  useEffect(() => { void reloadAcademicYears(); }, [reloadAcademicYears]);

  return {
    savedAcademicYears,
    setSavedAcademicYears,
    activeAcademicYear,
    setActiveAcademicYear,
    masterConnected,
    masterWarning,
    masterLoading,
    reloadAcademicYears
  };
}
