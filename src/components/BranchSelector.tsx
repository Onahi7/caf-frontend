import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBranchStore, getBranchId, type Branch } from '../stores/branch-store';
import { useAuthStore } from '../stores/auth-store';
import apiClient from '../lib/api-client';
import { unwrapArray } from '../lib/unwrap-response';
import { Select } from './ui/Select';
import { queryKeys } from '../lib/query-keys';

type BranchesResponse = Branch[] | { data?: Branch[] };

export interface BranchSelectorProps {
  hideLabel?: boolean;
}

export const BranchSelector = ({ hideLabel = false }: BranchSelectorProps = {}) => {
  const { selectedBranch, branches, setSelectedBranch, setBranches } = useBranchStore();
  const { user } = useAuthStore();

  // Fetch branches
  const { data: branchesData, isLoading } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get<BranchesResponse>('/branches');
      return unwrapArray<Branch>(response.data);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update branches in store when data is fetched
  useEffect(() => {
    if (branchesData) {
      setBranches(branchesData);

      const availableBranchData = user?.role === 'super_admin'
        ? branchesData
        : branchesData.filter((branch) => branch._id === user?.branchId);
      const selectedBranchIsAvailable = availableBranchData.some(
        (branch) => branch._id === selectedBranch?._id
      );

      // Auto-select branch based on user role
      if ((!selectedBranch || !selectedBranchIsAvailable) && availableBranchData.length > 0) {
        if (user?.role === 'super_admin') {
          // Super admin can see all branches, default to HQ if available
          const hq = availableBranchData.find(b => b.isHeadquarters);
          setSelectedBranch(hq || availableBranchData[0]);
        } else if (user?.branchId) {
          // Branch-specific users should see their branch
          const userBranch = availableBranchData.find(b => b._id === user.branchId);
          if (userBranch) {
            setSelectedBranch(userBranch);
          }
        }
      }
    }
  }, [branchesData, selectedBranch, user, setSelectedBranch, setBranches]);

  // Filter branches based on user role
  const availableBranches = user?.role === 'super_admin' 
    ? branches 
    : branches.filter(b => b._id === user?.branchId);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branchId = e.target.value;
    const branch = branches.find(b => b._id === branchId);
    if (branch) {
      setSelectedBranch(branch);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full sm:w-64">
        <Select
          label={hideLabel ? undefined : 'Branch'}
          aria-label="Branch"
          options={[{ value: '', label: 'Loading...' }]}
          disabled
        />
      </div>
    );
  }

  if (availableBranches.length === 0) {
    return null;
  }

  // If user has only one branch, show it as read-only
  if (availableBranches.length === 1 && user?.role !== 'super_admin') {
    const branch = availableBranches[0];
    return (
      <div className="w-full sm:w-64 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Outlet</p>
        <p className="truncate text-sm font-semibold text-white">{branch.name}</p>
      </div>
    );
  }

  return (
    <div className="w-full sm:w-64">
      <Select
        label={hideLabel ? undefined : 'Branch'}
        aria-label="Branch"
        options={availableBranches.map(branch => ({
          value: branch._id,
          label: `${branch.name} ${branch.isHeadquarters ? '(HQ)' : ''}`,
        }))}
        value={getBranchId(selectedBranch) || ''}
        onChange={handleBranchChange}
      />
    </div>
  );
};
