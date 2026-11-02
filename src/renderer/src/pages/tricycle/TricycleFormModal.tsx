import { useState, useEffect } from 'react'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { Spinner } from '../../components/ui/Spinner'
import { addDocumentWithFile, updateDocumentWithFile, openStoredFile } from '../../lib/db'
import type { Tricycle } from '../../types'
import { toast } from 'sonner'
import { toInputDate } from '../../lib/utils'

const NATURE_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'Reissued', label: 'Reissued' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Compliance', label: 'Compliance' },
  { value: 'Legal Sale', label: 'Legal Sale' },
  { value: 'Illegal Sale', label: 'Illegal Sale' },
  { value: 'Amnesty', label: 'Amnesty' },
  { value: 'Transfer', label: 'Transfer' }
]
const CATEGORY_OPTIONS = [
  { value: 'City', label: 'City' },
  { value: 'Barangay', label: 'Barangay' },
  { value: 'Reissue', label: 'Reissue' }
]
const ACTION_OPTIONS = [
  { value: 'Approved', label: 'Approved' },
  { value: 'Disapproved', label: 'Disapproved' },
  { value: 'Pending', label: 'Pending' }
]

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  logActivity: (activity: string) => Promise<void>
  tricycle?: Tricycle
}

export function TricycleFormModal({ open, onClose, onSuccess, logActivity, tricycle }: Props) {
  const isEdit = !!tricycle
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    name: '',
    address: '',
    make: '',
    motorNo: '',
    chassisNo: '',
    plateNo: '',
    franchiseNo: '',
    ordinanceNumber: '',
    expiration: '',
    dateReceived: '',
    timeReceived: '',
    natureOfFranchise: 'New',
    category: 'City',
    action: 'Approved'
  })

  useEffect(() => {
    if (open) {
      if (tricycle) {
        setForm({
          name: tricycle.name ?? '',
          address: tricycle.address ?? '',
          make: tricycle.make ?? '',
          motorNo: tricycle.motorNo ?? '',
          chassisNo: tricycle.chassisNo ?? '',
          plateNo: tricycle.plateNo ?? '',
          franchiseNo: tricycle.franchiseNo ?? '',
          ordinanceNumber: tricycle.ordinanceNumber ?? '',
          expiration: toInputDate(tricycle.expiration),
          dateReceived: toInputDate(tricycle.dateReceived),
          timeReceived: tricycle.timeReceived ?? '',
          natureOfFranchise: tricycle.natureOfFranchise ?? 'New',
          category: tricycle.category ?? 'City',
          action: tricycle.action ?? 'Approved'
        })
      } else {
        setForm({
          name: '',
          address: '',
          make: '',
          motorNo: '',
          chassisNo: '',
          plateNo: '',
          franchiseNo: '',
          ordinanceNumber: '',
          expiration: '',
          dateReceived: '',
          timeReceived: '',
          natureOfFranchise: 'New',
          category: 'City',
          action: 'Approved'
        })
      }
      setFile(null)
    }
  }, [open, tricycle])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.franchiseNo.trim()) {
      toast.error('Applicant Name and Franchise Number are required')
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await updateDocumentWithFile(
          'tricycle_franchises',
          tricycle!.id,
          { ...form },
          'tricycle',
          form.name,
          file,
          tricycle?.filePath ?? '',
          tricycle?.fileType ?? ''
        )
        await logActivity(`Updated Tricycle Franchise: ${form.name}`)
      } else {
        await addDocumentWithFile('tricycle_franchises', { ...form }, 'tricycle', form.name, file)
        await logActivity(`Created Tricycle Franchise: ${form.name}`)
      }
      toast.success(isEdit ? 'Franchise updated' : 'Franchise created')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Franchise' : 'Add Franchise'}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" className="text-white" />
                {isEdit ? 'Updating...' : 'Saving...'}
              </>
            ) : isEdit ? (
              'Update'
            ) : (
              'Save'
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <FormField label="Applicant Name" required className="col-span-2">
          <Input value={form.name} onChange={set('name')} placeholder="Full name of applicant" />
        </FormField>
        <FormField label="Address" className="col-span-2">
          <Input value={form.address} onChange={set('address')} placeholder="Address" />
        </FormField>
        <FormField label="Make/Model">
          <Input value={form.make} onChange={set('make')} placeholder="e.g. Honda" />
        </FormField>
        <FormField label="Plate Number">
          <Input value={form.plateNo} onChange={set('plateNo')} placeholder="Plate number" />
        </FormField>
        <FormField label="Motor Number">
          <Input value={form.motorNo} onChange={set('motorNo')} placeholder="Motor number" />
        </FormField>
        <FormField label="Chassis Number">
          <Input value={form.chassisNo} onChange={set('chassisNo')} placeholder="Chassis number" />
        </FormField>
        <FormField label="Franchise Number" required>
          <Input
            value={form.franchiseNo}
            onChange={set('franchiseNo')}
            placeholder="Franchise number"
          />
        </FormField>
        <FormField label="Ordinance Number">
          <Input
            value={form.ordinanceNumber}
            onChange={set('ordinanceNumber')}
            placeholder="Ordinance number"
          />
        </FormField>
        <FormField label="Expiration Date">
          <Input type="date" value={form.expiration} onChange={set('expiration')} />
        </FormField>
        <FormField label="Nature of Franchise">
          <Select
            options={NATURE_OPTIONS}
            value={form.natureOfFranchise}
            onChange={set('natureOfFranchise')}
          />
        </FormField>
        <FormField label="Category">
          <Select options={CATEGORY_OPTIONS} value={form.category} onChange={set('category')} />
        </FormField>
        <FormField label="Action">
          <Select options={ACTION_OPTIONS} value={form.action} onChange={set('action')} />
        </FormField>
        <FormField label="Date Received">
          <Input type="date" value={form.dateReceived} onChange={set('dateReceived')} />
        </FormField>
        <FormField label="Time Received">
          <Input type="time" value={form.timeReceived} onChange={set('timeReceived')} />
        </FormField>
        <div className="col-span-2 border-t border-slate-100 pt-3">
          <FileUploadField value={file} onChange={setFile} />
          {isEdit && tricycle?.filePath && !file && (
            <p className="text-xs text-slate-500 mt-1.5">
              Current:{' '}
              <button
                type="button"
                onClick={() => void openStoredFile(tricycle.filePath)}
                className="text-indigo-600 hover:underline cursor-pointer"
              >
                View file
              </button>
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}
