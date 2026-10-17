export interface PackSize {
  code?: string;
  name: string;
  unit: string;
  contentsDescription?: string;
  purchaseUnit?: string;
  unitsPerPurchaseUnit?: number;
  quantityPerPack: number;
  sellingPrice: number;
  barcode?: string;
}

export interface Product {
  _id: string;
  branchId?: string | { _id: string; name: string };
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  reorderLevel?: number;
  maxStockLevel?: number;
  quantityAvailable: number;
  quantityInitial?: number;
  basePrice: number;
  costPrice: number;
  suggestedRetailPrice?: number;
  markupPercentage?: number;
  requiresPrescription: boolean;
  isControlled?: boolean;
  isActive: boolean;
  supplierId?: string | { _id: string; name: string };
  supplyDate?: string;
  expiryDate?: string;
  packSizes?: PackSize[];
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface POSProduct {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  brand?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  requiresPrescription: boolean;
  unit: string;
  packSizes?: PackSize[];
  matchedPackSize?: PackSize;
}
