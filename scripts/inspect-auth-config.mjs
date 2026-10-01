import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

async function main() {
  const ref = env.SUPABASE_PROJECT_REF;
  const token = env.SUPABASE_ACCESS_TOKEN;

  if (!ref || !token) {
    console.error('Missing credentials');
    process.exit(1);
  }
if (ref !== 'rvepsyvhsqumfpemhbba') {
  throw new Error('Refusing to inspect a Supabase project other than the configured development project.');
}

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    console.error('HTTP', res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  console.log(JSON.stringify({
    site_url: data.site_url,
    uri_allow_list: data.uri_allow_list,
    smtp_configured: Boolean(data.smtp_host && data.smtp_port && data.smtp_user && data.smtp_pass),
    smtp_sender_configured: Boolean(data.smtp_admin_email && data.smtp_sender_name),
    mailer_autoconfirm: data.mailer_autoconfirm,
    rate_limit_email_sent: data.rate_limit_email_sent,
    otp_length: data.otp_length
  }, null, 2));
}

main();
