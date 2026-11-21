import assert from 'node:assert/strict'
import {dismissOutcome, isOutcomeDismissed} from '../lib/outcome-dismissal.ts'
import {DISMISSED_OUTCOME_PREFIX} from '../lib/storage-keys.ts'

const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const values = new Map<string, string>()
let blocked = false
Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
  getItem(key: string) { if (blocked) throw new Error('blocked'); return values.get(key) ?? null },
  setItem(key: string, value: string) { if (blocked) throw new Error('blocked'); values.set(key, value) },
}})
try {
  assert.equal(isOutcomeDismissed('job-a'), false, 'a new outcome is eligible to open')
  dismissOutcome('job-a')
  assert.equal(isOutcomeDismissed('job-a'), true, 'closing suppresses navigation back to the same job')
  assert.equal(values.get(DISMISSED_OUTCOME_PREFIX + 'job-a'), '1')
  assert.equal(isOutcomeDismissed('job-b'), false, 'a different render still gets its outcome dialog')
  // A previous page load can have written the marker; no in-memory entry is needed.
  values.set(DISMISSED_OUTCOME_PREFIX + 'previous-page', '1')
  assert.equal(isOutcomeDismissed('previous-page'), true, 'dismissal survives refresh')
  blocked = true
  assert.doesNotThrow(() => dismissOutcome('blocked-storage'))
  assert.equal(isOutcomeDismissed('blocked-storage'), true, 'memory fallback survives client navigation')
  assert.equal(isOutcomeDismissed('another-job'), false)
  console.log('Outcome dismissal persists per job across navigation and refresh; blocked storage is safe')
} finally {
  if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}
