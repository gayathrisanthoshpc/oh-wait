export type Place = { id: string; name: string; category: string; description: string; createdAt: string }
export type Reminder = { id: string; title: string; description: string; placeId: string; createdAt: string; dueAt: string; status: 'active' | 'completed'; snoozedUntil: string }
export type Activity = { id: string; type: string; text: string; at: string }
export type Data = { version: 1; places: Place[]; reminders: Reminder[]; activity: Activity[]; demoData?: boolean }
export const emptyData: Data = { version: 1, places: [], reminders: [], activity: [] }
export const uid = () => crypto.randomUUID()
export function event(text: string): Activity { return { id: uid(), type: text.split(' ')[0], text, at: new Date().toISOString() } }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function isText(value: unknown): value is string { return typeof value === 'string' }
function normalizeData(serialized: string, strict: boolean): Data | null {
  try {
    const raw: unknown = JSON.parse(serialized)
    if (!isObject(raw) || raw.version !== 1 || (strict && (!Array.isArray(raw.places) || !Array.isArray(raw.reminders) || !Array.isArray(raw.activity)))) return null
    const rawPlaces = Array.isArray(raw.places) ? raw.places : []
    const rawReminders = Array.isArray(raw.reminders) ? raw.reminders : []
    const rawActivity = Array.isArray(raw.activity) ? raw.activity : []
    const places = rawPlaces.filter((p): p is Place => isObject(p) && isText(p.id) && isText(p.name) && p.name.trim().length > 0 && isText(p.createdAt)).map(p => ({ id:p.id, name:p.name, category:isText(p.category)?p.category:'', description:isText(p.description)?p.description:'', createdAt:p.createdAt }))
    const placeIds = new Set(places.map(p => p.id))
    const reminders = rawReminders.filter((r): r is Reminder => isObject(r) && isText(r.id) && isText(r.title) && r.title.trim().length > 0 && isText(r.placeId) && placeIds.has(r.placeId) && isText(r.createdAt) && (r.status === 'active' || r.status === 'completed')).map(r => ({ id:r.id, title:r.title, description:isText(r.description)?r.description:'', placeId:r.placeId, createdAt:r.createdAt, dueAt:isText(r.dueAt)?r.dueAt:'', status:r.status, snoozedUntil:isText(r.snoozedUntil)?r.snoozedUntil:'' }))
    const activity = rawActivity.filter((a): a is Activity => isObject(a) && isText(a.id) && isText(a.text) && isText(a.at)).map(a => ({id:a.id,type:isText(a.type)?a.type:'Activity',text:a.text,at:a.at})).slice(0,250)
    if (strict && (places.length !== rawPlaces.length || reminders.length !== rawReminders.length || activity.length !== Math.min(rawActivity.length, 250))) return null
    return { version:1, places, reminders, activity, ...(raw.demoData === true ? { demoData:true } : {}) }
  } catch { return null }
}
export function parseData(serialized: string): Data | null { return normalizeData(serialized, true) }
export function readData(): Data {
  try { const saved = localStorage.getItem('oh-wait:data:v1'); return saved ? normalizeData(saved, false) ?? emptyData : emptyData } catch { return emptyData }
}
