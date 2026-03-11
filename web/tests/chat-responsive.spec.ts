import { expect, test } from '@playwright/test'

type ViewportScenario = {
  name: string
  width: number
  height: number
}

const scenarios: ViewportScenario[] = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'desktop', width: 1280, height: 900 },
]

for (const scenario of scenarios) {
  test(`coach keeps composer pinned and visible (${scenario.name})`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    await page.goto('/coach')
    const shell = page.getByTestId('coach-shell')

    try {
      await shell.waitFor({ state: 'attached', timeout: 3000 })
    } catch {
      test.skip(true, 'Authenticated coach route required for chat shell assertions.')
    }

    await expect(shell).toBeVisible()
    const composer = page.getByTestId('composer-bar')
    const scrollContainer = page.getByTestId('conversation-scroll')
    await expect(composer).toBeVisible()
    await expect(scrollContainer).toBeVisible()

    const before = await composer.boundingBox()
    await scrollContainer.evaluate((node) => {
      node.scrollTop = node.scrollHeight
    })
    const after = await composer.boundingBox()

    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    if (before && after) {
      expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(2)
    }
  })
}
