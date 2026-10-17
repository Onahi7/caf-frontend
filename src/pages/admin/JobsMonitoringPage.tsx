import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapArray, unwrapResponse } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Select } from '../../components/ui/Select';
import { Error } from '../../components/ui/Error';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { formatDateTime } from '../../lib/date-format';

interface Job {
  _id: string;
  name: string;
  type: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'delayed';
  data: Record<string, unknown>;
  progress?: number;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export const JobsMonitoringPage = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch jobs
  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.jobs.list({ status: statusFilter, type: typeFilter }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/jobs', {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      }));
      return unwrapArray<Job>(response.data);
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch queue stats
  const { data: stats, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: queryKeys.jobs.stats(),
    queryFn: async () => {
      const response = await apiClient.get('/jobs/stats');
      return unwrapResponse(response.data, {} as QueueStats);
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const columns = [
    { key: 'name', header: 'Job Name' },
    {
      key: 'type',
      header: 'Type',
      render: (job: Job) => (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300">
          {job.type}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (job: Job) => {
        const statusColors = {
          pending: 'bg-white/10 text-white/60',
          active: 'bg-blue-500/20 text-blue-300',
          completed: 'bg-emerald-500/20 text-emerald-300',
          failed: 'bg-rose-500/20 text-rose-300',
          delayed: 'bg-amber-500/20 text-amber-300',
        };
        return (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[job.status]}`}>
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        );
      },
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (job: Job) => (
        job.progress !== undefined ? (
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-blue-400 h-2 rounded-full"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        ) : (
          'N/A'
        )
      ),
    },
    {
      key: 'attempts',
      header: 'Attempts',
      render: (job: Job) => `${job.attempts} / ${job.maxAttempts}`,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (job: Job) => formatDateTime(job.createdAt),
    },
    {
      key: 'completedAt',
      header: 'Completed',
      render: (job: Job) => job.completedAt ? formatDateTime(job.completedAt) : 'N/A',
    },
    {
      key: 'error',
      header: 'Error',
      render: (job: Job) => (
        job.error ? (
          <span className="text-rose-400 text-xs truncate max-w-xs block" title={job.error}>
            {job.error}
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
          <h1 className="text-2xl font-bold text-white">Jobs Monitoring</h1>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 text-emerald-500 focus:ring-emerald-400/60 border-white/20 bg-slate-900 rounded"
              />
              <span className="ml-2 text-sm text-slate-300">Auto-refresh (5s)</span>
            </label>
            <Button onClick={() => { void refetch(); void refetchStats(); }}>
              Refresh
            </Button>
          </div>
        </div>

        {statsError && (
          <Error message="Failed to load queue statistics" onRetry={() => { void refetchStats(); }} />
        )}

        {/* Queue Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900/60 p-4 rounded-lg shadow border border-white/10">
              <p className="text-sm text-slate-500">Waiting</p>
              <p className="text-2xl font-bold text-white">{stats.waiting ?? 0}</p>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-lg shadow border border-white/10">
              <p className="text-sm text-slate-500">Active</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.active ?? 0}</p>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-lg shadow border border-white/10">
              <p className="text-sm text-slate-500">Completed</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.completed ?? 0}</p>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-lg shadow border border-white/10">
              <p className="text-sm text-slate-500">Failed</p>
              <p className="text-2xl font-bold text-rose-400">{stats.failed ?? 0}</p>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-lg shadow border border-white/10">
              <p className="text-sm text-slate-500">Delayed</p>
              <p className="text-2xl font-bold text-amber-400">{stats.delayed ?? 0}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="delayed">Delayed</option>
          </Select>

          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="email">Email</option>
            <option value="report">Report</option>
            <option value="inventory">Inventory</option>
            <option value="backup">Backup</option>
          </Select>
        </div>

        {/* Jobs Table */}
        {error ? (
          <Error message="Failed to load jobs" onRetry={() => { void refetch(); }} />
        ) : (
          <Table
            data={jobs || []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No jobs found"
          />
        )}
      </div>
    </AdminLayout>
  );
};
