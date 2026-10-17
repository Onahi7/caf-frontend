import { useToast } from './useToast';

// Legacy alert replacement hook
export const useAlertReplacement = () => {
  const { showError, showWarning, showInfo, showSuccess } = useToast();
  
  // Drop-in replacement for alert() that provides better UX
  const alertError = (message: string) => {
    showError('Error', message);
  };
  
  const alertWarning = (message: string) => {
    showWarning('Warning', message);
  };
  
  const alertInfo = (message: string) => {
    showInfo('Information', message);
  };
  
  const alertSuccess = (message: string) => {
    showSuccess('Success', message);
  };
  
  // Generic alert replacement - accepts an explicit severity, defaults to info.
  // (Do not infer severity from message text: it mis-types legitimate messages.)
  const alert = (
    message: string,
    severity: 'error' | 'warning' | 'info' | 'success' = 'info'
  ) => {
    switch (severity) {
      case 'error':
        showError('Error', message);
        break;
      case 'warning':
        showWarning('Warning', message);
        break;
      case 'success':
        showSuccess('Success', message);
        break;
      default:
        showInfo('Information', message);
    }
  };
  
  return {
    alert,
    alertError,
    alertWarning,
    alertInfo,
    alertSuccess,
    showError,
    showWarning,
    showInfo,
    showSuccess,
  };
};