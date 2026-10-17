import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Table } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Error } from '../../components/ui/Error';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { useSearchWithDebounce } from '../../hooks/useSearchWithDebounce';
import { formatDateTime } from '../../lib/date-format';

interface EmailLog {
  _id: string;
  to: string;
  subject: string;
  template?: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  sentAt?: string;
  createdAt: string;
}

export const EmailLogsPage = () => {
  const {
    value: searchQuery,
    setValue: setSearchQuery,
    debouncedValue: debouncedSearchQuery,
  } = useSearchWithDebounce('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.emailLogs.list({
      search: debouncedSearchQuery,
      status: statusFilter,
      from: dateFrom,
      to: dateTo,
    }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/email/logs', {
        search: debouncedSearchQuery,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        from: dateFrom,
        to: dateTo,
      }));
      return unwrapArray<EmailLog>(response.data);
    },
  });

  const columns = [
    {
      key: 'createdAt',
      header: 'Date',
      render: (log: EmailLog) => formatDateTime(log.createdAt),
    },
    { key: 'to', header: 'Recipient' },
    { key: 'subject', header: 'Subject' },
    {
      key: 'template',
      header: 'Template',
      render: (log: EmailLog) => log.template || 'N/A',
    },
    {
      key: 'status',
      header: 'Status',
      render: (log: EmailLog) => {
        const statusColors = {
          pending: 'bg-amber-500/20 text-amber-300',
          sent: 'bg-emerald-500/20 text-emerald-300',
          failed: 'bg-rose-500/20 text-rose-300',
        };
        return (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[log.status]}`}>
            {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
          </span>
        );
      },
    },
    {
      key: 'sentAt',
      header: 'Sent At',
      render: (log: EmailLog) => log.sentAt ? formatDateTime(log.sentAt) : 'N/A',
    },
    {
      key: 'error',
      header: 'Error',
      render: (log: EmailLog) => (
        log.error ? (
          <span className="text-rose-400 text-xs truncate max-w-xs block" title={log.error}>
            {log.error}
          </span>
        ) : (
          'N/A'
        )
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Email Logs</h1>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl">
          <Input
            placeholder="Search by recipient or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all" className="bg-slate-900 text-white">All Status</option>
            <option value="pending" className="bg-slate-900 text-white">Pending</option>
            <option value="sent" className="bg-slate-900 text-white">Sent</option>
            <option value="failed" className="bg-slate-900 text-white">Failed</option>
          </Select>

          <Input
            type="date"
            placeholder="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          <Input
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        {/* Email Logs Table */}
        {error ? (
          <Error message="Failed to load email logs" onRetry={() => { void refetch(); }} />
        ) : (
          <Table
            data={logs || []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No email logs found"
          />
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-xl">
            <p className="text-sm text-slate-500">Total Emails</p>
            <p className="text-2xl font-bold text-white">{logs?.length || 0}</p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-xl">
            <p className="text-sm text-slate-500">Successfully Sent</p>
            <p className="text-2xl font-bold text-emerald-400">
              {logs?.filter(log => log.status === 'sent').length || 0}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-xl">
            <p className="text-sm text-slate-500">Failed</p>
            <p className="text-2xl font-bold text-rose-400">
              {logs?.filter(log => log.status === 'failed').length || 0}
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
