import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { UserCheck, AlertCircle, CheckCircle2, Calendar, FileText, ListChecks } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import { formatDate } from '../../lib/date-format';

interface SettlementAdvance {
  id: string;
  referenceNumber: string;
  type: 'goods' | 'cash';
  totalAmount: number;
  outstandingAmount: number;
  advanceDate: string;
}

interface OutstandingByEmployee {
  total: number;
  advances: SettlementAdvance[];
}

interface SettlementResponse {
  employeeId: string;
  branchId?: string;
  canOffboard: boolean;
  outstandingAdvanceTotal: number;
  openAdvanceCount: number;
  openAdvances: SettlementAdvance[];
  blockReason?: string;
}

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
}

interface EmployeesWithAdvancesResult {
  rows: { employee: Employee; outstanding: OutstandingByEmployee }[];
  failed: Employee[];
}

export function FinanceFinalSettlementPage() {
  const branchId = useBranchStore((s) => getBranchId(s.selectedBranch));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const { format: fmt } = useCurrency();

  const employeesQuery = useQuery({
    queryKey: ['employees-for-settlement', branchId],
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/users', { branchId, limit: 200 }));
      return (res.data?.data || res.data || []) as Employee[];
    },
  });

  const employeesWithAdvances = useQuery({
    queryKey: ['employees-with-advances', branchId, employeesQuery.data?.map((e) => e._id).join(',')],
    queryFn: async (): Promise<EmployeesWithAdvancesResult> => {
      if (!employeesQuery.data || employeesQuery.data.length === 0) return { rows: [], failed: [] };
      const rows: { employee: Employee; outstanding: OutstandingByEmployee }[] = [];
      const failed: Employee[] = [];
      await Promise.all(
        employeesQuery.data.map(async (emp) => {
          try {
            const res = await apiClient.get(
              buildApiUrl(`/finance-manager/advances/by-employee/${emp._id}`, { branchId }),
            );
            const data = (res.data?.data || res.data) as OutstandingByEmployee;
            if (data.total > 0) {
              rows.push({ employee: emp, outstanding: data });
            }
          } catch {
            failed.push(emp);
          }
        }),
      );
      return { rows: rows.sort((a, b) => b.outstanding.total - a.outstanding.total), failed };
    },
    enabled: !!employeesQuery.data && employeesQuery.data.length > 0,
  });

  const settlementQuery = useQuery({
    queryKey: ['final-settlement', selectedEmployeeId, branchId],
    queryFn: async () => {
      if (!selectedEmployeeId) return null;
      const res = await apiClient.get(
        buildApiUrl(`/finance-manager/advances/settlement/${selectedEmployeeId}`, { branchId }),
      );
      return (res.data?.data || res.data) as SettlementResponse;
    },
    enabled: !!selectedEmployeeId,
  });

  const selectedEmployee = employeesQuery.data?.find((e) => e._id === selectedEmployeeId);
  const outstandingRows = employeesWithAdvances.data?.rows ?? [];
  const failedEmployees = employeesWithAdvances.data?.failed ?? [];

  return (
    <FinanceLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Final Settlement</h1>
          <p className="text-sm text-slate-400 mt-1">
            Check an employee's outstanding advances before off-boarding. Employees cannot be deactivated
            while they have unsettled advances.
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Select Employee</label>
          {employeesQuery.isLoading ? (
            <Loading />
          ) : employeesQuery.isError ? (
            <Error message="Failed to load employees" onRetry={() => { void employeesQuery.refetch(); }} />
          ) : (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full max-w-md rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
            >
              <option value="">-- Choose an employee --</option>
              {employeesQuery.data?.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.firstName} {emp.lastName} ({emp.username}) - {emp.role}
                </option>
              ))}
            </select>
          )}
        </div>

        {failedEmployees.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            <AlertCircle className="inline h-4 w-4 mr-2" />
            Could not check advances for {failedEmployees.length} employee(s):{' '}
            {failedEmployees.map((e) => `${e.firstName} ${e.lastName}`).join(', ')}. Their outstanding
            balances are not included in the list below.
          </div>
        )}

        {outstandingRows.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="mb-3 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-amber-300" />
              <h3 className="text-sm font-semibold text-amber-200">
                Employees with Outstanding Advances ({outstandingRows.length})
              </h3>
              <span className="ml-auto text-xs text-amber-300/80">
                Total: {fmt(outstandingRows.reduce((s, x) => s + x.outstanding.total, 0))}
              </span>
            </div>
            <Table
              data={outstandingRows}
              columns={[
                {
                  key: 'employee',
                  header: 'Employee',
                  render: (row) => (
                    <div>
                      <p className="text-white text-sm">{row.employee.firstName} {row.employee.lastName}</p>
                      <p className="text-xs text-slate-500">{row.employee.role}</p>
                    </div>
                  ),
                },
                {
                  key: 'username',
                  header: 'Username',
                  render: (row) => <span className="font-mono text-xs text-slate-400">{row.employee.username}</span>,
                },
                {
                  key: 'openAdvances',
                  header: 'Open Advances',
                  render: (row) => <span className="text-slate-300">{row.outstanding.advances.length}</span>,
                },
                {
                  key: 'outstanding',
                  header: 'Outstanding',
                  render: (row) => <span className="font-semibold text-rose-300">{fmt(row.outstanding.total)}</span>,
                },
                {
                  key: 'actions',
                  header: '',
                  render: (row) => (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedEmployeeId(row.employee._id)}>
                      Check
                    </Button>
                  ),
                },
              ]}
              emptyMessage="No employees with outstanding advances"
            />
          </div>
        )}

        {selectedEmployeeId && settlementQuery.isLoading && <Loading />}
        {settlementQuery.isError && (
          <Error message="Failed to load settlement" onRetry={() => { void settlementQuery.refetch(); }} />
        )}

        {settlementQuery.data && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {selectedEmployee?.firstName} {selectedEmployee?.lastName}
                  </h2>
                  <p className="text-sm text-slate-400">{selectedEmployee?.username}</p>
                </div>
                {settlementQuery.data.canOffboard ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Clear to off-board
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                    <AlertCircle className="h-4 w-4" />
                    Blocked from off-boarding
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
                  <p className="text-xs text-slate-500">Outstanding Total</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {fmt(settlementQuery.data.outstandingAdvanceTotal)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
                  <p className="text-xs text-slate-500">Open Advances</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {settlementQuery.data.openAdvanceCount}
                  </p>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {settlementQuery.data.canOffboard ? 'OK' : 'BLOCKED'}
                  </p>
                </div>
              </div>

              {settlementQuery.data.blockReason && (
                <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
                  <AlertCircle className="inline h-4 w-4 mr-2" />
                  {settlementQuery.data.blockReason}
                </div>
              )}
            </div>

            {settlementQuery.data.openAdvances.length > 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Open Advances</h3>
                <Table
                  data={settlementQuery.data.openAdvances}
                  columns={[
                    {
                      key: 'reference',
                      header: 'Reference',
                      render: (a) => (
                        <span className="font-mono text-xs text-slate-300">{a.referenceNumber}</span>
                      ),
                    },
                    {
                      key: 'type',
                      header: 'Type',
                      render: (a) => (
                        <span
                          className={`rounded-md px-2 py-1 text-xs ${
                            a.type === 'cash'
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-blue-500/10 text-blue-300'
                          }`}
                        >
                          {a.type}
                        </span>
                      ),
                    },
                    {
                      key: 'issued',
                      header: 'Issued',
                      render: (a) => (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Calendar className="h-3 w-3" />
                          {formatDate(a.advanceDate)}
                        </span>
                      ),
                    },
                    {
                      key: 'total',
                      header: 'Total',
                      render: (a) => (
                        <span className="text-slate-300">{fmt(a.totalAmount)}</span>
                      ),
                    },
                    {
                      key: 'outstanding',
                      header: 'Outstanding',
                      render: (a) => (
                        <span className="font-semibold text-rose-300">{fmt(a.outstandingAmount)}</span>
                      ),
                    },
                  ]}
                  emptyMessage="No open advances"
                />
                <div className="mt-4 rounded-md border border-slate-800 bg-slate-900 p-3 text-xs text-slate-400">
                  <FileText className="inline h-3 w-3 mr-1" />
                  To clear an outstanding advance, use the Advances page to record a repayment, return goods, or write it off.
                </div>
              </div>
            )}

            {settlementQuery.data.canOffboard && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm text-emerald-200">
                <UserCheck className="inline h-4 w-4 mr-2" />
                This employee can be safely deactivated. Proceed to the Users page to off-board them.
              </div>
            )}
          </div>
        )}
      </div>
    </FinanceLayout>
  );
}
