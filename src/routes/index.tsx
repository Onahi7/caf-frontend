import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuthStore } from '../stores/auth-store';
import { getDefaultRouteForRole } from '../lib/role-routes';
import { FinanceReportsPage as FinanceReportsPageFinance } from '../pages/finance/FinanceReportsPage';
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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RoleAwareHomeRedirect />,
  },
  {
    path: '/login',
    element: <LoginPage />,
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
    path: '/admin/transactions',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <TransactionHistoryPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/shifts',
    element: (
      <ProtectedRoute allowedRoles={['cashier', 'branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <ShiftLogsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
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
  {
    path: '/admin/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['branch_manager', 'super_admin', 'auditor']}>
        <ErrorBoundary>
          <DashboardPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard',
    element: <RoleAwareHomeRedirect />,
  },
  {
    path: '/admin/inventory',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor']}>
        <ErrorBoundary>
          <InventoryPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/sales',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier', 'auditor', 'finance_manager']}>
        <ErrorBoundary>
          <SalesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/reports',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager', 'cashier']}>
        <ErrorBoundary>
          <ReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/branches',
    element: (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <ErrorBoundary>
          <BranchManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/branches',
    element: <Navigate to="/admin/branches" replace />,
  },
  {
    path: '/admin/users',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <UserManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/users',
    element: <Navigate to="/admin/users" replace />,
  },
  {
    path: '/admin/products',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <ProductManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/products',
    element: <Navigate to="/admin/products" replace />,
  },
  {
    path: '/admin/batches',
    element: <Navigate to="/admin/stock-adjustments" replace />,
  },
  {
    path: '/batches',
    element: <Navigate to="/admin/stock-adjustments" replace />,
  },
  {
    path: '/admin/stock-adjustments',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <StockAdjustmentPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/transfers',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <TransferManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/cycle-counts',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <CycleCountPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/printers',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <PrintersPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/sales/credit',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'cashier']}>
        <ErrorBoundary>
          <CreditSalesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/sales/request-analysis',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <RequestAnalysisPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/printers/new',
    element: <Navigate to="/admin/printers" replace />,
  },
  {
    path: '/admin/pricing',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <PricingManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/expenses',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier', 'finance_manager']}>
        <ErrorBoundary>
          <ExpensesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/finance',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceTransactionsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/reports/valuation',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager']}>
        <ErrorBoundary>
          <ValuationReportPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/reports/sales',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager', 'cashier']}>
        <ErrorBoundary>
          <SalesReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/reports/inventory',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager']}>
        <ErrorBoundary>
          <InventoryReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/reports/expiry',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager']}>
        <ErrorBoundary>
          <ExpiryReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/hq-dashboard',
    element: (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <ErrorBoundary>
          <HQDashboardPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/marketer/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['marketer']}>
        <ErrorBoundary>
          <MarketerDashboardPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/marketer/sales',
    element: (
      <ProtectedRoute allowedRoles={['marketer']}>
        <ErrorBoundary>
          <MarketerSalesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/marketer/review',
    element: (
      <ProtectedRoute allowedRoles={['marketer']}>
        <ErrorBoundary>
          <MarketerReviewAssignmentsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/marketer-assignments',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <MarketerAssignmentsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/marketer/assignments',
    element: <Navigate to="/admin/marketer-assignments" replace />,
  },
  {
    path: '/admin/marketer-dashboard',
    element: <Navigate to="/marketer/dashboard" replace />,
  },
  {
    path: '/admin/suppliers',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <SupplierManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/customer-orders',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier']}>
        <ErrorBoundary>
          <CustomerOrdersPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/proforma-invoices',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <ProformaInvoicesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/delivery-notes',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier']}>
        <ErrorBoundary>
          <DeliveryNotesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/purchase-orders',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <PurchaseOrderPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/customers',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'cashier']}>
        <ErrorBoundary>
          <CustomerManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/promotions',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <PromotionsManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/email/templates',
    element: (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <ErrorBoundary>
          <EmailTemplatesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/email/logs',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <EmailLogsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/jobs',
    element: (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <ErrorBoundary>
          <JobsMonitoringPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/reports/purchases',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager']}>
        <ErrorBoundary>
          <PurchaseReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/reports/transfers',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager']}>
        <ErrorBoundary>
          <TransferReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/reports/customers',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor', 'finance_manager', 'cashier']}>
        <ErrorBoundary>
          <CustomerReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/settings',
    element: <Navigate to="/admin/settings/system" replace />,
  },
  {
    path: '/admin/audit',
    element: <Navigate to="/admin/audit/trail" replace />,
  },
  {
    path: '/admin/settings/system',
    element: (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <ErrorBoundary>
          <SystemSettingsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/settings/taxes',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <TaxConfigurationPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/settings/payment-methods',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager']}>
        <ErrorBoundary>
          <PaymentMethodsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/audit/trail',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor']}>
        <ErrorBoundary>
          <AuditTrailPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/audit/user-activity',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'auditor']}>
        <ErrorBoundary>
          <UserActivityLogsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/finance-dashboard',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceReportsPageFinance />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/finance-manager-dashboard',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'finance_manager']}>
        <ErrorBoundary>
          <FinanceManagerDashboardPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceHubPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/cash-book',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceCashBookPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/receivables',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceReceivablesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/payables',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinancePayablesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/salaries',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceSalariesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/reconciliations',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceReconciliationsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/reports',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/loans',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceLoansPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/recurring-invoices',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <RecurringInvoicesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/advances',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceAdvancesPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/settlement',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceFinalSettlementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/reconciliations',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <ReconciliationPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/salaries',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <SalaryManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/cash-management',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <CashManagementPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/finance-reports',
    element: (
      <ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'finance_manager', 'auditor']}>
        <ErrorBoundary>
          <FinanceReportsPage />
        </ErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
