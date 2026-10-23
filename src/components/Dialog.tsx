import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function Dialog({ title, children, onClose, wide=false }: { title:string; children:React.ReactNode; onClose:()=>void; wide?:boolean }) {
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
    ;(focusable()?.[0] || dialog)?.focus()
    const handler = (event:KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); previous?.focus() }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section ref={dialogRef} className={`dialog ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div className="dialog-heading"><h2>{title}</h2><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></div>
      {children}
    </section>
  </div>
}
