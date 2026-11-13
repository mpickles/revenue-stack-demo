// Inline scripts for <head>. Order matters: the data layer and the consent
// defaults must exist before the container snippet runs.

export const CONSENT_DEFAULT_SCRIPT = `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
// Re-apply a choice remembered from an earlier visit, still before the container.
var rwConsent = document.cookie.match(/(?:^|; )rw_consent=(granted|denied)(?:;|$)/);
if (rwConsent && rwConsent[1] === 'granted') {
  gtag('consent', 'update', {
    ad_storage: 'granted',
    analytics_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted'
  });
}
`;

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/;

// Returns null when the ID is unset or malformed, so no container loads.
export function gtmId(raw: string | undefined): string | null {
  return raw && GTM_ID_PATTERN.test(raw) ? raw : null;
}

export function gtmScript(id: string): string {
  return `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${JSON.stringify(id)});
`;
}
