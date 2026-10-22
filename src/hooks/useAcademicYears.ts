import { useCallback, useEffect, useState } from 'react';
import { academicYearsService } from '../services/academicYearsService';

export function useAcademicYears() {
  const [savedAcademicYears, setSavedAcademicYears] = useState<string[]>([]);
  const [masterConnected, setMasterConnected] = useState(true);
  const [masterWarning, setMasterWarning] = useState<string | null>(null);
  const [masterLoading, setMasterLoading] = useState(true);
  const reloadAcademicYears = useCallback(async () => {
    setMasterLoading(true);
    const result = await academicYearsService.loadAcademicYears();
    setSavedAcademicYears(result.years);
    setMasterConnected(result.connected);
    setMasterWarning(result.warning);
    setMasterLoading(false);
    return result;
  }, []);

  useEffect(() => { void reloadAcademicYears(); }, [reloadAcademicYears]);

  return {
    savedAcademicYears,
    setSavedAcademicYears,
    masterConnected,
    masterWarning,
    masterLoading,
    reloadAcademicYears
  };
}
