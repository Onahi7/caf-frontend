import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Search,
  UserPlus,
  Trash2,
  Sparkles,
  Copy,
  Check,
  Info,
  KeyRound,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminPageHeader } from '../../components/admin';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/error-utils';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth-store';
import {
  passwordValidation,
  optionalPasswordValidation,
  emailValidation,
  nameValidation,
  requiresBranchAssignment,
} from '../../lib/validation';

interface User {
  id: string;
  _id?: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'branch_manager' | 'cashier' | 'auditor' | 'marketer' | 'finance_manager';
  branchId?: string;
  fieldZoneCode?: 'WEST' | 'CENTRAL' | 'EAST';
  branchName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Branch {
  id: string;
  _id?: string;
  name: string;
  code: string;
  isHeadquarters?: boolean;
  isActive?: boolean;
}

interface UserFormData {
  username: string;
  password?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branchId: string;
  fieldZoneCode?: 'WEST' | 'CENTRAL' | 'EAST' | '';
}

interface OnboardingCardData {
  name: string;
  username: string;
  password: string;
  role: string;
  branchName?: string;
  zoneCode?: string;
  portalUrl: string;
  isReset?: boolean;
}

const roleDescriptions: Record<string, string> = {
  cashier: 'Processes sales at checkout, handles cash drawers & receipts at assigned branch.',
  marketer: 'Visits hospitals, clinics and pharmacies in assigned zone. Logs interactions and submits daily collections.',
  branch_manager: 'Supervises branch inventory, staff access, daily operational reconciliation, and stock transfers.',
  finance_manager: 'Reviews branch cash remittances, bank deposits, daily field collections, and expense ledgers.',
  auditor: 'Audits pharmacy stock levels, cash variance logs, and compliance records across all outlets.',
  super_admin: 'Complete administrative access to all system settings, user accounts, branches, and financials.',
};

export const UserManagementPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [onboardingCard, setOnboardingCard] = useState<OnboardingCardData | null>(null);
  const [cardCopied, setCardCopied] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [justGeneratedPassword, setJustGeneratedPassword] = useState<string | null>(null);
  const [hasCopiedPassword, setHasCopiedPassword] = useState(false);

  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const currentUser = useAuthStore((state) => state.user);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormData>();

  const selectedRole = watch('role');
  const watchedFirstName = watch('firstName');
  const watchedLastName = watch('lastName');
  const watchedUsername = watch('username');

  // Suggest username from first + last name when creating a new user
  const suggestedUsername = useMemo(() => {
    if (!watchedFirstName || !watchedLastName) return '';
    return `${watchedFirstName[0]}${watchedLastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  }, [watchedFirstName, watchedLastName]);

  // Check if role requires branch assignment
  const needsBranch = requiresBranchAssignment(selectedRole);
  const requiresBranch = needsBranch;

  // Fetch users
  const { data: users, isLoading, error } = useQuery({
    queryKey: [...queryKeys.users.list(), currentUser?.id, currentUser?.role, currentUser?.branchId],
    queryFn: async () => {
      const users: User[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const response = await apiClient.get('/users', { params: { page, limit: 100 } });
        const payload = response.data?.data ?? response.data;
        const batch: User[] = Array.isArray(payload) ? payload : [];
        users.push(...batch.map((u) => ({ ...u, id: u.id || u._id || '' })));
        hasNext = batch.length > 0 && response.data?.pagination?.hasNext === true;
        page += 1;
      }
      return users;
    },
  });

  // Fetch branches for dropdown
  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as Branch[];
    },
  });

  const currentUserBranch = branches?.find(
    (branch) => (branch._id || branch.id) === currentUser?.branchId,
  );
  const canChooseBranch =
    currentUser?.role === 'super_admin' ||
    (currentUser?.role === 'branch_manager' && Boolean(currentUserBranch?.isHeadquarters));
  const outletBranchId = canChooseBranch ? '' : currentUser?.branchId || '';
  const branchOptions = canChooseBranch
    ? [
        { value: '', label: requiresBranch ? 'Select a branch' : 'No branch (HQ)' },
        ...(branches || []).filter(branch => branch.isActive !== false).map(branch => ({
          value: branch._id || branch.id,
          label: `${branch.name} (${branch.code})`,
        })),
      ]
    : [
        {
          value: outletBranchId,
          label: currentUserBranch
            ? `${currentUserBranch.name} (${currentUserBranch.code})`
            : 'Your outlet',
        },
      ];
  const roleOptions =
    currentUser?.role === 'super_admin'
      ? [
          { value: 'cashier', label: 'Cashier' },
          { value: 'marketer', label: 'Marketer' },
          { value: 'finance_manager', label: 'Finance Manager' },
          { value: 'branch_manager', label: 'Branch Manager' },
          { value: 'auditor', label: 'Auditor' },
          { value: 'super_admin', label: 'Super Admin' },
        ]
      : canChooseBranch
        ? [
            { value: 'cashier', label: 'Cashier' },
            { value: 'marketer', label: 'Marketer' },
            { value: 'finance_manager', label: 'Finance Manager' },
            { value: 'branch_manager', label: 'Branch Manager' },
            { value: 'auditor', label: 'Auditor' },
          ]
        : [
            { value: 'cashier', label: 'Cashier' },
            { value: 'marketer', label: 'Marketer' },
          ];

  // Helper to generate a memorable, friendly password
  const generatePasswordString = () => {
    const prefixes = ['Care', 'Farm', 'Kono', 'Salone', 'Pharma', 'Health'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomDigits = Math.floor(100 + Math.random() * 900); // 3 digits
    const symbols = ['!', '@', '#', '$'];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    return `${randomPrefix}${randomDigits}${randomSymbol}`;
  };

  const handleGeneratePassword = () => {
    const generated = generatePasswordString();
    setValue('password', generated, { shouldValidate: true, shouldDirty: true });
    setJustGeneratedPassword(generated);
    setHasCopiedPassword(false);

    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(generated);
        setHasCopiedPassword(true);
        showSuccess(`Generated & copied to clipboard: ${generated}`);
      } else {
        showSuccess(`Generated password: ${generated}`);
      }
    } catch {
      showSuccess(`Generated password: ${generated}`);
    }
  };

  const handleGenerateResetPassword = () => {
    const generated = generatePasswordString();
    setResetNewPassword(generated);
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(generated);
        showSuccess(`Generated & copied: ${generated}`);
      }
    } catch {
      // ignore
    }
  };

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const branchId = canChooseBranch ? data.branchId : outletBranchId;
      const payload = {
        ...data,
        branchId: branchId || undefined,
        fieldZoneCode: data.role === 'marketer' ? (data.fieldZoneCode || undefined) : undefined,
      };
      const response = await apiClient.post('/users', payload);
      return { responseData: response.data, submittedData: data };
    },
    onSuccess: ({ submittedData }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all(), exact: false });
      setIsModalOpen(false);
      reset();
      setJustGeneratedPassword(null);
      setHasCopiedPassword(false);

      const targetBranch = branches?.find(
        (b) => (b._id || b.id) === (canChooseBranch ? submittedData.branchId : outletBranchId),
      );
      const isMarketer = submittedData.role === 'marketer';
      const portalUrl = isMarketer
        ? 'https://caf-marketer.pages.dev'
        : window.location.origin;

      setOnboardingCard({
        name: `${submittedData.firstName} ${submittedData.lastName}`,
        username: submittedData.username,
        password: submittedData.password || '',
        role: roleLabels[submittedData.role] || submittedData.role,
        branchName: targetBranch?.name || 'Headquarters / All Branches',
        zoneCode: submittedData.fieldZoneCode || undefined,
        portalUrl,
        isReset: false,
      });
      showSuccess('User created successfully');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to create user'));
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      if (!editingUser) return;
      const branchId = canChooseBranch ? data.branchId : outletBranchId;
      const payload: Omit<Partial<UserFormData>, 'branchId' | 'fieldZoneCode'> & { branchId?: string | null; fieldZoneCode?: UserFormData['fieldZoneCode'] | null } = {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        branchId: branchId || null,
        fieldZoneCode: data.role === 'marketer' ? (data.fieldZoneCode || null) : null,
      };
      // Only include password if it's provided
      if (data.password) {
        payload.password = data.password;
      }
      const response = await apiClient.patch(`/users/${editingUser._id || editingUser.id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all(), exact: false });
      setIsModalOpen(false);
      setEditingUser(null);
      reset();
      setJustGeneratedPassword(null);
      setHasCopiedPassword(false);
      showSuccess('User updated successfully');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to update user'));
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      return apiClient.patch(`/users/${userId}`, { password: newPassword });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all(), exact: false });
      const targetUser = userToReset;
      setUserToReset(null);

      if (targetUser) {
        const isMarketer = targetUser.role === 'marketer';
        const portalUrl = isMarketer
          ? 'https://caf-marketer.pages.dev'
          : window.location.origin;

        setOnboardingCard({
          name: `${targetUser.firstName} ${targetUser.lastName}`,
          username: targetUser.username,
          password: variables.newPassword,
          role: roleLabels[targetUser.role] || targetUser.role,
          branchName: targetUser.branchName || 'Headquarters',
          zoneCode: targetUser.fieldZoneCode || undefined,
          portalUrl,
          isReset: true,
        });
      }
      showSuccess('Password reset successfully');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to reset password'));
    },
  });

  // Toggle user active status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (targetUser: User) => {
      const targetUserId = targetUser._id || targetUser.id;
      if (targetUser.isActive) {
        return apiClient.patch(`/users/${targetUserId}/deactivate`);
      } else {
        return apiClient.patch(`/users/${targetUserId}`, { isActive: true });
      }
    },
    onSuccess: (_, targetUser) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all(), exact: false });
      showSuccess(`User ${targetUser.username} ${targetUser.isActive ? 'deactivated' : 'activated'} successfully`);
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to update user status'));
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return apiClient.delete(`/users/${targetUserId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all(), exact: false });
      setUserToDelete(null);
      showSuccess('User deleted permanently');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to delete user'));
    },
  });

  const handleOpenModal = (user?: User) => {
    setJustGeneratedPassword(null);
    setHasCopiedPassword(false);
    if (user) {
      setEditingUser(user);
      reset({
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        branchId: canChooseBranch ? user.branchId || '' : outletBranchId,
        fieldZoneCode: user.fieldZoneCode || '',
        password: '',
      });
    } else {
      setEditingUser(null);
      reset({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'cashier',
        branchId: outletBranchId,
        fieldZoneCode: '',
        password: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setJustGeneratedPassword(null);
    setHasCopiedPassword(false);
    reset();
  };

  const handleOpenResetModal = (user: User) => {
    setUserToReset(user);
    const initialPass = generatePasswordString();
    setResetNewPassword(initialPass);
  };

  const onSubmit = (data: UserFormData) => {
    if (editingUser) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    branch_manager: 'Branch Manager',
    cashier: 'Cashier',
    auditor: 'Auditor',
    marketer: 'Marketer',
    finance_manager: 'Finance Manager',
  };

  const roleStyles: Record<string, string> = {
    super_admin: 'bg-purple-500/15 text-purple-300 border border-purple-500/25',
    branch_manager: 'bg-blue-500/15 text-blue-300 border border-blue-500/25',
    cashier: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
    auditor: 'bg-slate-500/15 text-slate-300 border border-slate-500/25',
    marketer: 'bg-orange-500/15 text-orange-300 border border-orange-500/25',
    finance_manager: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
  };

  // Role & status counts for quick-filter chips
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users?.length || 0, active: 0, inactive: 0 };
    users?.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
      if (u.isActive) counts.active += 1;
      else counts.inactive += 1;
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.isActive) ||
        (statusFilter === 'inactive' && !u.isActive);
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesRole && matchesStatus;
      const matchesQuery =
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.branchName && u.branchName.toLowerCase().includes(q));
      return matchesRole && matchesStatus && matchesQuery;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Formatted onboarding text for WhatsApp or clipboard
  const welcomeText = useMemo(() => {
    if (!onboardingCard) return '';
    return (
      `👋 Hello ${onboardingCard.name},\n\n` +
      `Your CareFarm staff account has been ${onboardingCard.isReset ? 'reset' : 'created'} successfully:\n` +
      `• Username: ${onboardingCard.username}\n` +
      `• Password: ${onboardingCard.password}\n` +
      `• Role: ${onboardingCard.role}\n` +
      (onboardingCard.branchName ? `• Branch: ${onboardingCard.branchName}\n` : '') +
      (onboardingCard.zoneCode ? `• Field Zone: ${onboardingCard.zoneCode} Zone\n` : '') +
      `• Sign In URL: ${onboardingCard.portalUrl}\n\n` +
      `Please sign in and change your password upon login.`
    );
  }, [onboardingCard]);

  const handleCopyWelcomeCard = () => {
    if (!welcomeText) return;
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(welcomeText);
        setCardCopied(true);
        showSuccess('Welcome message copied to clipboard!');
        setTimeout(() => setCardCopied(false), 2500);
      }
    } catch {
      showError('Failed to copy message');
    }
  };

  const handleShareWhatsApp = () => {
    if (!welcomeText) return;
    const url = `https://wa.me/?text=${encodeURIComponent(welcomeText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (user: User) => (
        <div>
          <div className="font-semibold text-white">{`${user.firstName} ${user.lastName}`}</div>
          <div className="text-xs text-slate-400">@{user.username}</div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user: User) => <span className="text-slate-300 text-xs sm:text-sm font-mono">{user.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: User) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleStyles[user.role] || 'bg-slate-500/15 text-slate-300 border-slate-500/25'}`}
        >
          {roleLabels[user.role] || user.role}
        </span>
      ),
    },
    {
      key: 'branch',
      header: 'Branch & Assignment',
      render: (user: User) => (
        <div className="text-xs sm:text-sm">
          <div className="font-medium text-slate-200">{user.branchName || 'No branch (HQ)'}</div>
          {user.role === 'marketer' && user.fieldZoneCode && (
            <div className="mt-0.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {user.fieldZoneCode} Zone
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: User) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
            user.isActive
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span>{user.isActive ? 'Active' : 'Inactive'}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (user: User) => {
        const currentUserId = (currentUser as any)?._id || currentUser?.id;
        const targetUserId = user._id || user.id;
        const isSelf = Boolean(currentUserId && targetUserId && currentUserId === targetUserId);
        const canDelete = currentUser?.role === 'super_admin' && !isSelf;
        const canManage = currentUser?.role === 'super_admin' ||
          (user.role !== 'super_admin' && (canChooseBranch || ['cashier', 'marketer'].includes(user.role)));
        const isTogglingThisUser = toggleStatusMutation.isPending && 
          ((toggleStatusMutation.variables?._id || toggleStatusMutation.variables?.id) === targetUserId);
        return (
          <div className="flex items-center justify-end gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleOpenModal(user)}
              disabled={!canManage}
            >
              Edit
            </Button>
            {canManage && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenResetModal(user)}
                title="Reset password for this user"
                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            )}
            {!isSelf && canManage && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleStatusMutation.mutate(user)}
                isLoading={isTogglingThisUser}
                className={user.isActive ? "text-slate-400 hover:text-rose-300 hover:bg-rose-500/10" : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"}
              >
                {user.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setUserToDelete(user)}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                title="Delete User"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  if (isLoading) return <AdminLayout title="Users"><Loading /></AdminLayout>;
  if (error) return <AdminLayout title="Users"><Error message="Failed to load users" /></AdminLayout>;

  return (
    <AdminLayout title="Users">
      <div className="space-y-5">
        <AdminPageHeader
          title="Users"
          subtitle="Manage system user credentials, roles, and branch assignments"
          actions={
            <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-emerald-500/15">
              <UserPlus className="w-4 h-4 mr-2" />
              <span>Add User</span>
            </Button>
          }
        />

        {/* Quick Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => { setRoleFilter('all'); setStatusFilter('all'); }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
              roleFilter === 'all' && statusFilter === 'all'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:border-white/10 hover:text-slate-200'
            }`}
          >
            All Users ({roleCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('cashier')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
              roleFilter === 'cashier'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:border-white/10 hover:text-slate-200'
            }`}
          >
            Cashiers ({roleCounts.cashier || 0})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('marketer')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
              roleFilter === 'marketer'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-xs'
                : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:border-white/10 hover:text-slate-200'
            }`}
          >
            Marketers ({roleCounts.marketer || 0})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('branch_manager')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
              roleFilter === 'branch_manager'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs'
                : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:border-white/10 hover:text-slate-200'
            }`}
          >
            Branch Managers ({roleCounts.branch_manager || 0})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('finance_manager')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
              roleFilter === 'finance_manager'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:border-white/10 hover:text-slate-200'
            }`}
          >
            Finance ({roleCounts.finance_manager || 0})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('super_admin')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
              roleFilter === 'super_admin'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:border-white/10 hover:text-slate-200'
            }`}
          >
            Super Admins ({roleCounts.super_admin || 0})
          </button>
          {roleCounts.inactive > 0 && (
            <button
              type="button"
              onClick={() => { setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive'); setRoleFilter('all'); }}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
                  : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:border-white/10 hover:text-rose-300'
              }`}
            >
              Inactive ({roleCounts.inactive})
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Search by name, username, email, or branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="sm:w-56 shrink-0">
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              {Object.entries(roleLabels).map(([roleKey, label]) => (
                <option key={roleKey} value={roleKey}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Users Table */}
        <Table
          data={filteredUsers}
          columns={columns}
          emptyMessage={searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? "No users match the current search filters" : "No users found"}
          exportFilename="users"
          title="User Accounts"
        />

        {/* Add / Edit User Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingUser ? 'Edit User' : 'Add User'}
          size="lg"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Username"
                labelRight={
                  !editingUser && !watchedUsername && suggestedUsername.length >= 3 ? (
                    <button
                      type="button"
                      onClick={() => setValue('username', suggestedUsername, { shouldValidate: true, shouldDirty: true })}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                    >
                      Use @{suggestedUsername}
                    </button>
                  ) : undefined
                }
                {...register('username', { required: 'Username is required' })}
                error={errors.username?.message}
                placeholder="e.g. fkamara"
                disabled={!!editingUser}
              />
              <div>
                <Input
                  label={editingUser ? 'New Password' : 'Password'}
                  labelRight={
                    <div className="flex items-center gap-2">
                      {justGeneratedPassword && (
                        <button
                          type="button"
                          onClick={() => {
                            if (justGeneratedPassword && navigator.clipboard) {
                              navigator.clipboard.writeText(justGeneratedPassword);
                              setHasCopiedPassword(true);
                              showSuccess('Password copied to clipboard!');
                            }
                          }}
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                        >
                          {hasCopiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{hasCopiedPassword ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                        title="Generate random password"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{editingUser ? 'Generate New' : 'Generate'}</span>
                      </button>
                    </div>
                  }
                  type="password"
                  {...register('password', editingUser ? optionalPasswordValidation : passwordValidation)}
                  error={errors.password?.message}
                  placeholder={editingUser ? "Leave blank to keep existing password" : "Enter password (min 6 characters)"}
                  helperText={
                    editingUser
                      ? "Leave blank to keep current password. Enter at least 6 characters to reset."
                      : "Minimum 6 characters. Letters, numbers, and symbols are all accepted."
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                {...register('firstName', nameValidation)}
                error={errors.firstName?.message}
                placeholder="Enter first name"
              />
              <Input
                label="Last Name"
                {...register('lastName', nameValidation)}
                error={errors.lastName?.message}
                placeholder="Enter last name"
              />
            </div>

            <Input
              label="Email"
              type="email"
              {...register('email', emailValidation)}
              error={errors.email?.message}
              placeholder="user@pharmacy.com"
            />

            {/* Role and Branch Assignment */}
            <div className="border-t border-white/[0.08] pt-4 mt-4">
              <h3 className="text-base font-semibold text-white mb-3">Role & Access</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Role"
                  {...register('role', { required: 'Role is required' })}
                  error={errors.role?.message}
                  options={roleOptions}
                />
                <Select
                  label="Branch"
                  {...register('branchId', { 
                    required: requiresBranch ? 'Branch is required for this role' : false 
                  })}
                  error={errors.branchId?.message}
                  options={branchOptions}
                  disabled={!canChooseBranch}
                />
                {selectedRole === 'marketer' && (
                  <Select
                    label="Freetown Zone"
                    {...register('fieldZoneCode', { required: 'Zone is required for a marketer' })}
                    error={errors.fieldZoneCode?.message}
                    options={[
                      { value: '', label: 'Select a zone' },
                      { value: 'WEST', label: 'West Zone (Wilberforce, Lumley, Goderich)' },
                      { value: 'CENTRAL', label: 'Central Zone (CBD, Brookfields, Congo Cross)' },
                      { value: 'EAST', label: 'East Zone (Kissy, Wellington, Calaba Town)' },
                    ]}
                  />
                )}
              </div>

              {selectedRole && roleDescriptions[selectedRole] && (
                <div className="mt-3 p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-300 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">{roleLabels[selectedRole] || selectedRole}: </span>
                    {roleDescriptions[selectedRole]}
                  </div>
                </div>
              )}

              {requiresBranch && (
                <p className="text-xs text-slate-400 mt-2">
                  {canChooseBranch
                    ? 'This role requires branch assignment'
                    : 'Outlet users are automatically assigned to your outlet'}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {editingUser ? 'Update User' : 'Create User'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Quick Reset Password Modal */}
        <Modal
          isOpen={!!userToReset}
          onClose={() => setUserToReset(null)}
          title={`Reset Password: ${userToReset?.firstName} ${userToReset?.lastName}`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Generate or enter a new temporary password for <strong className="text-white">@{userToReset?.username}</strong>.
              You will be able to share the updated login credentials via WhatsApp or copy them immediately.
            </p>

            <Input
              label="New Temporary Password"
              labelRight={
                <button
                  type="button"
                  onClick={handleGenerateResetPassword}
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate</span>
                </button>
              }
              type="password"
              value={resetNewPassword}
              onChange={(e) => setResetNewPassword(e.target.value)}
              placeholder="Enter at least 6 characters"
              helperText="Minimum 6 characters. Letters, numbers, and symbols are accepted."
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setUserToReset(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const targetId = userToReset?._id || userToReset?.id;
                  if (targetId && resetNewPassword.trim().length >= 6) {
                    resetPasswordMutation.mutate({ userId: targetId, newPassword: resetNewPassword.trim() });
                  } else {
                    showError('Password must be at least 6 characters long');
                  }
                }}
                isLoading={resetPasswordMutation.isPending}
                disabled={resetNewPassword.trim().length < 6}
              >
                Save & Show Welcome Card
              </Button>
            </div>
          </div>
        </Modal>

        {/* Staff Account Ready / WhatsApp Credential Share Modal */}
        <Modal
          isOpen={!!onboardingCard}
          onClose={() => setOnboardingCard(null)}
          title={onboardingCard?.isReset ? 'Password Reset Successful' : 'Staff Account Ready'}
          size="md"
        >
          {onboardingCard && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white">{onboardingCard.name}</span>'s account credentials are ready.
                  Share them directly with the staff member.
                </div>
              </div>

              {/* Credential summary card */}
              <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400 font-sans">Full Name</span>
                  <span className="text-white font-semibold">{onboardingCard.name}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400 font-sans">Username</span>
                  <span className="text-emerald-300 font-bold">@{onboardingCard.username}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400 font-sans">Temporary Password</span>
                  <span className="text-amber-300 font-bold select-all">{onboardingCard.password || '••••••••'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400 font-sans">System Role</span>
                  <span className="text-slate-200 capitalize font-sans">{onboardingCard.role}</span>
                </div>
                {onboardingCard.branchName && (
                  <div className="flex items-center justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400 font-sans">Assigned Branch</span>
                    <span className="text-slate-200 font-sans">{onboardingCard.branchName}</span>
                  </div>
                )}
                {onboardingCard.zoneCode && (
                  <div className="flex items-center justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400 font-sans">Field Zone</span>
                    <span className="text-emerald-400 font-sans font-semibold">{onboardingCard.zoneCode} Zone</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400 font-sans">Portal URL</span>
                  <a
                    href={onboardingCard.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-sans underline"
                  >
                    <span>{onboardingCard.portalUrl.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Share Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCopyWelcomeCard}
                  className="w-full"
                >
                  {cardCopied ? <Check className="w-4 h-4 mr-2 text-emerald-400" /> : <Copy className="w-4 h-4 mr-2" />}
                  <span>{cardCopied ? 'Copied to Clipboard' : 'Copy Welcome Text'}</span>
                </Button>
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  <span>Send via WhatsApp</span>
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setOnboardingCard(null)}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Done, close window
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={() => {
            const id = userToDelete?._id || userToDelete?.id;
            if (id) deleteMutation.mutate(id);
          }}
          title="Delete User"
          message={`Are you sure you want to permanently delete user "${userToDelete?.username}" (${userToDelete?.firstName} ${userToDelete?.lastName})? This action cannot be undone.`}
          confirmLabel="Delete Permanently"
          variant="danger"
          isLoading={deleteMutation.isPending}
        />
      </div>
    </AdminLayout>
  );
};
