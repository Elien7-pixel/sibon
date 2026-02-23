import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, slowMo: 200 });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto('http://localhost:8080/booking', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log('✅ Page loaded:', page.url());

  // Fill in the booking form fields
  await page.getByPlaceholder('Your name').fill('Preshy Test User');
  console.log('✅ Name filled');
  await page.waitForTimeout(500);

  await page.getByPlaceholder('your@email.com').fill('preshy.test@sibontest.com');
  console.log('✅ Email filled');
  await page.waitForTimeout(500);

  await page.getByPlaceholder('e.g., B12').fill('B15');
  console.log('✅ Bungalow filled');
  await page.waitForTimeout(500);

  // Screenshot before submit
  await page.screenshot({ path: '/Users/sherbetagency/.openclaw/workspace/booking-filled.png', fullPage: false });
  console.log('📸 Pre-submit screenshot saved');

  // Click Request Booking button
  const submitBtn = page.getByRole('button', { name: /request booking/i });
  await submitBtn.waitFor({ timeout: 5000 });
  await submitBtn.click();
  console.log('✅ Request Booking button clicked!');

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/Users/sherbetagency/.openclaw/workspace/booking-submitted.png', fullPage: false });
  console.log('📸 Post-submit screenshot saved');

} catch (err) {
  console.error('❌ Error:', err.message);
  await page.screenshot({ path: '/Users/sherbetagency/.openclaw/workspace/booking-error.png' }).catch(() => {});
} finally {
  await browser.close();
  console.log('Done!');
}
