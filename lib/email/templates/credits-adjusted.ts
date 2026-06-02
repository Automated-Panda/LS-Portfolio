// lib/email/templates/credits-adjusted.ts
// Pure branded HTML for a manual admin credit adjustment. Mirrors the dark
// auth-email style in supabase/templates/*.html (logo, #0a0a0a bg, lime accent).

export type CreditsAdjustedEmail = { subject: string; html: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function creditsAdjustedEmail(opts: {
  delta: number;
  newBalance: number;
  note?: string | null;
}): CreditsAdjustedEmail {
  const isGift = opts.delta > 0;
  const subject = isGift
    ? "🎁 You've received GT Vault credits"
    : "Your GT Vault credit balance changed";
  const headline = isGift ? "You've received credits!" : "Your credit balance changed";
  const lead = isGift
    ? `Good news — an admin has added <strong style="color:#84cc16;">${opts.delta} credits</strong> to your GT Vault account.`
    : `An admin has adjusted your GT Vault credits by <strong style="color:#f5f5f5;">${opts.delta}</strong>.`;
  const noteBlock = opts.note
    ? `<p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#a3a3a3;font-style:italic;">"${escapeHtml(
        opts.note,
      )}"</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#161616;border:1px solid #262626;border-radius:14px;">
          <tr>
            <td style="padding:36px 40px 28px 40px;border-bottom:1px solid #262626;">
              <img src="https://www.gtvault.app/logo-email.png" width="200" alt="GT Vault" style="display:block;border:0;outline:none;text-decoration:none;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px 0;font-size:26px;line-height:1.25;font-weight:700;color:#f5f5f5;letter-spacing:-0.01em;">${headline}</h1>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#a3a3a3;">${lead}</p>
              ${noteBlock}
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#a3a3a3;">Your balance is now <strong style="color:#f5f5f5;">${opts.newBalance} credits</strong>.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#84cc16;border-radius:6px;">
                    <a href="https://www.gtvault.app/credits" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#0a0a0a;text-decoration:none;border-radius:6px;">View your credits</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px 40px;border-top:1px solid #262626;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#737373;">Credits power the GT Vault AI Organizer. Enjoy!</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0 0;font-size:11px;color:#525252;">GT Vault — a GTA V asset tracker.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
