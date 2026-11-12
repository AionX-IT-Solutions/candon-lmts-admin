import { useRef, useState } from 'react'
import { Upload, File, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../../lib/utils'

/** Whether a file fits an `accept` list such as ".pdf" or "image/*". */
function matchesAccept(file: File, accept: string): boolean {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) =>
      rule.startsWith('.')
        ? name.endsWith(rule)
        : rule.endsWith('/*')
          ? type.startsWith(rule.slice(0, -1))
          : type === rule
    )
}

/** "PDF", "image", … — for the message when a file doesn't fit. */
const describeAccept = (accept: string) =>
  accept
    .split(',')
    .map((rule) => rule.trim())
    .map((rule) => (rule.startsWith('.') ? rule.slice(1).toUpperCase() : rule.replace('/*', '')))
    .join(', ')

interface FileUploadFieldProps {
  label?: string
  accept?: string
  value?: File | null
  onChange: (file: File | null) => void
  required?: boolean
  error?: string
}

export function FileUploadField({
  label = 'Attachment',
  // Attachments are PDFs only (photo fields pass accept="image/*")
  accept = '.pdf',
  value,
  onChange,
  required,
  error
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Picked or dropped — the file dialog's "All files" option and drops both get around `accept`
  function take(file: File | null) {
    if (file && !matchesAccept(file, accept)) {
      toast.error(`Only ${describeAccept(accept)} files can be attached`)
      return
    }
    onChange(file)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200',
          dragging
            ? 'border-blue-400 bg-blue-50'
            : value
              ? 'border-blue-300 bg-blue-50'
              : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30',
          error && 'border-red-300'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          if (!dragging) setDragging(true)
        }}
        onDragLeave={(e) => {
          // Moving onto a child element is still inside the box
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDragging(false)
          take(e.dataTransfer.files[0] ?? null)
        }}
      >
        {value ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-600">
              <File size={16} />
              <span className="text-sm font-medium truncate max-w-[200px]">{value.name}</span>
            </div>
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload size={20} className="text-slate-400" />
            <p className="text-sm text-slate-500">
              {dragging ? (
                <span className="text-blue-600 font-medium">Drop the file here</span>
              ) : (
                <>
                  <span className="text-blue-600 font-medium">Click to upload</span> or drag & drop
                </>
              )}
            </p>
            <p className="text-xs text-slate-400">
              {accept.replace(/\./g, '').toUpperCase().split(',').join(', ')}
            </p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null
          e.target.value = '' // so picking the same file again still registers
          take(picked)
        }}
      />
    </div>
  )
}
