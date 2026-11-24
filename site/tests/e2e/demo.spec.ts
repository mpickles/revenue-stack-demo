import { expect, test } from "@playwright/test";

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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
  await page.getByLabel("Fleet size (vehicles)").selectOption("50-199");
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
    fleet_size: "50-199",
    gclid: "TEST123",
    landing_page: "/demo",
    referring_domain: "",
    ad_user_data_consent: true,
    ad_personalization_consent: true,
  });
  expect(payload!.ad_consent_timestamp).toMatch(ISO_UTC);
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

// Spec: the reject path. The visitor is still a lead. The payload has no
// click ID, referrer or landing page, and has both consent values as false
// with the time of the choice.
test("demo form after Reject all sends the lead with no click ID and consent false", async ({ page }) => {
  let payload: Record<string, unknown> | null = null;
  await page.route("**/api/lead", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: { ok: true, delivered: true } });
  });

  await page.goto("/demo?gclid=TEST123&utm_medium=cpc");
  await page.getByRole("button", { name: "Reject all" }).click();

  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Fake");
  await page.getByLabel("Work email").fill("dana.fake@example-fleet.test");
  await page.getByLabel("Company").fill("Example Fleet Co");
  await page.getByLabel("Fleet size (vehicles)").selectOption("1,000+");
  await page.getByRole("button", { name: "Book my demo" }).click();

  await expect(page).toHaveURL(/\/thanks$/);

  expect(payload).toMatchObject({
    form_id: "demo",
    first_name: "Dana",
    fleet_size: "1,000+",
    gclid: "",
    utm_medium: "",
    referring_domain: "",
    landing_page: "",
    ga_client_id: "",
    ad_user_data_consent: false,
    ad_personalization_consent: false,
  });
  expect(payload!.ad_consent_timestamp).toMatch(ISO_UTC);

  const cookies = await page.context().cookies();
  expect(cookies.map((c) => c.name)).not.toContain("rw_attrib");
});

// The fleet size select is required: the form does not post without it.
test("demo form does not submit without a fleet size", async ({ page }) => {
  let posted = false;
  await page.route("**/api/lead", async (route) => {
    posted = true;
    await route.fulfill({ status: 200, json: { ok: true, delivered: true } });
  });

  await page.goto("/demo");
  await page.getByRole("button", { name: "Accept all" }).click();
  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Fake");
  await page.getByLabel("Work email").fill("dana.fake@example-fleet.test");
  await page.getByLabel("Company").fill("Example Fleet Co");
  await page.getByRole("button", { name: "Book my demo" }).click();

  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText("Choose a fleet size.")).toBeVisible();
  expect(posted).toBe(false);
});
