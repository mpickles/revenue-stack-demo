# HubSpot contact properties

/api/lead upserts contacts on `email` with
`POST /crm/v3/objects/contacts/batch/upsert`. Every property below must exist
on the Contact object before HUBSPOT_TOKEN is set, or HubSpot rejects the
batch and the route returns 502.

Settings > Properties > Contact properties > Create property.
Suggested group: "Roadwren demo attribution" (custom properties only).
Internal names must match exactly.

## Built in (already exist)

| Internal name | Sent from        |
|---------------|------------------|
| email         | email (lowercased, trimmed) |
| firstname     | first_name       |
| lastname      | last_name        |
| company       | company          |

## Custom: create these

| Internal name | Label            | Field type                 | Options (internal value = label unless shown) |
|---------------|------------------|----------------------------|------------------|
| employees     | Employees        | Dropdown select            | 1-49 (1–49), 50-199 (50–199), 200-999 (200–999), 1000-4999 (1,000–4,999), 5000+ (5,000+) |
| plan          | Plan of interest | Dropdown select            | core (Core), pro (Pro), enterprise (Enterprise) |
| form_id       | Lead form        | Single-line text           | |
| gclid         | gclid            | Single-line text           | |
| gbraid        | gbraid           | Single-line text           | |
| wbraid        | wbraid           | Single-line text           | |
| fbclid        | fbclid           | Single-line text           | |
| li_fat_id     | li_fat_id        | Single-line text           | |
| msclkid       | msclkid          | Single-line text           | |
| utm_source    | UTM source       | Single-line text           | |
| utm_medium    | UTM medium       | Single-line text           | |
| utm_campaign  | UTM campaign     | Single-line text           | |
| utm_term      | UTM term         | Single-line text           | |
| utm_content   | UTM content      | Single-line text           | |
| ga_client_id  | GA client ID     | Single-line text           | |

Empty values are not sent, so a repeat lead without a click ID keeps the
value already on the contact.

Private app scopes needed for HUBSPOT_TOKEN: `crm.objects.contacts.write`
(and `crm.objects.contacts.read`, which upsert needs to match on email).
