import { useState } from 'react'
import { emptyData, event, readData, uid, type Data, type Place, type Reminder } from '../lib/model'

const DATA_KEY = 'oh-wait:data:v1'
const ARRIVAL_PREFIX = 'oh-wait:last-arrival:'
const clockNow = () => new Date().valueOf()

function persist(data: Data) {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); return true }
  catch { return false }
}

export function useOhWaitData() {
  const [data, setData] = useState<Data>(readData)
  const [storageWarning, setStorageWarning] = useState(false)

  function updateData(next: Data) {
    setData(next)
    setStorageWarning(!persist(next))
  }

  function saveReminder(form: FormData, editing: Reminder | Place | null) {
    const title = String(form.get('title') || '').trim()
    const placeId = String(form.get('placeId') || '')
    if (!title || !data.places.some(place => place.id === placeId)) return false
    const old = editing && 'title' in editing ? editing : null
    const reminder: Reminder = {
      id: old?.id || uid(), title,
      description: String(form.get('description') || '').trim(),
      placeId, createdAt: old?.createdAt || new Date().toISOString(),
      dueAt: String(form.get('dueAt') || ''), status: old?.status || 'active',
      snoozedUntil: old?.snoozedUntil || '',
    }
    updateData({ ...data, reminders: old ? data.reminders.map(item => item.id === old.id ? reminder : item) : [reminder, ...data.reminders], activity: [event(`${old ? 'Edited' : 'Created'} reminder: ${title}`), ...data.activity] })
    return true
  }

  function savePlace(form: FormData, editing: Reminder | Place | null) {
    const name = String(form.get('name') || '').trim()
    if (!name) return false
    const old = editing && 'category' in editing ? editing : null
    const place: Place = {
      id: old?.id || uid(), name,
      category: String(form.get('category') || '').trim(),
      description: String(form.get('description') || '').trim(),
      createdAt: old?.createdAt || new Date().toISOString(),
    }
    updateData({ ...data, places: old ? data.places.map(item => item.id === old.id ? place : item) : [...data.places, place], activity: [event(`${old ? 'Edited' : 'Added'} place: ${name}`), ...data.activity] })
    return true
  }

  function completeReminder(reminder: Reminder) {
    updateData({ ...data, reminders: data.reminders.map(item => item.id === reminder.id ? { ...item, status:'completed', snoozedUntil:'' } : item), activity: [event(`Completed reminder: ${reminder.title}`), ...data.activity] })
  }

  function snoozeReminder(reminder: Reminder, minutes: number) {
    const until = new Date(clockNow() + minutes * 60_000).toISOString()
    updateData({ ...data, reminders: data.reminders.map(item => item.id === reminder.id ? { ...item, snoozedUntil:until } : item), activity: [event(`Snoozed reminder: ${reminder.title} for ${minutes === 30 ? '30 minutes' : '1 hour'}`), ...data.activity] })
  }

  function deleteReminder(reminder: Reminder) {
    updateData({ ...data, reminders: data.reminders.filter(item => item.id !== reminder.id), activity: [event(`Deleted reminder: ${reminder.title}`), ...data.activity] })
  }

  function recordArrival(place: Place) {
    const key = `${ARRIVAL_PREFIX}${place.id}`
    let last = 0
    try { last = Number(localStorage.getItem(key) || 0) } catch { /* Cooldown is best effort without browser storage. */ }
    // A 15-second per-place cooldown deduplicates rapid clicks without blocking a later simulation.
    if (clockNow() - last <= 15_000) return false
    try { localStorage.setItem(key, String(clockNow())) } catch { /* Activity still records in memory. */ }
    updateData({ ...data, activity: [event(`Simulated arrival at ${place.name}`), ...data.activity] })
    return true
  }

  function deletePlace(place: Place, mode: 'reassign' | 'remove', targetId = '') {
    const affected = data.reminders.filter(reminder => reminder.placeId === place.id)
    const target = data.places.find(item => item.id === targetId && item.id !== place.id)
    if (mode === 'reassign' && affected.length && !target) return false
    updateData({
      ...data,
      places: data.places.filter(item => item.id !== place.id),
      reminders: mode === 'reassign' && target ? data.reminders.map(item => item.placeId === place.id ? { ...item, placeId:target.id } : item) : data.reminders.filter(item => item.placeId !== place.id),
      activity: [event(mode === 'reassign' && target ? `Deleted place: ${place.name}; reassigned ${affected.length} reminder${affected.length === 1 ? '' : 's'} to ${target.name}` : `Deleted place and ${affected.length} reminder${affected.length === 1 ? '' : 's'}: ${place.name}`), ...data.activity],
    })
    return true
  }

  function clearData() {
    try {
      localStorage.removeItem(DATA_KEY)
      Object.keys(localStorage).filter(key => key.startsWith(ARRIVAL_PREFIX)).forEach(key => localStorage.removeItem(key))
    } catch { /* Reset the in-memory app even when browser storage is unavailable. */ }
    setData(emptyData)
    setStorageWarning(false)
  }

  return { data, storageWarning, updateData, saveReminder, savePlace, completeReminder, snoozeReminder, deleteReminder, recordArrival, deletePlace, clearData }
}
