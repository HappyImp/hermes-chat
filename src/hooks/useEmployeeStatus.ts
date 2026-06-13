import { useState, useEffect, useCallback } from 'react';
import type { Employee } from '@/types/employee';
import employeesData from '@/data/employees.json';

const typedEmployees = employeesData.employees as unknown as Employee[];

export function useEmployeeStatus() {
  const [employees, setEmployees] = useState<Employee[]>(typedEmployees);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refresh = useCallback(() => {
    // In the future this could fetch from a real API
    setEmployees(typedEmployees);
    setLastUpdated(new Date());
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { employees, lastUpdated, refresh };
}
