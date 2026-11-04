import { test, expect } from "@playwright/test";
import {
  SEED_CUSTOMER_IDS,
  SEED_PRODUCT_IDS,
} from "../src/lib/db/seed-local";

test.describe("eTinda Offline-First POS, Sync, & Role Verification", () => {
  test("1. Completes Offline Cash Sale, Offline Utang Sale, survives reload, handles sync failure safely, and reconciles on reconnect", async ({
    page,
  }) => {
    await page.goto("/pos");

    // Wait for local IndexedDB seed to finish and render products
    const cantonAddBtn = page.getByTestId(
      `add-to-cart-${SEED_PRODUCT_IDS.PANCIT_CANTON}`
    );
    await expect(cantonAddBtn).toBeVisible({ timeout: 15000 });

    // Switch to Offline Mode via the Sync Status Indicator Drawer
    await page.getByTestId("sync-status-indicator").click();
    await page.getByTestId("toggle-offline-mode-btn").click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sync-status-indicator")).toContainText(
      /Offline/i
    );

    // Add 2x Lucky Me! Pancit Canton (₱18.00 each = ₱36.00)
    await cantonAddBtn.click();
    await page
      .getByRole("button", {
        name: "Add 1 more Lucky Me! Pancit Canton Calamansi 80g",
      })
      .click();

    // Open mobile checkout sheet if on mobile viewport
    const mobileCheckoutBtn = page.getByTestId("mobile-open-checkout-btn");
    if (await mobileCheckoutBtn.isVisible()) {
      await mobileCheckoutBtn.click();
    }

    await expect(page.getByTestId("pos-cart-total").first()).toContainText(
      "₱36.00"
    );

    // Complete Cash Sale while offline
    await page.getByTestId("complete-sale-btn").first().click();

    await expect(
      page.getByTestId("pos-sale-completed-banner").first()
    ).toContainText(/Saved Locally/i);

    // Verify Sync Status Indicator now shows Pending (1)
    if (await page.locator('[role="dialog"]').isVisible()) {
      await page.keyboard.press("Escape");
    }
    await expect(page.getByTestId("sync-status-indicator")).toContainText(
      /Pending \(1\)/i
    );

    // Complete an Offline Utang Sale for Nanay Maria Santos
    await page
      .getByTestId(`add-to-cart-${SEED_PRODUCT_IDS.CORNED_BEEF}`)
      .click();
    if (await mobileCheckoutBtn.isVisible()) {
      await mobileCheckoutBtn.click();
    }

    await page.getByTestId("payment-method-utang-btn").first().click();
    await page
      .getByTestId("pos-customer-select")
      .first()
      .selectOption(SEED_CUSTOMER_IDS.MARIA_SANTOS);
    await page.getByTestId("complete-sale-btn").first().click();

    if (await page.locator('[role="dialog"]').isVisible()) {
      await page.keyboard.press("Escape");
    }
    await expect(page.getByTestId("sync-status-indicator")).toContainText(
      /Pending \(2\)/i
    );

    // Reload application while still offline and verify pending events persist in IndexedDB
    await page.reload();
    await expect(page.getByTestId("sync-status-indicator")).toContainText(
      /Pending \(2\)/i,
      { timeout: 15000 }
    );

    // Simulate a server error during sync and confirm transactions are NOT lost
    await page.getByTestId("sync-status-indicator").click();
    await page.getByTestId("toggle-sync-failure-btn").click();
    await page.getByTestId("toggle-offline-mode-btn").click(); // Go online while server error is enabled
    await expect(page.getByRole("dialog")).toContainText(
      /Local transactions remain safely queued/i
    );

    // Turn off simulated server error and trigger manual synchronization
    await page.getByTestId("toggle-sync-failure-btn").click();
    await page.getByTestId("manual-sync-button").click();

    // Outbox should now be empty and status should be Synced
    await expect(page.getByRole("dialog")).toContainText(/Outbox is empty/i);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sync-status-indicator")).toContainText(
      /Synced/i
    );
  });

  test("2. Enforces Helper vs. Owner role restrictions & Floating Mini-POS context behavior", async ({
    page,
  }) => {
    await page.goto("/pos");
    await expect(
      page.getByTestId(`add-to-cart-${SEED_PRODUCT_IDS.PANCIT_CANTON}`)
    ).toBeVisible({ timeout: 15000 });

    // Floating Mini-POS must be hidden on /pos so it never blocks POS controls
    await expect(page.getByTestId("floating-mini-pos-fab")).toHaveCount(0);

    // Navigate to /inventory and verify Floating Mini-POS FAB is visible and functional
    await page.goto("/inventory");
    const fab = page.getByTestId("floating-mini-pos-fab");
    await expect(fab).toBeVisible();
    await fab.click();
    await expect(page.getByTestId("floating-mini-pos-panel")).toBeVisible();

    // Verify Minimize button collapses back to FAB
    await page.getByTestId("floating-mini-pos-minimize-btn").click();
    await expect(page.getByTestId("floating-mini-pos-panel")).toHaveCount(0);
    await expect(fab).toBeVisible();

    // Verify Re-open and Close button dismisses Mini-POS and shows Restore button in header
    await fab.click();
    await expect(page.getByTestId("floating-mini-pos-panel")).toBeVisible();
    await page.getByTestId("floating-mini-pos-close-btn").click();
    await expect(page.getByTestId("floating-mini-pos-panel")).toHaveCount(0);
    await expect(fab).toHaveCount(0);

    // Restore from PageHeader and Maximize to /pos
    await page.getByRole("button", { name: "Restore Quick Mini-POS" }).click();
    await expect(page.getByTestId("floating-mini-pos-panel")).toBeVisible();
    await page.getByTestId("floating-mini-pos-maximize-btn").click();
    await expect(page).toHaveURL(/\/pos$/);

    // Switch role to Helper and verify restricted screens (/products edit & /reports)
    await page.getByTestId("header-role-switch-btn").click();
    await expect(page.getByTestId("header-role-switch-btn")).toContainText(
      "Helper"
    );

    await page.goto("/products");
    await expect(
      page.getByTestId("helper-readonly-catalog-badge")
    ).toBeVisible();
    await expect(page.getByTestId("create-product-btn")).toHaveCount(0);

    await page.goto("/reports");
    await expect(page.getByTestId("reports-permission-denied")).toBeVisible();

    // Switch back to Owner and verify /reports is accessible
    await page.getByTestId("header-role-switch-btn").click();
    await expect(page.getByText("Gross Sales Revenue")).toBeVisible();

    // Verify dynamic product detail route renders shell and resolves product content
    await page.goto(`/products/${SEED_PRODUCT_IDS.PANCIT_CANTON}`);
    await expect(
      page.getByText("Lucky Me! Pancit Canton Calamansi 80g")
    ).toBeVisible();
  });
});

