import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSearch, PackagePlus, Upload } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { getErrorMessage } from '../../lib/error-utils';
import { queryKeys } from '../../lib/query-keys';
import apiClient from '../../lib/api-client';

interface MatchedProduct {
  _id: string;
  name: string;
  brand: string;
  sku: string;
  category: string;
  unit: string;
  stock: number;
  price: number;
}

interface RequestAnalysisItem {
  rowNumber: number;
  rawText: string;
  itemName: string;
  quantityRequested: number | null;
  requestedUnit: string | null;
  notes?: string;
  status: 'matched' | 'missing' | 'created';
  confidence: number;
  matchedProduct: MatchedProduct | null;
  alternatives: Array<MatchedProduct & { confidence: number }>;
}

interface QuickAddForm {
  name: string;
  brand: string;
  category: string;
  unit: string;
  basePrice: string;
  costPrice: string;
  sellingPrice: string;
}

const emptyQuickAddForm: QuickAddForm = {
  name: '',
  brand: 'Unspecified',
  category: 'Uncategorized',
  unit: 'piece',
  basePrice: '0',
  costPrice: '0',
  sellingPrice: '0',
};

export function RequestAnalysisPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const branchId = getBranchId(selectedBranch);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { format } = useCurrency();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [results, setResults] = useState<RequestAnalysisItem[]>([]);
  const [quickAddTarget, setQuickAddTarget] = useState<RequestAnalysisItem | null>(null);
  const [quickAddForm, setQuickAddForm] = useState<QuickAddForm>(emptyQuickAddForm);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !branchId) {
        throw new Error('Select a file and branch first');
      }

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await apiClient.post(`/products/request-analysis?branchId=${branchId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data?.data as { items: RequestAnalysisItem[] };
    },
    onSuccess: (data) => {
      setResults(data.items || []);
      showSuccess('Request file analyzed successfully');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to analyze request file'));
    },
  });

  const quickAddMutation = useMutation({
    mutationFn: async () => {
      if (!branchId || !quickAddTarget) {
        throw new Error('Missing branch or request item');
      }

      const barcodeSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
      const payload = {
        branchId,
        name: quickAddForm.name,
        barcode: `REQ-${barcodeSeed}`,
        category: quickAddForm.category,
        brand: quickAddForm.brand,
        unit: quickAddForm.unit,
        reorderLevel: 0,
        basePrice: Number(quickAddForm.basePrice || 0),
        costPrice: Number(quickAddForm.costPrice || 0),
        suggestedRetailPrice: Number(quickAddForm.sellingPrice || 0),
        markupPercentage: 0,
      };

      const response = await apiClient.post('/products', payload);
      return (response.data?.data ?? response.data) as MatchedProduct;
    },
    onSuccess: (product) => {
      showSuccess('Product created from request item');
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
      setResults((current) =>
        current.map((item) =>
          item.rowNumber === quickAddTarget?.rowNumber
            ? {
                ...item,
                status: 'created',
                matchedProduct: {
                  _id: product._id,
                  name: product.name,
                  brand: product.brand,
                  sku: product.sku,
                  category: product.category,
                  unit: product.unit,
                  stock: 0,
                  price: Number(quickAddForm.sellingPrice || 0),
                },
              }
            : item,
        ),
      );
      setQuickAddTarget(null);
      setQuickAddForm(emptyQuickAddForm);
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to create product'));
    },
  });

  const summary = useMemo(() => {
    const matched = results.filter((item) => item.status === 'matched' || item.status === 'created');
    const missing = results.filter((item) => item.status === 'missing');
    return {
      total: results.length,
      matched: matched.length,
      missing: missing.length,
    };
  }, [results]);

  return (
    <AdminLayout title="Request Uploads">
      <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Request Uploads</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Upload client request sheets, Word files, or pictures. We extract the requested items, match them against live inventory, and let you create missing products on the spot.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 w-full lg:max-w-[430px]">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Lines extracted</p>
              <p className="mt-2 text-2xl font-bold text-white">{summary.total}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Matched</p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">{summary.matched}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Missing</p>
              <p className="mt-2 text-2xl font-bold text-amber-300">{summary.missing}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Upload a request file</h2>
              <p className="mt-1 text-sm text-slate-400">
                Supported now: `.xlsx`, `.csv`, `.docx`, `.png`, `.jpg`, `.jpeg`, `.webp`.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv,.docx,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Choose File
              </Button>
              <Button type="button" onClick={() => analyzeMutation.mutate()} isLoading={analyzeMutation.isPending}>
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Analyze Request
                </span>
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            {selectedFile ? (
              <span>
                Selected file: <span className="font-medium text-white">{selectedFile.name}</span>
              </span>
            ) : (
              'No file selected yet.'
            )}
          </div>
        </div>

        <div className="space-y-4">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-10 text-center text-slate-400">
              Upload a client request file and the results will show up here.
            </div>
          ) : (
            results.map((item) => {
              const tone =
                item.status === 'missing'
                  ? 'border-amber-500/20 bg-amber-500/10'
                  : item.status === 'created'
                    ? 'border-sky-500/20 bg-sky-500/10'
                    : 'border-emerald-500/20 bg-emerald-500/10';

              return (
                <div
                  key={`${item.rowNumber}-${item.itemName}`}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                          Row {item.rowNumber}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${tone}`}>
                          {item.status}
                        </span>
                        {item.confidence > 0 ? (
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                            {Math.round(item.confidence * 100)}% confidence
                          </span>
                        ) : null}
                      </div>
                      <h2 className="text-lg font-semibold text-white">{item.itemName}</h2>
                      <p className="text-sm text-slate-500">{item.rawText}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                        <span>Requested quantity: {item.quantityRequested ?? 'Unknown'}</span>
                        <span>Unit: {item.requestedUnit || 'Unspecified'}</span>
                      </div>
                    </div>

                    <div className="w-full xl:max-w-[420px]">
                      {item.matchedProduct ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{item.matchedProduct.name}</p>
                              <p className="mt-1 text-sm text-slate-400">
                                {item.matchedProduct.brand} | {item.matchedProduct.category}
                              </p>
                            </div>
                            <FileSearch className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-white/5 p-3">
                              <p className="text-slate-400">Stock</p>
                              <p className="mt-1 font-semibold text-white">{item.matchedProduct.stock}</p>
                            </div>
                            <div className="rounded-xl bg-white/5 p-3">
                              <p className="text-slate-400">Price</p>
                              <p className="mt-1 font-semibold text-white">{format(item.matchedProduct.price || 0)}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/10 p-4">
                          <p className="text-sm font-semibold text-amber-200">Not found in current catalog</p>
                          <p className="mt-1 text-sm text-amber-100/80">
                            You can create this as a product right here, then rerun the request if you want a fresh match report.
                          </p>
                          <Button
                            type="button"
                            className="mt-4"
                            onClick={() => {
                              setQuickAddTarget(item);
                              setQuickAddForm({
                                ...emptyQuickAddForm,
                                name: item.itemName,
                                unit: item.requestedUnit || 'piece',
                              });
                            }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <PackagePlus className="h-4 w-4" />
                              Add Product
                            </span>
                          </Button>
                        </div>
                      )}

                      {item.alternatives?.length ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Other possible matches</p>
                          <div className="mt-2 space-y-2">
                            {item.alternatives.map((alternative) => (
                              <div
                                key={`${alternative._id}-${alternative.name}`}
                                className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm"
                              >
                                <div>
                                  <p className="text-white">{alternative.name}</p>
                                  <p className="text-slate-500">{alternative.brand}</p>
                                </div>
                                <span className="text-slate-300">
                                  {Math.round(alternative.confidence * 100)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Modal
        isOpen={!!quickAddTarget}
        onClose={() => setQuickAddTarget(null)}
        title="Create Missing Product"
        size="lg"
      >
        {quickAddTarget ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-400">Request item</p>
              <p className="mt-1 text-lg font-semibold text-white">{quickAddTarget.itemName}</p>
              <p className="mt-1 text-sm text-slate-500">{quickAddTarget.rawText}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                { key: 'name', label: 'Product name', type: 'text' },
                { key: 'brand', label: 'Brand', type: 'text' },
                { key: 'category', label: 'Category', type: 'text' },
                { key: 'unit', label: 'Unit', type: 'text' },
                { key: 'costPrice', label: 'Cost price', type: 'number' },
                { key: 'sellingPrice', label: 'Selling price', type: 'number' },
                { key: 'basePrice', label: 'Base price', type: 'number' },
              ].map((field) => (
                <label key={field.key} className="space-y-2">
                  <span className="text-sm text-slate-300">{field.label}</span>
                  <input
                    type={field.type}
                    value={quickAddForm[field.key as keyof QuickAddForm]}
                    onChange={(event) =>
                      setQuickAddForm((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-400/60"
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setQuickAddTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => quickAddMutation.mutate()}
                isLoading={quickAddMutation.isPending}
              >
                Save Product
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AdminLayout>
  );
}
