import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
const WebSocket = globalThis.WebSocket

const root = process.cwd()
const tempProfile = await mkdtemp(path.join(tmpdir(), 'oh-wait-chrome-'))
const devPort = await freePort()
const debugPort = await freePort()
const chromeCandidates = [
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft/Edge/Application/msedge.exe'),
]
let chromePath = ''
for (const candidate of chromeCandidates) { try { await access(candidate); chromePath = candidate; break } catch {} }
assert.ok(chromePath, 'Install Chrome or Edge to run the browser smoke test.')
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(devPort), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
server.stderr.on('data', chunk => process.stderr.write(chunk))
server.on('error', error => console.error('Vite launch failed:', error))
const browser = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--remote-allow-origins=*', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${tempProfile}`, 'about:blank'], { stdio: 'ignore' })
let socket
try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${devPort}/`)).ok, 'Vite server')
  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })
    return response.ok ? response.json() : false
  }, 'Chrome DevTools')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let commandId = 0
  const pending = new Map()
  const pageErrors = []
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data.toString())
    if (msg.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {})
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.text)
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') pageErrors.push(msg.params.entry.text)
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result) }
  })
  function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++commandId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`Timed out: ${method}`)) } }, 10000).unref() }) }
  async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value }
  async function action(expression) { await evaluate(expression); await delay(100) }
  async function waitForText(text) { await waitFor(async () => (await evaluate('document.body.innerText')).includes(text), `text: ${text}`) }
  async function clickText(text) { const ok = await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!b)return false;b.click();return true})()`); assert.ok(ok, `Could not find button “${text}”`) }
  async function clickLabel(label) { const ok = await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});if(!b)return false;b.click();return true})()`); assert.ok(ok, `Could not find control “${label}”`) }
  async function fill(selector, value) { const ok = await evaluate(`(()=>{const x=document.querySelector(${JSON.stringify(selector)});if(!x)return false;x.value=${JSON.stringify(value)};x.dispatchEvent(new Event('input',{bubbles:true}));x.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); assert.ok(ok, `Could not fill ${selector}`) }
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: `http://127.0.0.1:${devPort}/` })
  await waitForText("You're all caught up!")
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Mobile view must not overflow horizontally')
  await evaluate("localStorage.setItem('unrelated:test-key','keep me')")
  await clickText('Add your first place')
  await fill('input[name="name"]', 'Neighborhood Pharmacy')
  await fill('input[name="category"]', 'Pharmacy')
  await clickText('Save place'); await waitForText('Neighborhood Pharmacy')
  await clickLabel('My Places'); await clickText('Add a place'); await fill('input[name="name"]', 'Corner Grocery'); await fill('input[name="category"]', 'Groceries'); await clickText('Save place'); await waitForText('Corner Grocery')
  await clickLabel('Home')
  await clickText('Add reminder'); await fill('input[name="title"]', 'Buy medicine')
  await fill('select[name="placeId"]', await evaluate("[...document.querySelector('select[name=placeId]').options].find(o=>o.text==='Neighborhood Pharmacy').value")); await clickText('Save reminder'); await waitForText('Buy medicine')
  await clickText('Add reminder'); await fill('input[name="title"]', 'Buy milk')
  await fill('select[name="placeId"]', await evaluate("[...document.querySelector('select[name=placeId]').options].find(o=>o.text==='Corner Grocery').value")); await clickText('Save reminder'); await waitForText('Buy milk')
  await send('Page.reload'); await waitForText('Buy medicine'); await waitForText('Buy milk')
  await clickLabel('My Places')
  await action("[...document.querySelectorAll('.place-card')].find(c=>c.innerText.includes('Neighborhood Pharmacy')).querySelector('.simulate').click()")
  await waitForText('SIMULATED ARRIVAL'); await waitForText('Buy medicine')
  assert.equal((await evaluate('document.querySelector(".dialog").innerText')).includes('Buy milk'), false, 'Arrival should exclude reminders belonging to other places')
  await clickLabel('Complete Buy medicine'); await waitForText('One less thing')
  await clickText('Done')
  await action("[...document.querySelectorAll('.place-card')].find(c=>c.innerText.includes('Corner Grocery')).querySelector('.simulate').click()")
  await waitForText('Buy milk'); await clickLabel('Snooze Buy milk 30 minutes'); await waitForText('Snoozed for 30 minutes')
  await action("[...document.querySelectorAll('.place-card')].find(c=>c.innerText.includes('Corner Grocery')).querySelector('.simulate').click()")
  await waitForText('No reminders due here right now')
  await clickText('Done')
  await evaluate("const d=JSON.parse(localStorage.getItem('oh-wait:data:v1'));d.reminders.find(r=>r.title==='Buy milk').snoozedUntil=new Date(Date.now()-1000).toISOString();localStorage.setItem('oh-wait:data:v1',JSON.stringify(d))")
  await send('Page.reload'); await waitForText('Buy milk')
  await clickLabel('My Reminders'); await clickLabel('Edit reminder'); await fill('input[name="title"]', 'Buy oat milk'); await clickText('Save reminder'); await waitForText('Buy oat milk')
  await clickLabel('Complete Buy oat milk'); await waitForText('One less thing')
  await clickLabel('My Places'); await clickLabel('Edit Neighborhood Pharmacy'); await fill('input[name="name"]', 'Town Pharmacy'); await clickText('Save place'); await waitForText('Town Pharmacy')
  await clickText('Add a place'); await fill('input[name="name"]', 'Library'); await clickText('Save place'); await waitForText('Library')
  await clickLabel('Home'); await clickText('Add reminder'); await fill('input[name="title"]', 'Return library book'); await fill('select[name="placeId"]', await evaluate("[...document.querySelector('select[name=placeId]').options].find(o=>o.text==='Library').value")); await clickText('Save reminder'); await waitForText('Return library book')
  await clickLabel('My Places'); await action("[...document.querySelectorAll('.place-card')].find(c=>c.innerText.includes('Library')).querySelector('.place-actions button:last-child').click()"); await waitForText('Move reminders to'); await fill('#reassign-place', await evaluate("[...document.querySelector('#reassign-place').options].find(o=>o.text==='Town Pharmacy').value")); await clickText('Reassign reminders'); await waitForText('Reminders moved to Town Pharmacy')
  await clickLabel('My Reminders'); await waitForText('Return library book'); assert.equal(await evaluate("[...document.querySelectorAll('.reminder-row')].find(r=>r.innerText.includes('Return library book')).innerText.includes('Town Pharmacy')"), true)
  await clickText('Activity'); await waitForText('Simulated arrival at Neighborhood Pharmacy'); await waitForText('Completed reminder: Buy medicine')
  await clickText('Settings'); await clickText('Clear all app data'); await waitForText('Clear your Oh, Wait! data?'); await clickText('Clear data'); await waitForText('Your app data has been cleared.')
  assert.equal(await evaluate("localStorage.getItem('unrelated:test-key')"), 'keep me', 'Clear data must retain unrelated localStorage entries')
  await clickLabel('My Places'); await waitForText('Every reminder needs a place')
  assert.deepEqual(pageErrors, [], 'The browser console should not report JavaScript errors.')
  console.log('Browser smoke test passed: first use, places, reminders, persistence, arrival filtering, completion, snooze/expiry, editing, reassignment, activity, clear-data isolation, and mobile overflow.')
} finally {
  socket?.close()
  browser.kill()
  server.kill()
  if (browser.exitCode === null) await Promise.race([new Promise(resolve => browser.once('exit', resolve)), delay(3000)])
  await rm(tempProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
}

async function freePort() { const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port }
async function waitFor(check, name) { for (let i = 0; i < 80; i++) { try { const value = await check(); if (value) return value } catch {} await delay(250) } throw new Error(`Timed out waiting for ${name}`) }
