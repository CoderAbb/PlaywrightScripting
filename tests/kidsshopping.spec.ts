const { test, expect } = require('@playwright/test');

test('kids shopping @Kidsshopping', async ({ page }) => {
  await page.goto('https://qaautomationlabs.com/');

  const goToShop = async () => {
    await page.locator('span').nth(5).click();
    await page.getByRole('link', { name: '/ Shop' }).click();
  };

  const login = async (email, password) => {
    await page.getByRole('textbox', { name: 'Email' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Email' }).press('Tab');
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('textbox', { name: 'Password' }).press('Enter');
    await page.getByRole('button', { name: 'Login' }).click();
  };

  const addProductsAndCheckout = async () => {
    await page.getByText('Save 60% Kids Fashion Shop Now').click();
    await page.getByRole('link', { name: 'Shop Now' }).nth(2).click();
    await page.getByRole('button', { name: ' Add to Cart' }).first().click();
    await page.getByRole('button', { name: ' Add to Cart' }).nth(1).click();
    await page.getByRole('link', { name: '' }).click();
    await page.getByRole('link', { name: 'Proceed To Checkout' }).click();
  };

  const fillCheckoutForm = async (data) => {
    await page.getByRole('textbox', { name: 'Enter First Name' }).click();
    await page.getByRole('textbox', { name: 'Enter First Name' }).fill(data.firstName);
    await page.getByRole('textbox', { name: 'Enter First Name' }).press('Tab');
    await page.getByRole('textbox', { name: 'Enter Middle Name' }).fill(data.middleName);
    await page.getByRole('textbox', { name: 'Enter Middle Name' }).press('Tab');
    await page.getByRole('textbox', { name: 'Enter Last Name' }).fill(data.lastName);
    await page.getByRole('textbox', { name: 'example@email.com' }).click();
    await page.getByRole('textbox', { name: 'example@email.com' }).fill(data.email);
    await page.getByPlaceholder('9876543210').click();
    await page.getByPlaceholder('9876543210').fill(data.phone);
    await page.getByRole('textbox', { name: 'Enter Address' }).click();
    await page.getByRole('textbox', { name: 'Enter Address' }).fill(data.address);
    await page.locator('div').filter({ hasText: 'State*' }).nth(5).click();
    await page.getByRole('textbox', { name: 'Enter State' }).fill(data.state);
    await page.getByRole('textbox', { name: 'Enter State' }).press('Tab');
    await page.getByRole('textbox', { name: 'Enter City' }).fill(data.city);
    await page.getByRole('textbox', { name: 'Enter City' }).press('Tab');
    await page.getByPlaceholder('Enter Pin Code').fill(data.pincode);
    await page.getByRole('button', { name: 'Continue' }).click();
  };

  await goToShop();
  await login('demo@demo.com', 'demo');
  await addProductsAndCheckout();
  await fillCheckoutForm({
    firstName: 'Testname',
    middleName: 'M',
    lastName: 'Testlastname',
    email: 'test@gamil.com',
    phone: '9726635421',
    address: '2890 Spring Drive',
    state: 'MI',
    city: 'Troy',
    pincode: '89283'
  });

  await page.getByRole('link', { name: 'Place Order' }).click();
  await expect(page.locator('#userForm')).toContainText('Your order has been placed successfully.');
  await page.getByRole('link', { name: 'Shop Again' }).click();
});