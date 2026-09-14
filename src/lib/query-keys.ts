/**
 * Standardized Query Key Factory
 * 
 * Provides consistent query key structure across the application.
 * Benefits:
 * - Easy cache invalidation
 * - Type-safe query keys
 * - Consistent naming
 * - Easy to maintain
 */

export interface BaseFilters {
  branchId?: string;
  search?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProductFilters extends BaseFilters, PaginationParams {
  category?: string;
  inStock?: boolean;
}

export interface UserFilters extends BaseFilters, PaginationParams {
  role?: string;
  isActive?: boolean;
}

export interface ReportFilters {
  branchId?: string;
  startDate?: string;
  endDate?: string;
  includeExpired?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface SalesFilters extends BaseFilters, PaginationParams {
  category?: string;
  paymentMethod?: string;
  status?: string;
  saleType?: string;
  paymentStatus?: string;
  cashierId?: string;
  productId?: string;
  startDate?: string;
  endDate?: string;
}

export interface TransferFilters extends BaseFilters, PaginationParams {
  status?: string;
  fromBranchId?: string;
  toBranchId?: string;
}

/**
 * Query key factory following React Query best practices
 * Structure: [scope, entity, operation, filters]
 */
export const queryKeys = {
  // Root key
  all: () => ['admin'] as const,
  
  // Products
  products: {
    all: () => [...queryKeys.all(), 'products'] as const,
    lists: () => [...queryKeys.products.all(), 'list'] as const,
    list: (filters?: ProductFilters) => [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
  },
  
  // Users
  users: {
    all: () => [...queryKeys.all(), 'users'] as const,
    lists: () => [...queryKeys.users.all(), 'list'] as const,
    list: (filters?: UserFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
  
  // Branches
  branches: {
    all: () => [...queryKeys.all(), 'branches'] as const,
    lists: () => [...queryKeys.branches.all(), 'list'] as const,
    list: (filters?: BaseFilters) => [...queryKeys.branches.lists(), filters] as const,
    details: () => [...queryKeys.branches.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.branches.details(), id] as const,
  },
  
  // Customers
  customers: {
    all: () => [...queryKeys.all(), 'customers'] as const,
    lists: () => [...queryKeys.customers.all(), 'list'] as const,
    list: (filters?: BaseFilters & PaginationParams) => [...queryKeys.customers.lists(), filters] as const,
    details: () => [...queryKeys.customers.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
  },
  
  // Suppliers
  suppliers: {
    all: () => [...queryKeys.all(), 'suppliers'] as const,
    lists: () => [...queryKeys.suppliers.all(), 'list'] as const,
    list: (filters?: BaseFilters) => [...queryKeys.suppliers.lists(), filters] as const,
    details: () => [...queryKeys.suppliers.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.suppliers.details(), id] as const,
  },
  
  // Transfers
  transfers: {
    all: () => [...queryKeys.all(), 'transfers'] as const,
    lists: () => [...queryKeys.transfers.all(), 'list'] as const,
    list: (filters?: TransferFilters) => [...queryKeys.transfers.lists(), filters] as const,
    details: () => [...queryKeys.transfers.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.transfers.details(), id] as const,
  },
  
  // Purchase Orders
  purchaseOrders: {
    all: () => [...queryKeys.all(), 'purchase-orders'] as const,
    lists: () => [...queryKeys.purchaseOrders.all(), 'list'] as const,
    list: (filters?: BaseFilters) => [...queryKeys.purchaseOrders.lists(), filters] as const,
    details: () => [...queryKeys.purchaseOrders.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.purchaseOrders.details(), id] as const,
  },
  
  // Promotions
  promotions: {
    all: () => [...queryKeys.all(), 'promotions'] as const,
    lists: () => [...queryKeys.promotions.all(), 'list'] as const,
    list: (filters?: BaseFilters & { isActive?: boolean; scope?: string }) => [...queryKeys.promotions.lists(), filters] as const,
    details: () => [...queryKeys.promotions.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.promotions.details(), id] as const,
  },

  // Sales
  sales: {
    all: () => [...queryKeys.all(), 'sales'] as const,
    lists: () => [...queryKeys.sales.all(), 'list'] as const,
    list: (filters?: SalesFilters) => [...queryKeys.sales.lists(), filters] as const,
    details: () => [...queryKeys.sales.all(), 'detail'] as const,
    detail: (id?: string) => [...queryKeys.sales.details(), id] as const,
    recent: (filters?: SalesFilters) => [...queryKeys.sales.all(), 'recent', filters] as const,
    history: (filters?: SalesFilters) => [...queryKeys.sales.all(), 'history', filters] as const,
    credit: (filters?: SalesFilters) => [...queryKeys.sales.all(), 'credit', filters] as const,
  },

  // Shifts
  shifts: {
    all: () => [...queryKeys.all(), 'shifts'] as const,
    lists: () => [...queryKeys.shifts.all(), 'list'] as const,
    list: (filters?: BaseFilters & { cashierId?: string; status?: string }) => [...queryKeys.shifts.lists(), filters] as const,
    details: () => [...queryKeys.shifts.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.shifts.details(), id] as const,
    current: (filters?: { branchId?: string; cashierId?: string; terminalId?: string }) =>
      [...queryKeys.shifts.all(), 'current', filters] as const,
    history: (filters?: { branchId?: string; cashierId?: string; limit?: number }) => [...queryKeys.shifts.all(), 'history', filters] as const,
    report: (shiftId?: string) => [...queryKeys.shifts.all(), 'report', shiftId] as const,
  },

  // Expenses
  expenses: {
    all: () => [...queryKeys.all(), 'expenses'] as const,
    lists: () => [...queryKeys.expenses.all(), 'list'] as const,
    list: (filters?: BaseFilters & { shiftId?: string; category?: string }) => [...queryKeys.expenses.lists(), filters] as const,
    details: () => [...queryKeys.expenses.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.expenses.details(), id] as const,
    shift: (shiftId?: string) => [...queryKeys.expenses.all(), 'shift', shiftId] as const,
    byCategory: (branchId?: string) => [...queryKeys.expenses.all(), 'by-category', branchId] as const,
  },
  
  // Email Templates
  emailTemplates: {
    all: () => [...queryKeys.all(), 'email-templates'] as const,
    lists: () => [...queryKeys.emailTemplates.all(), 'list'] as const,
    list: (filters?: BaseFilters) => [...queryKeys.emailTemplates.lists(), filters] as const,
    details: () => [...queryKeys.emailTemplates.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.emailTemplates.details(), id] as const,
  },

  // Email Logs
  emailLogs: {
    all: () => [...queryKeys.all(), 'email-logs'] as const,
    lists: () => [...queryKeys.emailLogs.all(), 'list'] as const,
    list: (filters?: BaseFilters & { status?: string; from?: string; to?: string }) =>
      [...queryKeys.emailLogs.lists(), filters] as const,
  },

  // Jobs
  jobs: {
    all: () => [...queryKeys.all(), 'jobs'] as const,
    lists: () => [...queryKeys.jobs.all(), 'list'] as const,
    list: (filters?: { status?: string; type?: string }) => [...queryKeys.jobs.lists(), filters] as const,
    stats: () => [...queryKeys.jobs.all(), 'stats'] as const,
  },

  // User Activity Logs
  userActivityLogs: {
    all: () => [...queryKeys.all(), 'user-activity-logs'] as const,
    lists: () => [...queryKeys.userActivityLogs.all(), 'list'] as const,
    list: (filters?: { userId?: string; activity?: string; from?: string; to?: string }) =>
      [...queryKeys.userActivityLogs.lists(), filters] as const,
  },

  // Pricing
  pricing: {
    all: () => [...queryKeys.all(), 'pricing'] as const,
    products: () => [...queryKeys.pricing.all(), 'products'] as const,
    product: (productId?: string, branchId?: string) => [...queryKeys.pricing.products(), productId, branchId] as const,
    analytics: (branchId?: string) => [...queryKeys.pricing.all(), 'analytics', branchId] as const,
  },

  requestAnalysis: {
    all: () => [...queryKeys.all(), 'request-analysis'] as const,
    branch: (branchId?: string) => [...queryKeys.requestAnalysis.all(), branchId] as const,
  },

  // Stock Adjustments
  adjustments: {
    all: () => [...queryKeys.all(), 'adjustments'] as const,
    list: (filters?: BaseFilters & { movementType?: string }) => [...queryKeys.adjustments.all(), 'list', filters] as const,
  },

  // Tax Configuration
  taxConfigs: {
    all: () => [...queryKeys.all(), 'tax-configs'] as const,
    list: () => [...queryKeys.taxConfigs.all(), 'list'] as const,
  },

  // System Settings
  systemSettings: {
    all: () => [...queryKeys.all(), 'system-settings'] as const,
    detail: () => [...queryKeys.systemSettings.all(), 'detail'] as const,
  },

  // Payment Methods
  paymentMethods: {
    all: () => [...queryKeys.all(), 'payment-methods'] as const,
    list: () => [...queryKeys.paymentMethods.all(), 'list'] as const,
  },

  // Dashboard
  dashboard: {
    all: () => [...queryKeys.all(), 'dashboard'] as const,
    branch: (branchId?: string) => [...queryKeys.dashboard.all(), 'branch', branchId] as const,
    hq: () => [...queryKeys.dashboard.all(), 'hq'] as const,
    marketerSummary: () => [...queryKeys.dashboard.all(), 'marketer', 'summary'] as const,
    marketerTransactions: () => [...queryKeys.dashboard.all(), 'marketer', 'transactions'] as const,
  },
  
  // Reports
  reports: {
    all: () => [...queryKeys.all(), 'reports'] as const,
    inventory: (filters: ReportFilters) => [...queryKeys.reports.all(), 'inventory', filters] as const,
    sales: (filters: ReportFilters) => [...queryKeys.reports.all(), 'sales', filters] as const,
    expiry: (filters: ReportFilters) => [...queryKeys.reports.all(), 'expiry', filters] as const,
    transfer: (filters: ReportFilters) => [...queryKeys.reports.all(), 'transfer', filters] as const,
    purchase: (filters: ReportFilters) => [...queryKeys.reports.all(), 'purchase', filters] as const,
    customer: (filters: ReportFilters) => [...queryKeys.reports.all(), 'customer', filters] as const,
    profitLoss: (filters: ReportFilters) => [...queryKeys.reports.all(), 'profit-loss', filters] as const,
    expenses: (filters: ReportFilters) => [...queryKeys.reports.all(), 'expenses', filters] as const,
    deadStock: (filters: ReportFilters) => [...queryKeys.reports.all(), 'dead-stock', filters] as const,
  },
  
  // Audit Logs
  auditLogs: {
    all: () => [...queryKeys.all(), 'audit-logs'] as const,
    lists: () => [...queryKeys.auditLogs.all(), 'list'] as const,
    list: (filters?: BaseFilters & { action?: string; entity?: string; dateFrom?: string; dateTo?: string }) => 
      [...queryKeys.auditLogs.lists(), filters] as const,
  },
  
  // Batches
  batches: {
    all: () => [...queryKeys.all(), 'batches'] as const,
    lists: () => [...queryKeys.batches.all(), 'list'] as const,
    list: (filters?: BaseFilters & { productId?: string; expiring?: string | number | boolean }) => [...queryKeys.batches.lists(), filters] as const,
    details: () => [...queryKeys.batches.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.batches.details(), id] as const,
  },

  // Cycle Counts
  cycleCounts: {
    all: () => [...queryKeys.all(), 'cycleCounts'] as const,
    lists: () => [...queryKeys.cycleCounts.all(), 'list'] as const,
    list: (filters?: { branchId?: string; status?: string }) =>
      [...queryKeys.cycleCounts.lists(), filters] as const,
    details: () => [...queryKeys.cycleCounts.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.cycleCounts.details(), id] as const,
  },

  // Finance Transactions
  finance: {
    all: () => [...queryKeys.all(), 'finance'] as const,
    lists: () => [...queryKeys.finance.all(), 'list'] as const,
    list: (filters?: { branchId?: string; type?: string }) => [...queryKeys.finance.lists(), filters] as const,
    summary: (branchId?: string) => [...queryKeys.finance.all(), 'summary', branchId] as const,
  },

  // Printers
  printers: {
    all: () => [...queryKeys.all(), 'printers'] as const,
    lists: () => [...queryKeys.printers.all(), 'list'] as const,
    list: (branchId?: string) => [...queryKeys.printers.lists(), branchId] as const,
  },

  // Valuation
  valuation: {
    all: () => [...queryKeys.all(), 'valuation'] as const,
    report: (branchId?: string, method?: string) => [...queryKeys.valuation.all(), branchId, method] as const,
  },

  // Customer Orders
  customerOrders: {
    all: () => [...queryKeys.all(), 'customer-orders'] as const,
    lists: () => [...queryKeys.customerOrders.all(), 'list'] as const,
    list: (filters?: BaseFilters & { status?: string }) => [...queryKeys.customerOrders.lists(), filters] as const,
    details: () => [...queryKeys.customerOrders.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.customerOrders.details(), id] as const,
  },

  // Proforma Invoices
  proformas: {
    all: () => [...queryKeys.all(), 'proformas'] as const,
    lists: () => [...queryKeys.proformas.all(), 'list'] as const,
    list: (filters?: BaseFilters & { status?: string; customerId?: string }) =>
      [...queryKeys.proformas.lists(), filters] as const,
    details: () => [...queryKeys.proformas.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.proformas.details(), id] as const,
  },

  // Delivery Notes
  deliveryNotes: {
    all: () => [...queryKeys.all(), 'delivery-notes'] as const,
    lists: () => [...queryKeys.deliveryNotes.all(), 'list'] as const,
    list: (filters?: BaseFilters & { status?: string; proformaInvoiceId?: string }) =>
      [...queryKeys.deliveryNotes.lists(), filters] as const,
    details: () => [...queryKeys.deliveryNotes.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.deliveryNotes.details(), id] as const,
  },

  // Marketer
  marketer: {
    all: () => [...queryKeys.all(), 'marketer'] as const,
    assignments: (filters?: { branchId?: string; marketerId?: string; productId?: string; activeOnly?: boolean; status?: 'pending' | 'accepted' | 'rejected' } & PaginationParams) =>
      [...queryKeys.marketer.all(), 'assignments', filters] as const,
    sales: (filters?: { branchId?: string; marketerId?: string } & PaginationParams) =>
      [...queryKeys.marketer.all(), 'sales', filters] as const,
    summary: (filters?: { branchId?: string; marketerId?: string }) =>
      [...queryKeys.marketer.all(), 'summary', filters] as const,
  },

  // Finance Manager
  financeManager: {
    all: () => [...queryKeys.all(), 'finance-manager'] as const,
    dashboard: (branchId?: string) => [...queryKeys.financeManager.all(), 'dashboard', branchId] as const,
    reconciliations: {
      all: () => [...queryKeys.financeManager.all(), 'reconciliations'] as const,
      list: (filters?: { branchId?: string; source?: string; status?: string; period?: string }) =>
        [...queryKeys.financeManager.reconciliations.all(), filters] as const,
      detail: (id: string) => [...queryKeys.financeManager.reconciliations.all(), 'detail', id] as const,
      stats: (branchId?: string) => [...queryKeys.financeManager.reconciliations.all(), 'stats', branchId] as const,
    },
    salaries: {
      all: () => [...queryKeys.financeManager.all(), 'salaries'] as const,
      list: (filters?: { branchId?: string; employeeId?: string; period?: string; status?: string }) =>
        [...queryKeys.financeManager.salaries.all(), filters] as const,
      detail: (id: string) => [...queryKeys.financeManager.salaries.all(), 'detail', id] as const,
      stats: (branchId?: string, period?: string) => [...queryKeys.financeManager.salaries.all(), 'stats', branchId, period] as const,
    },
    cashEntries: {
      all: () => [...queryKeys.financeManager.all(), 'cash-entries'] as const,
      list: (filters?: { branchId?: string; type?: string; category?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) =>
        [...queryKeys.financeManager.cashEntries.all(), filters] as const,
      detail: (id: string) => [...queryKeys.financeManager.cashEntries.all(), 'detail', id] as const,
      summary: (branchId?: string, startDate?: string, endDate?: string) =>
        [...queryKeys.financeManager.cashEntries.all(), 'summary', branchId, startDate, endDate] as const,
    },
  },
};
