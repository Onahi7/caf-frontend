import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Search, UserPlus, Trash2 } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminPageHeader } from '../../components/admin';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
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
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'branch_manager' | 'cashier' | 'auditor' | 'marketer' | 'finance_manager';
  branchId?: string;
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
}

interface UserFormData {
  username: string;
  password?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branchId: string;
}

export const UserManagementPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const currentUser = useAuthStore((state) => state.user);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UserFormData>();

  const selectedRole = watch('role');

  // Check if role requires branch assignment
  const needsBranch = requiresBranchAssignment(selectedRole);
  const requiresBranch = needsBranch;

  // Fetch users
  const { data: users, isLoading, error } = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async () => {
      const response = await apiClient.get('/users');
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as User[];
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
        ...(branches || []).map(branch => ({
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

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const branchId = requiresBranch ? (canChooseBranch ? data.branchId : outletBranchId) : '';
      const payload = {
        ...data,
        branchId: branchId || undefined,
      };
      const response = await apiClient.post('/users', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all(), exact: false });
      setIsModalOpen(false);
      reset();
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
      const branchId = requiresBranch ? (canChooseBranch ? data.branchId : outletBranchId) : '';
      const payload: Partial<UserFormData> = {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        branchId: branchId || undefined,
      };
      // Only include password if it's provided
      if (data.password) {
        payload.password = data.password;
      }
      const response = await apiClient.patch(`/users/${editingUser.id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all(), exact: false });
      setIsModalOpen(false);
      setEditingUser(null);
      reset();
      showSuccess('User updated successfully');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to update user'));
    },
  });

  // Toggle user active status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (targetUser: User) => {
      if (targetUser.isActive) {
        return apiClient.patch(`/users/${targetUser.id}/deactivate`);
      } else {
        return apiClient.patch(`/users/${targetUser.id}`, { isActive: true });
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
    if (user) {
      setEditingUser(user);
      reset({
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        branchId: canChooseBranch ? user.branchId || '' : outletBranchId,
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
        password: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    reset();
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

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesRole;
      const matchesQuery =
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.branchName && u.branchName.toLowerCase().includes(q));
      return matchesRole && matchesQuery;
    });
  }, [users, roleFilter, searchQuery]);

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
      header: 'Branch',
      render: (user: User) => (
        <span className="text-xs sm:text-sm text-slate-300">
          {user.branchName || '—'}
        </span>
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
        const isSelf = currentUser?.id === user.id;
        const canDelete = currentUser?.role === 'super_admin' && !isSelf;
        return (
          <div className="flex items-center justify-end gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleOpenModal(user)}
            >
              Edit
            </Button>
            {!isSelf && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleStatusMutation.mutate(user)}
                isLoading={toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === user.id}
                className={user.isActive ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"}
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

        {/* Search & Role Filter Bar */}
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
          emptyMessage={searchQuery || roleFilter !== 'all' ? "No users match the current search filters" : "No users found"}
          exportFilename="users"
          title="User Accounts"
        />

        {/* Modal */}
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
                {...register('username', { required: 'Username is required' })}
                error={errors.username?.message}
                placeholder="Enter username"
                disabled={!!editingUser}
              />
              <div>
                <Input
                  label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                  type="password"
                  {...register('password', editingUser ? optionalPasswordValidation : passwordValidation)}
                  error={errors.password?.message}
                  placeholder="--------"
                />
                {!editingUser && (
                  <p className="text-xs text-gray-400 mt-1">
                    Min 8 chars with uppercase, lowercase, number & special char (@$!%*?&)
                  </p>
                )}
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
                  disabled={!requiresBranch || !canChooseBranch}
                />
              </div>

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

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          title="Delete User"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Are you sure you want to permanently delete user <strong className="text-white">{userToDelete?.username}</strong> ({userToDelete?.firstName} {userToDelete?.lastName})? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <Button
                variant="secondary"
                onClick={() => setUserToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="!bg-rose-600 hover:!bg-rose-500 !text-white shadow-lg shadow-rose-600/20"
                isLoading={deleteMutation.isPending}
                onClick={() => userToDelete && deleteMutation.mutate(userToDelete.id)}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};
