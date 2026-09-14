import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { useSearchWithDebounce } from '../../hooks/useSearchWithDebounce';

interface AuditLog {
  _id: string;
  action: string;
  entity: string;
  entityId: string;
  userName: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

const getAuditEventLabel = (log: AuditLog) => {
  if (log.metadata?.event === 'manual_discount_applied') {
    const receipt = String(log.metadata.receiptNumber || 'sale');
    const amount = Number(log.metadata.manualDiscount || 0);
    return `Staff discount: ${amount.toFixed(2)} · ${receipt}`;
  }
  return log.action;
};

export const AuditTrailPage = () => {
  const {
    value: searchQuery,
    setValue: setSearchQuery,
    debouncedValue: debouncedSearchQuery,
  } = useSearchWithDebounce('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch audit logs
  const { data: logs, isLoading, error } = useQuery({
    queryKey: queryKeys.auditLogs.list({
      search: debouncedSearchQuery,
      action: actionFilter,
      entity: entityFilter,
      dateFrom,
      dateTo,
    }),
    queryFn: async () => {
      const response = await apiClient.get(
        buildApiUrl('/audit/logs', {
          action: actionFilter !== 'all' ? actionFilter : undefined,
          resource: entityFilter !== 'all' ? entityFilter : undefined,
          startDate: dateFrom,
          endDate: dateTo,
          limit: 200,
        }),
      );

      const rawLogs = (response.data?.data || []) as Array<Record<string, unknown>>;

      const mapped = rawLogs.map((log) => ({
        _id: String(log._id || ''),
        action: String(log.action || ''),
        entity: String(log.resource || ''),
        entityId: String(log.resourceId || ''),
        userName: String(log.username || 'Unknown'),
        previousData: (log.previousData || undefined) as
          | Record<string, unknown>
          | undefined,
        newData: (log.newData || undefined) as Record<string, unknown> | undefined,
        metadata: (log.metadata || undefined) as Record<string, unknown> | undefined,
        ipAddress: log.ipAddress ? String(log.ipAddress) : undefined,
        userAgent: log.userAgent ? String(log.userAgent) : undefined,
        timestamp: String(log.createdAt || new Date().toISOString()),
      })) as AuditLog[];

      if (!debouncedSearchQuery) {
        return mapped;
      }

      const needle = debouncedSearchQuery.toLowerCase();
      return mapped.filter(
        (log) =>
          log.userName.toLowerCase().includes(needle) ||
          log.entity.toLowerCase().includes(needle) ||
          log.entityId.toLowerCase().includes(needle) ||
          log.action.toLowerCase().includes(needle) ||
          getAuditEventLabel(log).toLowerCase().includes(needle),
      );
    },
  });

  const exportedLogs = useMemo(() => logs || [], [logs]);

  const handleExport = () => {
    const escapeCsv = (value: unknown) => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'timestamp',
      'user',
      'action',
      'resource',
      'resourceId',
      'event',
      'ipAddress',
      'userAgent',
    ];

    const rows = exportedLogs.map((log) => [
      log.timestamp,
      log.userName,
      log.action,
      log.entity,
      log.entityId,
      getAuditEventLabel(log),
      log.ipAddress || '',
      log.userAgent || '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `audit-trail-${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><Error message="Failed to load audit logs" /></AdminLayout>;

  const columns = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (log: AuditLog) => new Date(log.timestamp).toLocaleString(),
    },
    { key: 'userName', header: 'User' },
    {
      key: 'action',
      header: 'Action',
      render: (log: AuditLog) => {
        const actionColors: Record<string, string> = {
          create: 'bg-green-500/20 text-green-300',
          update: 'bg-blue-500/20 text-blue-300',
          delete: 'bg-red-500/20 text-red-300',
          login: 'bg-purple-500/20 text-purple-300',
          logout: 'bg-white/10 text-white/60',
        };
        return (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${actionColors[log.action] || 'bg-white/10 text-white/60'}`}>
            {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
          </span>
        );
      },
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (log: AuditLog) => (
        <span className="font-medium">{log.entity}</span>
      ),
    },
    {
      key: 'entityId',
      header: 'Entity ID',
      render: (log: AuditLog) => (
        <span className="text-xs text-gray-500">{log.entityId}</span>
      ),
    },
    {
      key: 'event',
      header: 'Event',
      render: (log: AuditLog) => (
        <span className={log.metadata?.event === 'manual_discount_applied' ? 'font-semibold text-amber-300' : 'text-white/70'}>
          {getAuditEventLabel(log)}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (log: AuditLog) => log.ipAddress || 'N/A',
    },
    {
      key: 'actions',
      header: 'Details',
      render: (log: AuditLog) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSelectedLog(log)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
          <Button onClick={handleExport}>
            Export to CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-primary-dark/50 border border-white/10 p-4 rounded-2xl shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <Select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all" className="bg-primary-dark text-white">All Actions</option>
              <option value="create" className="bg-primary-dark text-white">Create</option>
              <option value="update" className="bg-primary-dark text-white">Update</option>
              <option value="delete" className="bg-primary-dark text-white">Delete</option>
              <option value="login" className="bg-primary-dark text-white">Login</option>
              <option value="logout" className="bg-primary-dark text-white">Logout</option>
            </Select>

            <Select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              <option value="all" className="bg-primary-dark text-white">All Entities</option>
              <option value="product" className="bg-primary-dark text-white">Product</option>
              <option value="sale" className="bg-primary-dark text-white">Sale</option>
              <option value="user" className="bg-primary-dark text-white">User</option>
              <option value="customer" className="bg-primary-dark text-white">Customer</option>
              <option value="batch" className="bg-primary-dark text-white">Batch</option>
              <option value="transfer" className="bg-primary-dark text-white">Transfer</option>
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

        {/* Audit Logs Table */}
        <Table
          data={logs || []}
          columns={columns}
          emptyMessage="No audit logs match current filters"
        />

        {/* Details Modal */}
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Audit Log Details"
          size="lg"
        >
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-white/50">Timestamp</p>
                  <p className="text-sm text-white">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white/50">User</p>
                  <p className="text-sm text-white">{selectedLog.userName}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-white/50">Action</p>
                  <p className="text-sm text-white">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white/50">Entity</p>
                  <p className="text-sm text-white">{selectedLog.entity}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-white/50">Entity ID</p>
                <p className="text-sm text-white break-all">{selectedLog.entityId}</p>
              </div>

              {selectedLog.ipAddress && (
                <div>
                  <p className="text-sm font-medium text-white/50">IP Address</p>
                  <p className="text-sm text-white">{selectedLog.ipAddress}</p>
                </div>
              )}

              {(selectedLog.previousData || selectedLog.newData) && (
                <div>
                  <p className="text-sm font-medium text-white/50 mb-2">Changes</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-white/50 mb-1">Previous Data</p>
                      <pre className="p-3 bg-black/30 rounded text-xs text-white/70 overflow-x-auto max-h-48">
                        {JSON.stringify(selectedLog.previousData || {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs text-white/50 mb-1">New Data</p>
                      <pre className="p-3 bg-black/30 rounded text-xs text-white/70 overflow-x-auto max-h-48">
                        {JSON.stringify(selectedLog.newData || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <p className="text-sm font-medium text-white/50">Additional Metadata</p>
                  <pre className="mt-2 p-3 bg-black/30 rounded text-xs text-white/70 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-white/10">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedLog(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
};
