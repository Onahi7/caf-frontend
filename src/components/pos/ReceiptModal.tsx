import { useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Receipt } from './Receipt';
import { ReceiptActions } from './ReceiptActions';
import { EmailInputModal } from './EmailInputModal';
import { emailApi } from '../../lib/api-client';

interface SaleData {
  _id: string;
  saleNumber: string;
  total: number;
  totalFormatted: string;
  subtotal: number;
  tax: number;
  discount: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  createdAt: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  branch: {
    name: string;
    address: string;
    phone: string;
  };
  cashier: {
    firstName: string;
    lastName: string;
  };
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleData: SaleData;
}

export const ReceiptModal = ({ isOpen, onClose, saleData }: ReceiptModalProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Transform saleData to match Receipt component's expected format
  const receiptData = {
    _id: saleData._id,
    branchName: saleData.branch?.name,
    branchAddress: saleData.branch?.address,
    branchPhone: saleData.branch?.phone,
    cashierName: saleData.cashier ? `${saleData.cashier.firstName} ${saleData.cashier.lastName}` : undefined,
    items: saleData.items.map(item => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.total,
    })),
    subtotal: saleData.subtotal,
    discount: saleData.discount,
    taxAmount: saleData.tax,
    total: saleData.total,
    paymentMethod: saleData.paymentMethodLabel || saleData.paymentMethod,
    createdAt: saleData.createdAt,
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      // Sanitize content to prevent XSS
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = receiptRef.current.innerHTML;
      // Remove all script tags and event handlers
      tempDiv.querySelectorAll('script').forEach(s => s.remove());
      tempDiv.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('on')) {
            el.removeAttribute(attr.name);
          }
        });
      });
      const sanitizedContent = tempDiv.innerHTML;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Receipt - ${saleData._id}</title>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: 'Courier New', monospace;
                }
                @media print {
                  body {
                    padding: 0;
                  }
                }
              </style>
            </head>
            <body>
              ${sanitizedContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for content to load before printing
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  const handleEmail = () => {
    setEmailStatus(null);
    setIsEmailModalOpen(true);
  };

  const handleEmailSubmit = async (email: string) => {
    setIsEmailSending(true);
    setEmailStatus(null);

    try {
      await emailApi.sendReceiptEmail(email, saleData._id);
      setEmailStatus({
        type: 'success',
        message: 'Receipt sent successfully to ' + email,
      });
      setIsEmailModalOpen(false);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setEmailStatus(null);
      }, 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send email';
      setEmailStatus({
        type: 'error',
        message,
      });
    } finally {
      setIsEmailSending(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Receipt" size="lg">
        <div className="space-y-6">
          {/* Status Toast Notification */}
          {emailStatus && (
            <div
              className={`p-4 rounded-lg ${
                emailStatus.type === 'success'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}
            >
              <div className="flex items-center">
                {emailStatus.type === 'success' ? (
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span className="text-sm font-medium">{emailStatus.message}</span>
              </div>
            </div>
          )}

          {/* Receipt Preview */}
          <div className="bg-slate-950 rounded-lg overflow-hidden">
            <Receipt ref={receiptRef} saleData={receiptData} />
          </div>

          {/* Receipt Actions */}
          <div className="bg-slate-900/50 p-4 rounded-lg">
            <ReceiptActions 
              saleId={saleData._id} 
              receiptNumber={saleData.saleNumber}
              compact={true}
            />
          </div>

          {/* Additional Actions */}
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={onClose}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={handleEmail}
              className="flex-1"
            >
              <svg
                className="w-5 h-5 mr-2 inline"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Email
            </Button>
          </div>
        </div>
      </Modal>

      {/* Email Input Modal */}
      <EmailInputModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSubmit={handleEmailSubmit}
        isLoading={isEmailSending}
      />
    </>
  );
};
