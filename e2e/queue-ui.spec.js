import { test, expect } from '@playwright/test';

test.describe('Doctor dashboard', () => {
  test('shows doctor selector, upcoming list, and column headers', async ({ page }) => {
    await page.goto('/doctor');
    await expect(page.getByRole('heading', { name: 'Doctor dashboard' })).toBeVisible();
    await expect(page.getByText('Doctor', { exact: true }).first()).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.getByText('Upcoming')).toBeVisible();
    await expect(page.getByText('Token · Patient · Dept · Priority · Type')).toBeVisible();
  });
});

test.describe('Patient check-in', () => {
  test('shows doctor, visit type, priority, and appointment time when appointment', async ({ page }) => {
    await page.goto('/patient');
    await expect(page.getByRole('heading', { name: 'Patient queue' })).toBeVisible();
    const checkInForm = page.locator('form.space-y-4').first();
    await expect(checkInForm.getByText('Doctor', { exact: true })).toBeVisible();
    await expect(checkInForm.getByText('Visit type')).toBeVisible();
    await expect(checkInForm.getByText('Priority (staff can override)')).toBeVisible();
    const formSelects = checkInForm.locator('select');
    await formSelects.nth(1).selectOption('appointment');
    await expect(checkInForm.getByText('Appointment time (optional)')).toBeVisible();
  });
});
