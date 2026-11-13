import { expect, test } from "@playwright/test";

// Spec: open /demo?gclid=TEST123, accept consent, submit, and assert the
// generate_lead push and the /api/lead payload. /api/lead is intercepted,
// so the test never reaches HubSpot.
test("demo form sends the gclid to /api/lead and pushes generate_lead", async ({ page }) => {
  let payload: Record<string, unknown> | null = null;
  await page.route("**/api/lead", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: { ok: true, delivered: true } });
  });

  await page.goto("/demo?gclid=TEST123");
  await page.getByRole("button", { name: "Accept all" }).click();

  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Fake");
  await page.getByLabel("Work email").fill(" Dana.Fake@Example-Fleet.test ");
  await page.getByLabel("Company").fill("Example Fleet Co");
  await page.getByLabel("Employees").selectOption("50-199");
  await page.getByRole("button", { name: "Book my demo" }).click();

  await expect(page).toHaveURL(/\/thanks$/);
  await expect(page.getByRole("heading", { name: "Thanks, your demo request is in" })).toBeVisible();

  // The /api/lead payload.
  expect(payload).toMatchObject({
    form_id: "demo",
    plan: null,
    first_name: "Dana",
    last_name: "Fake",
    company: "Example Fleet Co",
    employees: "50-199",
    gclid: "TEST123",
  });
  expect((payload!.email as string).toLowerCase()).toBe("dana.fake@example-fleet.test");

  // The generate_lead push. /demo -> /thanks is a client-side navigation, so
  // it is still in the same dataLayer; a full reload would lose it and fail here.
  const leads = await page.evaluate(() =>
    window.dataLayer
      .filter((e) => (e as { event?: string })?.event === "generate_lead")
      .map((e) => JSON.parse(JSON.stringify(e))),
  );
  expect(leads).toEqual([
    {
      event: "generate_lead",
      form_id: "demo",
      form_type: "custom",
      plan: null,
      user_data: { email: "dana.fake@example-fleet.test" },
    },
  ]);
});
