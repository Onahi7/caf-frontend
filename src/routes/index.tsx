import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuthStore } from '../stores/auth-store';
import { getDefaultRouteForRole } from '../lib/role-routes';
import { FinanceReportsPage as FinanceReportsPageFinance } from '../pages/finance/FinanceReportsPage';
import { AdminLayout } from '../components/AdminLayout';
import { FinanceLayout } from '../components/FinanceLayout';
import { MarketerLayout } from '../components/MarketerLayout';
import {
  LoginPage,
  DashboardPage,
  InventoryPage,
  SalesPage,
  CreditSalesPage,
  ReportsPage,
  BranchManagementPage,
  UserManagementPage,
  ProductManagementPage,
  StockAdjustmentPage,
  TransferManagementPage,
  SalesReportsPage,
  InventoryReportsPage,
  ExpiryReportsPage,
  SupplierManagementPage,
  PurchaseOrderPage,
  CustomerManagementPage,
  PromotionsManagementPage,
  EmailTemplatesPage,
  EmailLogsPage,
  JobsMonitoringPage,
  PurchaseReportsPage,
  TransferReportsPage,
  CustomerReportsPage,
  SystemSettingsPage,
  TaxConfigurationPage,
  PaymentMethodsPage,
  AuditTrailPage,
  UserActivityLogsPage,
  POSPage,
  ShiftLogsPage,
  ShiftReportPage,
  ProcessReturnPage,
  PaymentPage,
  ProductCatalogPage,
  TransactionHistoryPage,
  CustomerLookupPage,
  DiscountsPage,
  ReceiptPage,
  UnauthorizedPage,
  NotFoundPage,
  HQDashboardPage,
  MarketerDashboardPage,
  MarketerAssignmentsPage,
  CycleCountPage,
  MarketerSalesPage,
  MarketerReviewAssignmentsPage,
  PrintersPage,
  PricingManagementPage,
  ExpensesPage,
  FinanceTransactionsPage,
  ValuationReportPage,
  RequestAnalysisPage,
  CustomerOrdersPage,
  ProformaInvoicesPage,
  DeliveryNotesPage,
  AccountSecurityPage,
  FinanceManagerDashboardPage,
  ReconciliationPage,
  SalaryManagementPage,
  CashManagementPage,
  FinanceReportsPage,
  FinanceHubPage,
  FinanceCashBookPage,
  FinanceReceivablesPage,
  FinancePayablesPage,
  FinanceSalariesPage,
  FinanceReconciliationsPage,
  FinanceLoansPage,
  FinanceAdvancesPage,
  FinanceFinalSettlementPage,
  RecurringInvoicesPage,
} from '../pages';

const RoleAwareHomeRedirect = () => {
  const user = useAuthStore((state) => state.user);
  return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
};

const AdminLayoutShell = () => (
  <AdminLayout>
    <Outlet />
  </AdminLayout>
);

const FinanceLayoutShell = () => (
  <FinanceLayout>
    <Outlet />
  </FinanceLayout>
);

const MarketerLayoutShell = () => (
  <MarketerLayout>
    <Outlet />
  </MarketerLayout>
);

export const router = createBrowserRouter([
  // Root & Public Routes
  {
    path: '/',
    element: <RoleAwareHomeRedirect />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '/settings/security',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier', 'auditor', 'marketer', 'finance_manager']}>
        <ErrorBoundary>
          <AccountSecurityPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },

  // Legacy / Direct Root Aliases -> Redirect to /admin/...
  {
    path: '/dashboard',
    element: <RoleAwareHomeRedirect />,
  },
  {
    path: '/branches',
    element: <Navigate to="/admin/branches" replace />,
  },
  {
    path: '/users',
    element: <Navigate to="/admin/users" replace />,
  },
  {
    path: '/products',
    element: <Navigate to="/admin/products" replace />,
  },
  {
    path: '/batches',
    element: <Navigate to="/admin/stock-adjustments" replace />,
  },
  {
    path: '/transfers',
    element: <Navigate to="/admin/transfers" replace />,
  },
  {
    path: '/cycle-counts',
    element: <Navigate to="/admin/cycle-counts" replace />,
  },
  {
    path: '/inventory',
    element: <Navigate to="/admin/inventory" replace />,
  },
  {
    path: '/sales',
    element: <Navigate to="/admin/sales" replace />,
  },
  {
    path: '/reports',
    element: <Navigate to="/admin/reports" replace />,
  },

  // POS Direct Routes
  {
    path: '/pos',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <POSPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/catalog',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <ProductCatalogPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/payment',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <PaymentPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/shifts',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <ShiftLogsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/shift-report/:shiftId',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <ShiftReportPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/returns',
    element: (
      <ProtectedRoute allowedRoles={['branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <ProcessReturnPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/transactions',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <TransactionHistoryPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/transctions',
    element: <Navigate to="/pos/transactions" replace />,
  },
  {
    path: '/pos/transactons',
    element: <Navigate to="/pos/transactions" replace />,
  },
  {
    path: '/pos/customers',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <CustomerLookupPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/discounts',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <DiscountsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/receipt',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <ReceiptPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/receipt/:saleId',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <ReceiptPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/credit-sales',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <CreditSalesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/reports',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <ReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/reports/sales',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <SalesReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/reports/customers',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <CustomerReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/reports/inventory',
    element: (
      <ProtectedRoute allowedRoles={['branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <InventoryReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/reports/expiry',
    element: (
      <ProtectedRoute allowedRoles={['branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <ExpiryReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/reports/purchases',
    element: (
      <ProtectedRoute allowedRoles={['branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <PurchaseReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/pos/reports/transfers',
    element: (
      <ProtectedRoute allowedRoles={['branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <TransferReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },

  // Admin Nested Route Tree (Scoped within AdminLayoutShell)
  {
    path: '/admin',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'cashier', 'finance_manager']}>
        <ErrorBoundary>
          <AdminLayoutShell />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <RoleAwareHomeRedirect />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['branch_manager', 'super_admin', 'auditor']}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'hq-dashboard',
        element: (
          <ProtectedRoute allowedRoles={['super_admin']}>
            <HQDashboardPage />
          </ProtectedRoute>
        ),
      },
      // Inventory Management Subroutes
      {
        path: 'inventory',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor']}>
            <InventoryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'products',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <ProductManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'batches',
        element: <Navigate to="/admin/stock-adjustments" replace />,
      },
      {
        path: 'stock-adjustments',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <StockAdjustmentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'transfers',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <TransferManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'cycle-counts',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <CycleCountPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'pricing',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <PricingManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'promotions',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <PromotionsManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'suppliers',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <SupplierManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'purchase-orders',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <PurchaseOrderPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'marketer-assignments',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <MarketerAssignmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'marketer-dashboard',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <MarketerDashboardPage />
          </ProtectedRoute>
        ),
      },
      // Sales & Customer Orders Subroutes
      {
        path: 'sales',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier', 'auditor', 'finance_manager']}>
            <SalesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'sales/credit',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'cashier']}>
            <CreditSalesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'sales/request-analysis',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier', 'auditor', 'finance_manager']}>
            <RequestAnalysisPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'customers',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier']}>
            <CustomerManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'customer-orders',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier']}>
            <CustomerOrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'proforma-invoices',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <ProformaInvoicesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'delivery-notes',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier']}>
            <DeliveryNotesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'transactions',
        element: (
          <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
            <TransactionHistoryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'shifts',
        element: (
          <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
            <ShiftLogsPage />
          </ProtectedRoute>
        ),
      },
      // Reports Subroutes
      {
        path: 'reports',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager', 'cashier']}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports/valuation',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager']}>
            <ValuationReportPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports/sales',
        element: (
          <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
            <SalesReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports/inventory',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor']}>
            <InventoryReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports/expiry',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor']}>
            <ExpiryReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports/purchases',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor']}>
            <PurchaseReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports/transfers',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor']}>
            <TransferReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports/customers',
        element: (
          <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
            <CustomerReportsPage />
          </ProtectedRoute>
        ),
      },
      // Administration Subroutes
      {
        path: 'branches',
        element: (
          <ProtectedRoute allowedRoles={['super_admin']}>
            <BranchManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <UserManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'printers',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <PrintersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'printers/new',
        element: <Navigate to="/admin/printers" replace />,
      },
      {
        path: 'settings',
        element: <Navigate to="/admin/settings/system" replace />,
      },
      {
        path: 'settings/system',
        element: (
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SystemSettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings/taxes',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <TaxConfigurationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings/payment-methods',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
            <PaymentMethodsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'email/templates',
        element: (
          <ProtectedRoute allowedRoles={['super_admin']}>
            <EmailTemplatesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'email/logs',
        element: (
          <ProtectedRoute allowedRoles={['super_admin']}>
            <EmailLogsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'jobs',
        element: (
          <ProtectedRoute allowedRoles={['super_admin']}>
            <JobsMonitoringPage />
          </ProtectedRoute>
        ),
      },
      // Audit Subroutes
      {
        path: 'audit',
        element: <Navigate to="/admin/audit/trail" replace />,
      },
      {
        path: 'audit/trail',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'auditor']}>
            <AuditTrailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit/user-activity',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'auditor']}>
            <UserActivityLogsPage />
          </ProtectedRoute>
        ),
      },
      // Finance Operations inside Admin
      {
        path: 'expenses',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier', 'finance_manager']}>
            <ExpensesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'finance',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
            <FinanceTransactionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'finance-dashboard',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
            <FinanceReportsPageFinance />
          </ProtectedRoute>
        ),
      },
      {
        path: 'finance-manager-dashboard',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'finance_manager']}>
            <FinanceManagerDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reconciliations',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
            <ReconciliationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'salaries',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
            <SalaryManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'cash-management',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
            <CashManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'finance-reports',
        element: (
          <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
            <FinanceReportsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },

  // Finance Hub Workspace (Scoped within FinanceLayoutShell)
  {
    path: '/finance',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceLayoutShell />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <FinanceHubPage />,
      },
      {
        path: 'cash-book',
        element: <FinanceCashBookPage />,
      },
      {
        path: 'receivables',
        element: <FinanceReceivablesPage />,
      },
      {
        path: 'payables',
        element: <FinancePayablesPage />,
      },
      {
        path: 'salaries',
        element: <FinanceSalariesPage />,
      },
      {
        path: 'reconciliations',
        element: <FinanceReconciliationsPage />,
      },
      {
        path: 'loans',
        element: <FinanceLoansPage />,
      },
      {
        path: 'advances',
        element: <FinanceAdvancesPage />,
      },
      {
        path: 'settlement',
        element: <FinanceFinalSettlementPage />,
      },
      {
        path: 'recurring-invoices',
        element: <RecurringInvoicesPage />,
      },
      {
        path: 'reports',
        element: <FinanceReportsPage />,
      },
    ],
  },

  // Marketer Field Operations Workspace (Scoped within MarketerLayoutShell)
  {
    path: '/marketer',
    element: (
      <ProtectedRoute allowedRoles={['marketer', 'super_admin']}>
        <ErrorBoundary>
          <MarketerLayoutShell />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/marketer/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <MarketerDashboardPage />,
      },
      {
        path: 'sales',
        element: <MarketerSalesPage />,
      },
      {
        path: 'review',
        element: <MarketerReviewAssignmentsPage />,
      },
    ],
  },

  // Catch-All 404
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
