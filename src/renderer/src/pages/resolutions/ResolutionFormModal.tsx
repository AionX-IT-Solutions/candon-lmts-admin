import { useState, useEffect } from 'react'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select, TextArea } from '../../components/ui/FormField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { Spinner } from '../../components/ui/Spinner'
import { addDocumentWithFile, updateDocumentWithFile, openStoredFile } from '../../lib/db'
import type { Resolution } from '../../types'
import { toast } from 'sonner'
import { toInputDate } from '../../lib/utils'

const ACTION_SP_OPTIONS = [
  { value: 'Approved', label: 'Approved' },
  { value: 'Disapproved', label: 'Disapproved' },
  { value: 'Others', label: 'Others' }
]
const ACTION_MAYOR_OPTIONS = [
  { value: 'Approved', label: 'Approved' },
  { value: 'Disapproved', label: 'Disapproved' },
  { value: 'Vetoed', label: 'Vetoed' },
  { value: 'Returned', label: 'Returned' },
  { value: 'Others', label: 'Others' }
]
const CATEGORIES = [
  { value: 'General Resolutions', label: 'General Resolutions' },
  { value: 'Commendations', label: 'Commendations' },
  { value: 'Posthumous', label: 'Posthumous' }
]

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  logActivity: (activity: string) => Promise<void>
  resolution?: Resolution
}

export function ResolutionFormModal({ open, onClose, onSuccess, logActivity, resolution }: Props) {
  const isEdit = !!resolution
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    resolutionNumber: '',
    category: 'General Resolutions',
    title: '',
    author: '',
    tag: '',
    dateApprovedSp: '',
    actionSp: '',
    actionSpOther: '',
    transmittedDateMayor: '',
    actionMayor: '',
    actionMayorOther: '',
    transmittedDateSP: '',
    actionTSp: '',
    actionTSpOther: '',
    dateReceived: '',
    postingDate: '',
    publicationDate: ''
  })

  useEffect(() => {
    if (open) {
      if (resolution) {
        setForm({
          resolutionNumber: resolution.resolutionNumber ?? '',
          category: resolution.category ?? 'General Resolutions',
          title: resolution.title ?? '',
          author: resolution.author ?? '',
          tag: resolution.tag ?? '',
          dateApprovedSp: toInputDate(resolution.dateApprovedSp),
          actionSp: resolution.actionSp ?? '',
          actionSpOther: '',
          transmittedDateMayor: toInputDate(resolution.transmittedDateMayor),
          actionMayor: resolution.actionMayor ?? '',
          actionMayorOther: '',
          transmittedDateSP: toInputDate(resolution.transmittedDateSP),
          actionTSp: resolution.actionTSp ?? '',
          actionTSpOther: '',
          dateReceived: toInputDate(resolution.dateReceived),
          postingDate: toInputDate(resolution.postingDate),
          publicationDate: toInputDate(resolution.publicationDate)
        })
      } else {
        setForm({
          resolutionNumber: '',
          category: 'General Resolutions',
          title: '',
          author: '',
          tag: '',
          dateApprovedSp: '',
          actionSp: '',
          actionSpOther: '',
          transmittedDateMayor: '',
          actionMayor: '',
          actionMayorOther: '',
          transmittedDateSP: '',
          actionTSp: '',
          actionTSpOther: '',
          dateReceived: '',
          postingDate: '',
          publicationDate: ''
        })
      }
      setFile(null)
    }
  }, [open, resolution])

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.resolutionNumber.trim() || !form.title.trim() || !form.author.trim()) {
      toast.error('Resolution Number, Title, and Author are required')
      return
    }
    setSaving(true)
    try {
      const fields = {
        resolutionNumber: form.resolutionNumber,
        category: form.category,
        title: form.title,
        author: form.author,
        tag: form.tag,
        dateApprovedSp: form.dateApprovedSp,
        actionSp: form.actionSp === 'Others' ? form.actionSpOther : form.actionSp,
        transmittedDateMayor: form.transmittedDateMayor,
        actionMayor: form.actionMayor === 'Others' ? form.actionMayorOther : form.actionMayor,
        transmittedDateSP: form.transmittedDateSP,
        actionTSp: form.actionTSp === 'Others' ? form.actionTSpOther : form.actionTSp,
        dateReceived: form.dateReceived,
        postingDate: form.postingDate,
        publicationDate: form.publicationDate,
        created: isEdit ? resolution!.created : new Date().toLocaleDateString(),
        updated: new Date().toLocaleDateString()
      }
      if (isEdit) {
        await updateDocumentWithFile(
          'resolutions',
          resolution!.id,
          fields,
          'Resolutions',
          `ResolutionNo._${form.resolutionNumber}`,
          file,
          resolution?.filePath ?? '',
          resolution?.fileType ?? ''
        )
        await logActivity(`Updated Resolution Number ${form.resolutionNumber}`)
      } else {
        await addDocumentWithFile(
          'resolutions',
          fields,
          'Resolutions',
          `ResolutionNo._${form.resolutionNumber}`,
          file
        )
        await logActivity(`Created Resolution Number ${form.resolutionNumber}`)
      }
      toast.success(isEdit ? 'Resolution updated' : 'Resolution created')
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
      title={isEdit ? 'Edit Resolution' : 'Add New Resolution'}
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
                {isEdit ? 'Updating...' : 'Creating...'}
              </>
            ) : isEdit ? (
              'Update'
            ) : (
              'Create'
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <FormField label="Resolution Number" required>
          <Input
            value={form.resolutionNumber}
            onChange={set('resolutionNumber')}
            placeholder="e.g. 2024-001"
          />
        </FormField>
        <FormField label="Category" required>
          <Select options={CATEGORIES} value={form.category} onChange={set('category')} />
        </FormField>
        <FormField label="Title" required className="col-span-2">
          <TextArea
            value={form.title}
            onChange={set('title')}
            rows={3}
            placeholder="Resolution title"
          />
        </FormField>
        <FormField label="Author" required>
          <Input value={form.author} onChange={set('author')} placeholder="Author name" />
        </FormField>
        <FormField label="Tag">
          <Input value={form.tag} onChange={set('tag')} placeholder="Keywords/tags" />
        </FormField>
        <div className="col-span-2 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date Approved (SP)">
              <Input type="date" value={form.dateApprovedSp} onChange={set('dateApprovedSp')} />
            </FormField>
            <FormField label="Action of SP">
              <Select
                options={ACTION_SP_OPTIONS}
                value={form.actionSp}
                onChange={set('actionSp')}
                placeholder="Select action"
              />
            </FormField>
            {form.actionSp === 'Others' && (
              <FormField label="Specify" className="col-span-2">
                <Input value={form.actionSpOther} onChange={set('actionSpOther')} />
              </FormField>
            )}
            <FormField label="Date Transmitted to Mayor">
              <Input
                type="date"
                value={form.transmittedDateMayor}
                onChange={set('transmittedDateMayor')}
              />
            </FormField>
            <FormField label="Action of Mayor">
              <Select
                options={ACTION_MAYOR_OPTIONS}
                value={form.actionMayor}
                onChange={set('actionMayor')}
                placeholder="Select action"
              />
            </FormField>
            {form.actionMayor === 'Others' && (
              <FormField label="Specify" className="col-span-2">
                <Input value={form.actionMayorOther} onChange={set('actionMayorOther')} />
              </FormField>
            )}
            <FormField label="Date Received">
              <Input type="date" value={form.dateReceived} onChange={set('dateReceived')} />
            </FormField>
            <FormField label="Date of Posting">
              <Input type="date" value={form.postingDate} onChange={set('postingDate')} />
            </FormField>
          </div>
        </div>
        <div className="col-span-2 border-t border-slate-100 pt-3">
          <FileUploadField value={file} onChange={setFile} />
          {isEdit && resolution?.filePath && !file && (
            <p className="text-xs text-slate-500 mt-1.5">
              Current:{' '}
              <button
                type="button"
                onClick={() => void openStoredFile(resolution.filePath)}
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
