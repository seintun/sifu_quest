import { expect, test } from '@playwright/test'

type ViewportScenario = {
  name: string
  width: number
  height: number
  minReaderWidth: number
  mobile: boolean
}

const scenarios: ViewportScenario[] = [
  { name: 'iphone-se', width: 375, height: 667, minReaderWidth: 300, mobile: true },
  { name: 'ipad-portrait', width: 820, height: 1180, minReaderWidth: 520, mobile: false },
  { name: 'desktop', width: 1280, height: 900, minReaderWidth: 700, mobile: false },
]

for (const scenario of scenarios) {
  test(`memory remains readable and responsive (${scenario.name})`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    await page.goto('/memory')

    const shell = page.getByTestId('memory-shell')
    if (await shell.count() === 0) {
      test.skip(true, 'Authenticated memory route required for memory responsiveness assertions.')
    }

    await expect(shell).toBeVisible()

    const overflowX = await page.evaluate(() => {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth
    })
    expect(overflowX).toBeLessThanOrEqual(1)

    const reader = page.getByTestId('memory-reader')
    await expect(reader).toBeVisible()
    const readerBox = await reader.boundingBox()

    expect(readerBox).not.toBeNull()
    if (readerBox) {
      expect(readerBox.width).toBeGreaterThanOrEqual(scenario.minReaderWidth)
    }

    if (scenario.mobile) {
      const controls = page.getByTestId('memory-mobile-controls')
      await expect(controls).toBeVisible()

      const trigger = page.getByTestId('memory-file-picker-trigger')
      await expect(trigger).toBeVisible()
      await trigger.click()
      await expect(page.getByRole('heading', { name: 'Memory Files' })).toBeVisible()

      const visibleFileButtons = page.locator('[data-testid^="memory-file-"]:visible')
      const visibleCount = await visibleFileButtons.count()
      if (visibleCount > 0) {
        await visibleFileButtons.first().click()
      }

      const before = await controls.boundingBox()
      await reader.evaluate((node) => {
        node.scrollTop = node.scrollHeight
      })
      const after = await controls.boundingBox()

      expect(before).not.toBeNull()
      expect(after).not.toBeNull()
      if (before && after) {
        expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(2)
      }
    }
  })
}

test('memory shows retry UI when a file request fails', async ({ page }) => {
  await page.route('**/api/memory?file=*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Injected memory failure' }),
    })
  })

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/memory')

  const shell = page.getByTestId('memory-shell')
  if (await shell.count() === 0) {
    test.skip(true, 'Authenticated memory route required for error-state assertions.')
  }

  const visibleFileButtons = page.locator('[data-testid^="memory-file-"]:visible')
  if ((await visibleFileButtons.count()) === 0) {
    test.skip(true, 'Memory files required for file request error assertions.')
  }

  await expect(page.getByText('Unable to load memory')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('memory keeps empty-file state distinct from network errors', async ({ page }) => {
  await page.route('**/api/memory?file=*', async (route) => {
    const url = new URL(route.request().url())
    const file = url.searchParams.get('file') ?? 'profile.md'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ file, content: '' }),
    })
  })

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/memory')

  const shell = page.getByTestId('memory-shell')
  if (await shell.count() === 0) {
    test.skip(true, 'Authenticated memory route required for empty-state assertions.')
  }

  const visibleFileButtons = page.locator('[data-testid^="memory-file-"]:visible')
  if ((await visibleFileButtons.count()) === 0) {
    test.skip(true, 'Memory files required for empty-state assertions.')
  }

  await expect(page.getByText('This file does not have content yet')).toBeVisible()
  await expect(page.getByText('Unable to load memory')).toHaveCount(0)
})
