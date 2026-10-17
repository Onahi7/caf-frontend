import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../../lib/api-client';
import { useCurrency } from '../../hooks/useCurrency';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import { POSLayout } from '../../components/pos/POSLayout';
import { 
  Printer, 
  Mail, 
  Share2, 
  CheckCircle2, 
  ShoppingBag, 
  Receipt,
  ArrowLeft,
  X 
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface SaleItem {
  productId: string | { _id?: string; name?: string; sku?: string };
  productName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  packSize?: {
    name: string;
    unit: string;
    quantityPerPack: number;
  };
}

interface SalePayment {
  paymentMethod: string;
  amount: number;
  paymentReference?: string;
}

interface Sale {
  _id: string;
  receiptNumber: string;
  branchName?: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  taxAmount?: number;
  total: number;
  paymentMethod: string;
  payments?: SalePayment[];
  status: string;
  createdAt: string;
  cashierName?: string;
}

export const ReceiptPage = () => {
  const { saleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { format, symbol } = useCurrency();
  const { showSuccess, showError, showInfo } = useToast();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  // Check if sale data was passed via navigation state
  const passedSale = location.state?.sale;

  const { data: sale, isLoading } = useQuery({
    queryKey: queryKeys.sales.detail(saleId),
    queryFn: async () => {
      const response = await apiClient.get(`/sales/${saleId}`);
      return (response.data?.data ?? response.data) as Sale;
    },
    enabled: !!saleId && !passedSale,
    initialData: passedSale,
  });

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleShare = () => {
    if (!sale) return;
    const text = `Receipt #${sale.receiptNumber}\n${sale.branchName || 'CareFarm Pharmacy'}\n\nDate: ${formatDateTime(sale.createdAt)}\nCustomer: ${sale.customerName || 'Walk-in'}\nTotal: ${format(sale.total)}\nPayment: ${sale.paymentMethod.toUpperCase()}\n\nThank you for choosing CareFarm!`;

    if (navigator.share) {
      navigator.share({
        title: `Receipt #${sale.receiptNumber}`,
        text: text,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        showInfo('Copied to Clipboard', 'Receipt text ready to send');
      });
    }
  };

  const handleEmailReceipt = async () => {
    if (!emailAddress) {
      showError('Please enter an email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      showError('Please enter a valid email address');
      return;
    }

    setEmailSending(true);
    try {
      await apiClient.post('/email/receipt', {
        saleId: saleId || sale?._id,
        email: emailAddress,
      });
      showSuccess('Receipt sent successfully');
      setShowEmailModal(false);
      setEmailAddress('');
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Failed to send receipt');
    } finally {
      setEmailSending(false);
    }
  };

  if (isLoading) {
    return (
      <POSLayout title="Receipt">
        <div className="min-h-full bg-slate-950 flex items-center justify-center">
          <div className="text-slate-400 text-sm">Loading receipt details...</div>
        </div>
      </POSLayout>
    );
  }

  if (!sale) {
    return (
      <POSLayout title="Receipt">
        <div className="min-h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <Receipt className="w-12 h-12 text-slate-500 mb-3" />
          <h2 className="text-lg font-bold text-white">Receipt Not Found</h2>
          <p className="text-slate-400 text-xs mt-1">The transaction record could not be located.</p>
          <Button onClick={() => navigate('/pos')} className="mt-4" variant="secondary">
            Return to POS
          </Button>
        </div>
      </POSLayout>
    );
  }

  const getItemName = (item: SaleItem) => {
    if (item.productName?.trim()) {
      return item.productName;
    }
    if (typeof item.productId === 'object' && item.productId?.name?.trim()) {
      return item.productId.name;
    }
    return 'Product';
  };

  return (
    <POSLayout title="Receipt">
      <div className="min-h-full bg-slate-950 flex flex-col">
        {/* On-Screen Shell (hidden during thermal printing) */}
        <div className="no-print flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-slate-900/60 backdrop-blur-md">
            <button
              onClick={() => navigate('/pos')}
              className="text-slate-300 hover:text-white flex items-center min-w-10 min-h-10 justify-center -ml-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h1 className="text-base font-bold text-white">Transaction Receipt</h1>
              <p className="text-[11px] text-slate-400 font-mono">#{sale.receiptNumber}</p>
            </div>
            <button
              onClick={handleShare}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              title="Share receipt"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-5 overflow-y-auto">
            {/* Payment Successful Banner */}
            <div className="text-center pt-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-950/40">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Payment Completed</h2>
              <p className="text-xs text-slate-400 mt-1">Transaction recorded on POS terminal</p>
            </div>

            {/* Receipt Card */}
            <div className="bg-slate-900/90 rounded-2xl p-5 sm:p-6 border border-white/[0.08] shadow-xl backdrop-blur-xl space-y-4">
              {/* Store & Header */}
              <div className="text-center pb-4 border-b border-white/10 border-dashed">
                <h3 className="text-base font-black text-white tracking-wide uppercase">
                  {sale.branchName || 'CareFarm Pharmacy'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">{formatDateTime(sale.createdAt)}</p>
                <p className="text-xs text-slate-300 font-mono mt-0.5">Receipt: #{sale.receiptNumber}</p>
                {sale.customerName && (
                  <p className="text-xs text-emerald-400 mt-1">Customer: {sale.customerName}</p>
                )}
              </div>

              {/* Items Table */}
              <div className="py-2 border-b border-white/10 border-dashed space-y-3">
                {sale.items.map((item: SaleItem, index: number) => (
                  <div key={index} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium leading-snug break-words">
                        {getItemName(item)}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.quantity} x {format(item.unitPrice)}
                        {item.packSize && ` (${item.packSize.name})`}
                      </p>
                    </div>
                    <p className="text-slate-100 font-mono font-bold shrink-0">{format(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              {/* Totals Section */}
              <div className="py-2 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-200">{format(sale.subtotal)}</span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Discount</span>
                    <span className="font-mono font-semibold">-{format(sale.discount)}</span>
                  </div>
                )}
                {(sale.taxAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Tax</span>
                    <span className="font-mono text-slate-200">{format(sale.taxAmount ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-white/10">
                  <span>Total Amount Paid</span>
                  <span className="text-emerald-400 font-mono">{format(sale.total)}</span>
                </div>
              </div>

              {/* Payments & Cashier Details */}
              <div className="pt-3 border-t border-white/10 border-dashed text-xs text-slate-400 space-y-1.5">
                <div className="flex justify-between">
                  <span>Payment Method</span>
                  <span className="font-semibold text-white capitalize">{sale.paymentMethod}</span>
                </div>
                {sale.payments && sale.payments.length > 1 && (
                  <div className="pl-2 pt-1 border-l-2 border-emerald-500/30 space-y-1">
                    {sale.payments.map((p: SalePayment, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px] text-slate-300">
                        <span className="capitalize">{p.paymentMethod.replace('_', ' ')}</span>
                        <span className="font-mono">{format(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {sale.cashierName && (
                  <div className="flex justify-between">
                    <span>Served By</span>
                    <span className="text-slate-200">{sale.cashierName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="py-3 px-4 bg-slate-900 hover:bg-slate-850 border border-white/10 rounded-xl text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-sm"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print Thermal</span>
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                className="py-3 px-4 bg-slate-900 hover:bg-slate-850 border border-white/10 rounded-xl text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-sm"
              >
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Email Receipt</span>
              </button>
            </div>

            <Button
              onClick={() => navigate('/pos')}
              className="w-full py-3.5 mt-2 text-sm font-bold shadow-lg shadow-emerald-500/20"
              size="lg"
            >
              Start New Sale
            </Button>
          </div>
        </div>

        {/* Dedicated 80mm/58mm Thermal Print Layout (Only rendered during window.print()) */}
        <div className="print-only thermal-receipt">
          <div className="thermal-header">
            <h2 className="thermal-title">{sale.branchName || 'CAREFARM PHARMACY'}</h2>
            <p className="thermal-sub">Official Sales Receipt</p>
            <p className="thermal-sub">{formatDateTime(sale.createdAt)}</p>
            <p className="thermal-sub">Receipt #{sale.receiptNumber}</p>
            {sale.customerName && <p className="thermal-sub">Customer: {sale.customerName}</p>}
          </div>

          <div className="thermal-divider" />

          <table className="thermal-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Item</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item: SaleItem, idx: number) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'left' }}>{getItemName(item)}</td>
                  <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{format(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Subtotal:</span>
            <span>{format(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="thermal-row">
              <span>Discount:</span>
              <span>-{format(sale.discount)}</span>
            </div>
          )}
          {(sale.taxAmount ?? 0) > 0 && (
            <div className="thermal-row">
              <span>Tax:</span>
              <span>{format(sale.taxAmount ?? 0)}</span>
            </div>
          )}
          <div className="thermal-row thermal-total">
            <span>TOTAL:</span>
            <span>{format(sale.total)}</span>
          </div>

          <div className="thermal-divider" />

          <div className="thermal-row">
            <span>Payment:</span>
            <span style={{ textTransform: 'uppercase' }}>{sale.paymentMethod}</span>
          </div>
          {sale.payments && sale.payments.length > 1 && (
            <>
              {sale.payments.map((p: SalePayment, idx: number) => (
                <div key={idx} className="thermal-row" style={{ fontSize: '10px' }}>
                  <span>- {p.paymentMethod.replace('_', ' ')}:</span>
                  <span>{format(p.amount)}</span>
                </div>
              ))}
            </>
          )}
          {sale.cashierName && (
            <div className="thermal-row">
              <span>Cashier:</span>
              <span>{sale.cashierName}</span>
            </div>
          )}

          <div className="thermal-footer">
            <p>Thank you for choosing CareFarm!</p>
            <p>Medicines once sold in good condition are not returnable without receipt.</p>
          </div>
        </div>

        {/* Email Receipt Modal */}
        {showEmailModal && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowEmailModal(false)}
          >
            <div
              className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">Email Receipt</h2>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEmailReceipt}
                  disabled={emailSending}
                  isLoading={emailSending}
                  className="flex-1"
                >
                  Send Email
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </POSLayout>
  );
};
