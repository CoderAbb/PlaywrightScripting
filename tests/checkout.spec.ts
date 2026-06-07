import { test, expect } from '@playwright/test';

type GuestInfo = {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  address1: string;
  city: string;
  postCode: string;
  countryValue: string;
  zoneValue: string;
};

const GUEST: GuestInfo = {
  firstName: 'Rakesh',
  lastName: 'Kumar',
  email: 'test@gmail.com',
  telephone: '9728938935',
  address1: '2030 Mac Drive',
  city: 'Cleveland',
  postCode: '44026',
  countryValue: '223', // value attr for country select
  zoneValue: '3659',   // value attr for zone select
};

test('checkout @check', async ({ page }) => {
  await page.goto('https://ecommerce-playground.lambdatest.io/');

  const searchBox = page.getByRole('textbox', { name: 'Search For Products' });
  await searchBox.fill('HP');
  await page.getByRole('link', { name: 'HP LP3065' }).nth(1).click();
  await page.getByRole('button', { name: 'Add to Cart' }).click();

  await page.getByRole('link', { name: 'View Cart ' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();

  await page.getByText('Guest Checkout').click();

  const fields: Array<[string, string]> = [
    ['First Name*', GUEST.firstName],
    ['Last Name*', GUEST.lastName],
    ['E-Mail*', GUEST.email],
    ['Telephone*', GUEST.telephone],
    ['Address 1*', GUEST.address1],
    ['City*', GUEST.city],
    ['Post Code*', GUEST.postCode],
  ];

  for (const [label, value] of fields) {
    await page.getByRole('textbox', { name: label }).fill(value);
  }

  await page.locator('#input-payment-country').selectOption(GUEST.countryValue);
  await page.locator('#input-payment-zone').selectOption(GUEST.zoneValue);

  await page.getByText('I have read and agree to the Terms & Conditions').click();
  await page.getByRole('button', { name: 'Continue ' }).click();
  await page.getByRole('button', { name: 'Confirm Order ' }).click();

  await expect(page.locator('#content')).toContainText('Your order has been successfully processed!');
  await page.getByRole('link', { name: 'Continue' }).click();
});