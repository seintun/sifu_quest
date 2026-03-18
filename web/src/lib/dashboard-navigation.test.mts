import assert from 'node:assert/strict'
import test from 'node:test'

import {
  selectDashboardLaunchpadItems,
  selectMobilePrimaryNavItems,
  selectMobileSecondaryNavItems,
  selectSidebarNavItems,
} from './dashboard-navigation.ts'

test('dashboard launchpad prioritizes coach first and limits count', () => {
  const actions = selectDashboardLaunchpadItems(3)
  assert.equal(actions.length, 3)
  assert.equal(actions[0]?.id, 'coach')
  assert.equal(actions[1]?.id, 'plan')
})

test('mobile nav splits primary and secondary destinations', () => {
  const primary = selectMobilePrimaryNavItems().map((item) => item.id)
  const secondary = selectMobileSecondaryNavItems().map((item) => item.id)

  assert.deepEqual(primary, ['dashboard', 'coach', 'plan'])
  assert.ok(secondary.includes('settings'))
  assert.equal(secondary.includes('coach'), false)
})

test('sidebar includes all sidebar-visible entries', () => {
  const sidebarItems = selectSidebarNavItems()
  assert.ok(sidebarItems.length >= 8)
  assert.ok(sidebarItems.some((item) => item.id === 'dashboard'))
  assert.ok(sidebarItems.some((item) => item.id === 'memory'))
})
