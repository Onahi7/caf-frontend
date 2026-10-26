/**
 * Shared validation rules for forms
 * Centralizes validation logic to ensure consistency across the application
 */

// Password validation (relaxed and user-friendly: min 6 chars, any characters accepted)
export const passwordValidation = {
  required: 'Password is required',
  minLength: { value: 6, message: 'Password must be at least 6 characters' },
};

// Optional password validation (for edit forms)
export const optionalPasswordValidation = {
  minLength: { value: 6, message: 'Password must be at least 6 characters' },
};

// Email validation
export const emailValidation = {
  required: 'Email is required',
  pattern: {
    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
    message: 'Invalid email address',
  },
};

// Optional email validation (for optional staff contact fields)
export const optionalEmailValidation = {
  pattern: {
    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
    message: 'Invalid email address',
  },
};

// Username validation
export const usernameValidation = {
  required: 'Username is required',
  minLength: { value: 3, message: 'Username must be at least 3 characters' },
  maxLength: { value: 30, message: 'Username must be at most 30 characters' },
  pattern: {
    value: /^[a-zA-Z0-9_]+$/,
    message: 'Username can only contain letters, numbers, and underscores',
  },
};

// Name validation (first name, last name)
export const nameValidation = {
  required: 'This field is required',
  minLength: { value: 2, message: 'Must be at least 2 characters' },
  maxLength: { value: 50, message: 'Must be at most 50 characters' },
};

// Phone validation
export const phoneValidation = {
  pattern: {
    value: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
    message: 'Invalid phone number',
  },
};

// SKU validation
export const skuValidation = {
  required: 'SKU is required',
  pattern: {
    value: /^[A-Z0-9-]+$/i,
    message: 'SKU can only contain letters, numbers, and hyphens',
  },
};

// Barcode validation
export const barcodeValidation = {
  required: 'Barcode is required',
  pattern: {
    value: /^[0-9]+$/,
    message: 'Barcode must contain only numbers',
  },
};

// Price validation
export const priceValidation = {
  required: 'Price is required',
  min: { value: 0, message: 'Price must be 0 or greater' },
};

// Quantity validation
export const quantityValidation = {
  required: 'Quantity is required',
  min: { value: 0, message: 'Quantity must be 0 or greater' },
};

// Percentage validation
export const percentageValidation = {
  min: { value: 0, message: 'Must be 0 or greater' },
  max: { value: 100, message: 'Must be 100 or less' },
};

// Markup percentage validation (can exceed 100%)
export const markupValidation = {
  min: { value: 0, message: 'Must be 0 or greater' },
  max: { value: 1000, message: 'Maximum 1000%' },
};

// Required field validation
export const requiredValidation = (fieldName: string) => ({
  required: `${fieldName} is required`,
});

// Roles that require branch assignment
export const rolesRequiringBranch = ['branch_manager', 'cashier', 'marketer'];

// Check if a role requires branch assignment
export const requiresBranchAssignment = (role: string): boolean => {
  return rolesRequiringBranch.includes(role);
};
