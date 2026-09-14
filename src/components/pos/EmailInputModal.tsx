import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface EmailInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
  isLoading?: boolean;
}

export const EmailInputModal = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  isLoading = false 
}: EmailInputModalProps) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = () => {
    setError('');
    
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    onSubmit(email);
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Email Receipt" size="sm">
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Enter the customer's email address to send a digital copy of the receipt.
        </p>

        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          onKeyPress={handleKeyPress}
          error={error}
          placeholder="customer@example.com"
          disabled={isLoading}
          autoFocus
        />

        <div className="flex space-x-3 pt-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleClose}
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            className="flex-1"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send Email'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
