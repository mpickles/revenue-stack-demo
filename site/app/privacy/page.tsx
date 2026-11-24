import type { Metadata } from "next";
import { ConsentSettingsButton } from "@/components/ConsentSettingsButton";
import { REPO_OWNER_PROFILE_URL, contactEmail } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Privacy | Roadwren",
};

const CONTACT_EMAIL = contactEmail(process.env.NEXT_PUBLIC_CONTACT_EMAIL);

export default function Privacy() {
  return (
    <main>
      <article className="prose">
        <h1>Privacy</h1>
        <p className="prose-lead">
          Roadwren is a fictional company and this site is a demo of a marketing
          measurement setup. Please use a made-up name and email address in any
          form.
        </p>

        <h2>What this demo collects</h2>
        <ul>
          <li>
            <strong>Form fields.</strong> On the demo form: first name, last name,
            work email, company and fleet size in vehicles, plus the plan you came
            from on the pricing page.
          </li>
          <li>
            <strong>Ad click IDs and campaign tags.</strong> If you arrive from a
            link that carries them, the site reads gclid, gbraid, wbraid, fbclid,
            li_fat_id, msclkid and the five utm_ parameters. They are stored in a
            first-party cookie, <code>rw_attrib</code>, for 90 days, and only
            after you choose Accept all. If you choose Reject all, nothing is
            stored and an existing cookie is deleted.
          </li>
          <li>
            <strong>Google Analytics client ID.</strong> A random ID from the{" "}
            <code>_ga</code> cookie, read only after Accept all, so a form
            submission can be matched to the same visit in Google Analytics.
          </li>
          <li>
            <strong>Your cookie choice.</strong> Stored in <code>rw_consent</code>{" "}
            for 180 days so the banner does not ask again.
          </li>
        </ul>
        <p>
          The click IDs, campaign tags and Google Analytics client ID are sent
          with the form as hidden fields, and only when you have accepted.
        </p>

        <h2>Where it is sent</h2>
        <ul>
          <li>
            <strong>HubSpot</strong> (CRM): form submissions, with the hidden
            fields above. Until the demo&apos;s HubSpot account is connected,
            submissions are checked and then dropped.
          </li>
          <li>
            <strong>Google Tag Manager, Google Analytics 4 and Google Ads</strong>:
            page views and form events, once a tag container is connected and
            only as your cookie choice allows. When you submit the form, your
            email is passed to Google&apos;s tags, which hash it before sending,
            to match the lead to an ad click (enhanced conversions).
          </li>
          <li>
            <strong>Vercel</strong> hosts the site and keeps standard request
            logs. The site&apos;s own server logs never record your email.
          </li>
        </ul>

        <h2>Change your choice or ask for deletion</h2>
        <p>
          To change your cookie choice, or to delete the stored click IDs and
          campaign tags, use <ConsentSettingsButton /> and choose Reject all.
        </p>
        <p>
          To ask for a form submission to be deleted,{" "}
          {CONTACT_EMAIL ? (
            <>
              email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </>
          ) : (
            <>
              send a request through the repo owner&apos;s{" "}
              <a href={REPO_OWNER_PROFILE_URL}>GitHub profile</a>
            </>
          )}{" "}
          with the email address you used.
        </p>
      </article>
    </main>
  );
}
