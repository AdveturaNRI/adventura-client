# VK Ads Pixel

The web client receives the VK Ads Pixel ID from the Adventura backend's public
configuration. Set it in AdminJS: **Analytics → VK Ads Pixel**. The value is a
public browser identifier, not an API secret. Native Android and iOS builds do
not load the tag. An empty or malformed server value disables it safely.

The integration uses VK Ads' current Top.Mail.Ru `_tmr` queue: `pageView` for
Expo Router SPA navigation and `reachGoal` for configured JS goals. It sends no
email address, user ID, access token, profile data, or other personal data.

## Events to create in VK Ads

In VK Ads open **Sites**, select the pixel for `adventu.ru`, then open
**Events** and add each event manually. Choose the appropriate category
(**Registration** for the first event; **Custom conversion** for the remaining
product actions), choose the condition **A JavaScript event occurred**, and
enter the exact name below:

| Product action | VK Ads JS event |
| --- | --- |
| New email registration | `adventura_registration` |
| First completion of the player questionnaire | `adventura_profile_created` |
| Successful game application | `adventura_application_sent` |
| Application approved | `adventura_application_approved` |
| CTA click on a public landing | `adventura_landing_cta` |

`adventura_registration` is the primary conversion goal. It is emitted only
after `POST /auth/register` has succeeded. Password login, a failed request,
opening the form, refreshes, and OAuth login do not emit it. OAuth currently
does not expose a reliable `new account` marker in its API response, so it is
intentionally not counted as a VK registration.

`adventura_application_approved` is reserved in the client event contract but
is not emitted from the master's browser: approval may happen on another device
and must not be attributed to the master's advertising session. It needs a
server-to-server VK conversion integration if that goal becomes required.

## Deploy configuration and verification

1. In AdminJS open **Analytics → VK Ads Pixel**, enter the numeric pixel ID and
   save. It is applied by the client through `/api/config/public`; no frontend
   environment edit or web rebuild is needed.
2. Open an incognito browser with ad blockers disabled and visit a landing URL
   containing UTM parameters. In DevTools Network, check requests to
   `top-fwz1.mail.ru`; OAuth codes and tokens must not appear in the URL sent
   to the tracker.
3. Navigate within the SPA and confirm one `pageView` per route. Complete a new
   email registration and check `adventura_registration` in the pixel's Events
   screen after VK Ads processing delay.
4. Repeat with an existing login and a failed registration: no registration
   goal should be shown. Test a landing CTA and a successful game application.

VK Ads and browser privacy/ad-blocking settings can block the external tag.
The application intentionally remains functional in that case; final receipt
of events must be verified manually in VK Ads.

Reference: [VK Ads pixel help](https://ads.vk.com/help/articles/pixel).
