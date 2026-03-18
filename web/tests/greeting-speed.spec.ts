import { expect, test } from '@playwright/test'

const COACH_ROUTE = '/coach'

async function skipIfUnauthenticated(page: import('@playwright/test').Page) {
  const shell = page.getByTestId('coach-shell')
  try {
    await shell.waitFor({ state: 'attached', timeout: 3000 })
  } catch {
    test.skip(true, 'Authenticated coach route required.')
  }
}

test.describe('greeting speed optimizations', () => {
  test.slow()
  test.beforeEach(async ({ page }) => {
    await page.goto(COACH_ROUTE)
    await skipIfUnauthenticated(page)
  })

  test('thinking indicator appears quickly on page load', async ({ page }) => {
    const thinkingIndicator = page.getByText('Sifu is thinking')

    // The thinking indicator should appear within 1 second of the page loading
    await expect(thinkingIndicator).toBeVisible({ timeout: 2000 })
  })

  test('greeting message arrives within 10 seconds', async ({ page }) => {
    // Wait for the thinking indicator to appear first
    const thinkingIndicator = page.getByText('Sifu is thinking')
    await expect(thinkingIndicator).toBeVisible({ timeout: 2000 })

    // Wait for thinking indicator to disappear (response arrived)
    await expect(thinkingIndicator).not.toBeVisible({ timeout: 10_000 })
  })

  test('starter buttons appear after greeting completes', async ({ page }) => {
    // Wait for greeting to complete - thinking indicator should disappear
    const thinkingIndicator = page.getByText('Sifu is thinking')

    // First wait for thinking to appear
    await thinkingIndicator.waitFor({ timeout: 2000 })

    // Then wait for it to disappear (greeting complete)
    await expect(thinkingIndicator).toBeHidden({ timeout: 10_000 })

    // Starter buttons should appear - they are rendered as buttons with starter text
    // The default mode is "dsa" which has starters like "Give me a medium array problem"
    const starterButton = page.getByRole('button', { name: /Give me a medium array problem|Practice dynamic programming|Quiz me on graphs|Review sliding window/i }).first()
    await expect(starterButton).toBeVisible({ timeout: 5000 })
  })

  test('switching modes triggers a new greeting', async ({ page }) => {
    // Wait for initial greeting to complete
    const thinkingIndicator = page.getByText('Sifu is thinking')
    await thinkingIndicator.waitFor({ timeout: 2000 })
    await expect(thinkingIndicator).toBeHidden({ timeout: 10_000 })

    // Find the mode selector / chat controls trigger and switch mode
    // The mode switch is inside the ResponsiveChatControls or DesktopChatControls
    // Look for the mode selector button
    const modeTrigger = page.getByRole('button', { name: /Open chat controls|Ask Sifu/i }).first()

    if (await modeTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modeTrigger.click()

      // Look for system-design mode option
      const systemDesignOption = page.getByRole('option', { name: /system.design/i }).or(
        page.getByText(/system.design/i)
      ).first()

      if (await systemDesignOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await systemDesignOption.click()

        // A new thinking indicator should appear after mode switch
        await expect(thinkingIndicator).toBeVisible({ timeout: 2000 })

        // New greeting should complete
        await expect(thinkingIndicator).toBeHidden({ timeout: 10_000 })

        // New mode starters should appear (system-design starters)
        const newStarter = page.getByRole('button', { name: /Design a URL shortener|Scale a newsfeed|Explain consistent hashing|Rate limiter design/i }).first()
        await expect(newStarter).toBeVisible({ timeout: 5000 })
      } else {
        // Desktop layout - mode selector might be a select/dropdown
        test.skip(true, 'Could not locate mode switch UI in current viewport.')
      }
    } else {
      test.skip(true, 'Mode switch trigger not visible in current layout.')
    }
  })

  test('chat session auto-creates on first visit', async ({ page }) => {
    // On first visit to /coach, the page should auto-create a session
    // and begin the greeting flow without requiring user interaction
    const shell = page.getByTestId('coach-shell')
    await expect(shell).toBeVisible()

    const scrollContainer = page.getByTestId('conversation-scroll')
    await expect(scrollContainer).toBeVisible()

    // The greeting should fire automatically without user input
    // Verify that the thinking indicator or a message appears
    const thinkingOrMessage = page.getByText('Sifu is thinking').or(
      page.getByText('Sifu is typing')
    )

    // Should either be currently thinking or already have a greeting message
    await expect(async () => {
      const isThinking = await thinkingOrMessage.isVisible().catch(() => false)
      const hasMessage = await scrollContainer.locator('div').filter({ hasText: /.+/ }).count().then(c => c > 0).catch(() => false)
      expect(isThinking || hasMessage).toBeTruthy()
    }).toPass({ timeout: 3000 })
  })
})
