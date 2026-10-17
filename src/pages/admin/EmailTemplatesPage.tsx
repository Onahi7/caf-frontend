import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Error } from '../../components/ui/Error';
import { queryKeys } from '../../lib/query-keys';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { getErrorMessage } from '../../lib/error-utils';

interface EmailTemplate {
  _id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailTemplateFormData {
  name: string;
  subject: string;
  body: string;
  type: string;
}

export const EmailTemplatesPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const requestConfirmation = useConfirm();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmailTemplateFormData>();

  // Fetch email templates
  const { data: templates, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.emailTemplates.list(),
    queryFn: async () => {
      const response = await apiClient.get('/email/templates');
      return unwrapArray<EmailTemplate>(response.data);
    },
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: EmailTemplateFormData) => {
      return apiClient.post('/email/templates', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all(), exact: false });
      setIsModalOpen(false);
      reset();
      showSuccess('Template created');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to create template')),
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async (data: EmailTemplateFormData) => {
      if (!editingTemplate) return;
      return apiClient.patch(`/email/templates/${editingTemplate._id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all(), exact: false });
      setIsModalOpen(false);
      setEditingTemplate(null);
      reset();
      showSuccess('Template updated');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to update template')),
  });

  // Toggle template status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiClient.patch(`/email/templates/${templateId}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all(), exact: false });
      showSuccess('Template status updated');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to update template status')),
  });

  const handleToggleStatus = async (template: EmailTemplate) => {
    if (template.isActive) {
      const confirmed = await requestConfirmation({
        title: 'Deactivate template?',
        message: `"${template.name}" will stop being used for ${template.type} emails until it is reactivated.`,
        confirmLabel: 'Deactivate',
        variant: 'warning',
      });
      if (!confirmed) return;
    }
    toggleStatusMutation.mutate(template._id);
  };

  const handleOpenModal = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      reset({
        name: template.name,
        subject: template.subject,
        body: template.body,
        type: template.type,
      });
    } else {
      setEditingTemplate(null);
      reset({
        name: '',
        subject: '',
        body: '',
        type: 'general',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
    reset();
  };

  const onSubmit = (data: EmailTemplateFormData) => {
    if (editingTemplate) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { key: 'name', header: 'Template Name' },
    { key: 'subject', header: 'Subject' },
    {
      key: 'type',
      header: 'Type',
      render: (template: EmailTemplate) => (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300">
          {template.type}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (template: EmailTemplate) => (
        template.isActive ? (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300">
            Active
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300">
            Inactive
          </span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (template: EmailTemplate) => (
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPreviewTemplate(template)}
          >
            Preview
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenModal(template)}
          >
            Edit
          </Button>
          <Button
            variant={template.isActive ? 'danger' : 'primary'}
            size="sm"
            onClick={() => void handleToggleStatus(template)}
            isLoading={toggleStatusMutation.isPending && toggleStatusMutation.variables === template._id}
          >
            {template.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Email Templates</h1>
            <p className="text-sm text-slate-400 mt-1">Configure automated notifications, receipts, and order updates</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-emerald-500/15">
            Create Template
          </Button>
        </div>

        {/* Templates Table */}
        {error ? (
          <Error message="Failed to load email templates" onRetry={() => { void refetch(); }} />
        ) : (
          <Table
            data={templates || []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No email templates found"
          />
        )}

        {/* Template Form Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingTemplate ? 'Edit Template' : 'Create Template'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Template Name"
              {...register('name', { required: 'Template name is required' })}
              error={errors.name?.message}
            />

            <Select
              label="Template Type"
              {...register('type', { required: 'Type is required' })}
              error={errors.type?.message}
            >
              <option value="general">General</option>
              <option value="receipt">Receipt</option>
              <option value="notification">Notification</option>
              <option value="promotion">Promotion</option>
              <option value="reminder">Reminder</option>
            </Select>

            <Input
              label="Email Subject"
              {...register('subject', { required: 'Subject is required' })}
              error={errors.subject?.message}
            />

            <Textarea
              label="Email Body"
              required
              rows={10}
              placeholder="Use {{variableName}} for dynamic content"
              helperText="Available variables: {{customerName}}, {{amount}}, {{date}}, {{branchName}}"
              error={errors.body?.message}
              {...register('body', { required: 'Body is required' })}
            />

            <div className="flex justify-end space-x-3 pt-4">
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
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Preview Modal */}
        {previewTemplate && (
          <Modal
            isOpen={!!previewTemplate}
            onClose={() => setPreviewTemplate(null)}
            title="Template Preview"
          >
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-400">Subject:</h3>
                <p className="text-lg font-semibold text-slate-100">{previewTemplate.subject}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white/50">Body:</h3>
                <div className="mt-2 p-4 bg-black/30 rounded-md">
                  <pre className="whitespace-pre-wrap text-sm text-white/70">
                    {previewTemplate.body}
                  </pre>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setPreviewTemplate(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
};
