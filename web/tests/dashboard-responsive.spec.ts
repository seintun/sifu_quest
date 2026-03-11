import { expect, test } from '@playwright/test'

type ViewportScenario = {
  name: string
  width: number
  height: number
  mobile: boolean
}

const scenarios: ViewportScenario[] = [
  { name: 'iphone-se', width: 375, height: 667, mobile: true },
  { name: 'ipad-portrait', width: 820, height: 1180, mobile: false },
  { name: 'desktop', width: 1280, height: 900, mobile: false },
]

for (const scenario of scenarios) {
  test(`dashboard remains usable and uncluttered (${scenario.name})`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    await page.goto('/')

    const dashboard = page.getByTestId('dashboard-page')
    if ((await dashboard.count()) === 0) {
      test.skip(true, 'Authenticated dashboard route required for dashboard responsiveness assertions.')
    }

    await expect(dashboard).toBeVisible()
    const overflowX = await page.evaluate(() => {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth
    })
    expect(overflowX).toBeLessThanOrEqual(1)

    await expect(page.getByTestId('dashboard-primary-coach-cta')).toBeVisible()

    const launchpad = page.getByTestId('dashboard-launchpad')
    await expect(launchpad).toBeVisible()
    await expect(launchpad.locator('[data-testid^="quick-action-"]')).toHaveCount(3)

    if (scenario.mobile) {
      const bottomNav = page.getByTestId('mobile-bottom-nav')
      await expect(bottomNav).toBeVisible()
      await expect(page.getByTestId('mobile-primary-dashboard')).toBeVisible()
      await expect(page.getByTestId('mobile-primary-coach')).toBeVisible()
      await expect(page.getByTestId('mobile-primary-plan')).toBeVisible()

      await page.getByTestId('mobile-sidebar-trigger').click()
      await expect(page.getByTestId('mobile-sidebar-content')).toBeVisible()
      await expect(page.getByTestId('nav-link-settings')).toBeVisible()
    }
  })
}

test('dashboard shows retry action when metrics request fails', async ({ page }) => {
  await page.route('**/api/progress', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Injected dashboard failure' }),
    })
  })

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')

  const dashboard = page.getByTestId('dashboard-page')
  if ((await dashboard.count()) === 0) {
    test.skip(true, 'Authenticated dashboard route required for dashboard error-state assertions.')
  }

  await expect(page.getByText('Some dashboard data could not be loaded.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
})
