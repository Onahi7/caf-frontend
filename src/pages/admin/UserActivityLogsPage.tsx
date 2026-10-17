import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Table } from '../../components/ui/Table';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Error } from '../../components/ui/Error';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { unwrapArray } from '../../lib/unwrap-response';
import { formatDateTime } from '../../lib/date-format';

interface UserActivityLog {
  _id: string;
  userId: string;
  userName: string;
  userRole: string;
  activity: string;
  description: string;
  branchId?: string;
  branchName?: string;
  duration?: number;
  ipAddress?: string;
  timestamp: string;
}

export const UserActivityLogsPage = () => {
  const [userFilter, setUserFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch user activity logs
  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.userActivityLogs.list({
      userId: userFilter,
      activity: activityFilter,
      from: dateFrom,
      to: dateTo,
    }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/audit/user-activity', {
        userId: userFilter !== 'all' ? userFilter : undefined,
        activity: activityFilter !== 'all' ? activityFilter : undefined,
        from: dateFrom,
        to: dateTo,
      }));
      return unwrapArray<UserActivityLog>(response.data);
    },
  });

  // Fetch users for filter
  const { data: users } = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async () => {
      const response = await apiClient.get('/users');
      return unwrapArray<{
        _id: string;
        firstName: string;
        lastName: string;
        username?: string;
      }>(response.data);
    },
  });

  const columns = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (log: UserActivityLog) => formatDateTime(log.timestamp),
    },
    {
      key: 'userName',
      header: 'User',
      render: (log: UserActivityLog) => (
        <div>
          <p className="font-medium">{log.userName}</p>
          <p className="text-xs text-slate-500">{log.userRole}</p>
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'Activity',
      render: (log: UserActivityLog) => {
        const activityColors: Record<string, string> = {
          login: 'bg-emerald-500/20 text-emerald-300',
          logout: 'bg-white/10 text-white/60',
          'shift-open': 'bg-blue-500/20 text-blue-300',
          'shift-close': 'bg-purple-500/20 text-purple-300',
          sale: 'bg-amber-500/20 text-amber-300',
          return: 'bg-rose-500/20 text-rose-300',
        };
        return (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${activityColors[log.activity] || 'bg-white/10 text-white/60'}`}>
            {log.activity.replace('-', ' ').toUpperCase()}
          </span>
        );
      },
    },
    {
      key: 'description',
      header: 'Description',
      render: (log: UserActivityLog) => (
        <span className="text-sm text-slate-300">{log.description}</span>
      ),
    },
    {
      key: 'branchName',
      header: 'Branch',
      render: (log: UserActivityLog) => log.branchName || 'N/A',
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (log: UserActivityLog) => {
        if (!log.duration) return 'N/A';
        const hours = Math.floor(log.duration / 3600);
        const minutes = Math.floor((log.duration % 3600) / 60);
        return `${hours}h ${minutes}m`;
      },
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (log: UserActivityLog) => (
        <span className="text-xs text-slate-500">{log.ipAddress || 'N/A'}</span>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">User Activity Logs</h1>
        </div>

        {/* Filters */}
        <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            >
              <option value="all" className="bg-slate-900 text-white">All Users</option>
              {users?.map((user) => (
                <option key={user._id} value={user._id} className="bg-slate-900 text-white">
                  {`${user.firstName} ${user.lastName}`.trim() || user.username || 'Unknown User'}
                </option>
              ))}
            </Select>

            <Select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
            >
              <option value="all" className="bg-slate-900 text-white">All Activities</option>
              <option value="login" className="bg-slate-900 text-white">Login</option>
              <option value="logout" className="bg-slate-900 text-white">Logout</option>
              <option value="sale" className="bg-slate-900 text-white">Sale</option>
              <option value="return" className="bg-slate-900 text-white">Return</option>
              <option value="shift-open" className="bg-slate-900 text-white">Shift Opened</option>
              <option value="shift-close" className="bg-slate-900 text-white">Shift Closed</option>
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
        </div>

        {/* Activity Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-xl">
            <p className="text-sm text-slate-500">Total Activities</p>
            <p className="text-2xl font-bold text-white">{logs?.length || 0}</p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-xl">
            <p className="text-sm text-slate-500">Logins</p>
            <p className="text-2xl font-bold text-emerald-400">
              {logs?.filter(log => log.activity === 'login').length || 0}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-xl">
            <p className="text-sm text-slate-500">Sales</p>
            <p className="text-2xl font-bold text-amber-400">
              {logs?.filter(log => log.activity === 'sale').length || 0}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-xl">
            <p className="text-sm text-slate-500">Active Users</p>
            <p className="text-2xl font-bold text-blue-400">
              {new Set(logs?.map(log => log.userId)).size || 0}
            </p>
          </div>
        </div>

        {/* Activity Logs Table */}
        {error ? (
          <Error message="Failed to load user activity logs" onRetry={() => { void refetch(); }} />
        ) : (
          <Table
            data={logs || []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No activity logs found"
          />
        )}
      </div>
    </AdminLayout>
  );
};
