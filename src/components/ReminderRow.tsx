import { Check, Clock3, MapPin, Pencil, Trash2 } from 'lucide-react'
import type { Place, Reminder } from '../lib/model'

export function ReminderRow({ reminder:r, place, onComplete, onEdit, onSnooze, onDelete, now }: { reminder:Reminder; place?:Place; onComplete:()=>void; onEdit:()=>void; onSnooze:(minutes:number)=>void; onDelete:()=>void; now:number }) {
  const snoozed = !!r.snoozedUntil && new Date(r.snoozedUntil).getTime() > now
  const dueLater = !!r.dueAt && new Date(r.dueAt).getTime() > now
  return <article className="reminder-row">
    {r.status === 'active' && <button className="button done-button" aria-label={`Complete ${r.title}`} onClick={onComplete}><Check size={15}/>Done</button>}
    <div className="reminder-info">
      <strong>{r.title}</strong>
      {r.description && <p>{r.description}</p>}
      <div className="reminder-meta">
        <span><MapPin size={13}/>{place?.name || 'Place removed'}</span>
        {dueLater && <span className="due-later-label"><Clock3 size={13}/>Due {new Date(r.dueAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>}
        {!dueLater && r.dueAt && <span><Clock3 size={13}/>{new Date(r.dueAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>}
        {snoozed && <span className="snooze-label"><Clock3 size={13}/>Snoozed · until {new Date(r.snoozedUntil).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span>}
      </div>
    </div>
    <div className="row-actions">
      {r.status === 'active' && <>
        <button title="Snooze 30 minutes" aria-label="Snooze for 30 minutes" onClick={()=>onSnooze(30)}>30m</button>
        <button title="Snooze 1 hour" aria-label="Snooze for 1 hour" onClick={()=>onSnooze(60)}>1h</button>
      </>}
      <button title="Edit reminder" aria-label="Edit reminder" onClick={onEdit}><Pencil size={15}/></button>
      <button title="Delete reminder" aria-label="Delete reminder" onClick={onDelete}><Trash2 size={15}/></button>
    </div>
  </article>
}
