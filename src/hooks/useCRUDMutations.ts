import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import { useToast } from './useToast';
import { getErrorMessage } from '../lib/error-utils';
import { unwrapResponse } from '../lib/unwrap-response';

/**
 * Writes that failed due to no network response are transparently queued for
 * offline sync by the api-client. Surface those as a warning, not an error.
 */
const isOfflineQueuedError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      (error as { isOfflineQueued?: boolean }).isOfflineQueued
  );

/**
 * Generic CRUD mutation hook factory
 * 
 * Provides standardized create, update, and delete mutations with:
 * - Automatic cache invalidation
 * - Toast notifications
 * - Error handling
 * - Type safety
 * 
 * @param resource - API resource name (e.g., 'products', 'users')
 * @param queryKey - Query key to invalidate after mutations
 * @param options - Optional configuration
 * 
 * @example
 * const { createMutation, updateMutation, deleteMutation } = useCRUDMutations<Product>(
 *   'products',
 *   queryKeys.products.lists()
 * );
 * 
 * // Create
 * createMutation.mutate(newProduct);
 * 
 * // Update
 * updateMutation.mutate({ id: '123', data: updatedProduct });
 * 
 * // Delete
 * deleteMutation.mutate('123');
 */
export const useCRUDMutations = <T extends { _id?: string; id?: string }>(
  resource: string,
  queryKey: readonly unknown[],
  options?: {
    resourceLabel?: string;
    onCreateSuccess?: (data: T) => void;
    onUpdateSuccess?: (data: T) => void;
    onDeleteSuccess?: () => void;
  }
) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showWarning } = useToast();
  const resourceLabel = options?.resourceLabel || resource;

  const handleError = (error: unknown, action: string) => {
    if (isOfflineQueuedError(error)) {
      showWarning(
        `${resourceLabel} saved offline`,
        'It will sync automatically when the connection returns.'
      );
      return;
    }
    showError(getErrorMessage(error, `Failed to ${action} ${resourceLabel}`));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Omit<T, '_id' | 'id'>) => {
      const response = await apiClient.post(`/${resource}`, data);
      return unwrapResponse<T>(response.data, {} as T);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey, exact: false });
      showSuccess(`${resourceLabel} created successfully`);
      options?.onCreateSuccess?.(data);
    },
    onError: (error) => {
      handleError(error, 'create');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<T> }) => {
      const response = await apiClient.patch(`/${resource}/${id}`, data);
      return unwrapResponse<T>(response.data, {} as T);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey, exact: false });
      showSuccess(`${resourceLabel} updated successfully`);
      options?.onUpdateSuccess?.(data);
    },
    onError: (error) => {
      handleError(error, 'update');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/${resource}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey, exact: false });
      showSuccess(`${resourceLabel} deleted successfully`);
      options?.onDeleteSuccess?.();
    },
    onError: (error) => {
      handleError(error, 'delete');
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
};

/**
 * Specialized mutation hook for resources that require branch context
 * 
 * @example
 * const { createMutation } = useBranchAwareCRUDMutations<Product>(
 *   'products',
 *   queryKeys.products.lists(),
 *   branchId
 * );
 */
export const useBranchAwareCRUDMutations = <T extends { _id?: string; id?: string }>(
  resource: string,
  queryKey: readonly unknown[],
  branchId: string,
  options?: {
    resourceLabel?: string;
    onCreateSuccess?: (data: T) => void;
    onUpdateSuccess?: (data: T) => void;
    onDeleteSuccess?: () => void;
  }
) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showWarning } = useToast();
  const resourceLabel = options?.resourceLabel || resource;

  const handleError = (error: unknown, action: string) => {
    if (isOfflineQueuedError(error)) {
      showWarning(
        `${resourceLabel} saved offline`,
        'It will sync automatically when the connection returns.'
      );
      return;
    }
    showError(getErrorMessage(error, `Failed to ${action} ${resourceLabel}`));
  };

  // Create mutation with branchId (an explicit branchId in the payload wins,
  // so forms that offer a branch selector are respected)
  const createMutation = useMutation({
    mutationFn: async (data: Omit<T, '_id' | 'id'>) => {
      const explicitBranchId = (data as { branchId?: string }).branchId;
      const payload = explicitBranchId ? data : { ...data, branchId };
      const response = await apiClient.post(`/${resource}`, payload);
      return unwrapResponse<T>(response.data, {} as T);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey, exact: false });
      showSuccess(`${resourceLabel} created successfully`);
      options?.onCreateSuccess?.(data);
    },
    onError: (error) => {
      handleError(error, 'create');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<T> }) => {
      const response = await apiClient.patch(`/${resource}/${id}`, data);
      return unwrapResponse<T>(response.data, {} as T);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey, exact: false });
      showSuccess(`${resourceLabel} updated successfully`);
      options?.onUpdateSuccess?.(data);
    },
    onError: (error) => {
      handleError(error, 'update');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/${resource}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey, exact: false });
      showSuccess(`${resourceLabel} deleted successfully`);
      options?.onDeleteSuccess?.();
    },
    onError: (error) => {
      handleError(error, 'delete');
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
