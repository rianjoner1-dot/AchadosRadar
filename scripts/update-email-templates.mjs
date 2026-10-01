
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

function buildTemplate({ title, intro, buttonText, showOtp = false, securityNotice }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #222222; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #dedede; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <!-- Header / Brand -->
          <tr>
            <td style="padding: 28px 32px 20px; border-bottom: 1px solid #f0f0f0;">
              <span style="font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.5px;">
                Achados<span style="color: #9b6e00;">Radar</span>
              </span>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111111; line-height: 1.3;">
                ${title}
              </h1>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #555555;">
                ${intro}
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 28px;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #111111;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #111111;">
                      ${buttonText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              ${showOtp ? `<!-- OTP Code Alternative -->
              <div style="background-color: #f9f9f9; border: 1px solid #e8e8e8; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
                  Ou confirme com o c&oacute;digo:
                </p>
                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 28px; font-weight: 700; color: #111111; letter-spacing: 6px; padding: 4px 0;">
                  {{ .Token }}
                </div>
                <p style="margin: 8px 0 0; font-size: 12px; color: #777777;">
                  Se voc&ecirc; j&aacute; est&aacute; com a p&aacute;gina aberta neste navegador, digite o c&oacute;digo acima.
                </p>
              </div>` : ''}

              <!-- Security Warning -->
              <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: #777777;">
                &bull; Este link e c&oacute;digo s&atilde;o v&aacute;lidos por tempo limitado e de uso &uacute;nico.<br />
                &bull; ${securityNotice}
              </p>

              <!-- Plain Link Fallback -->
              <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.5; color: #999999; border-top: 1px solid #f0f0f0; padding-top: 16px;">
                Se o bot&atilde;o n&atilde;o funcionar, copie e cole o endere&ccedil;o abaixo no seu navegador:<br />
                <a href="{{ .ConfirmationURL }}" style="color: #666666; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px 24px; background-color: #fafafa; border-top: 1px solid #f0f0f0; font-size: 12px; color: #888888; text-align: center;">
              Achados Radar &bull; Ofertas verificadas e radar de pre&ccedil;os reais
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const magicLinkHtml = buildTemplate({
  title: 'Seu link de acesso à conta',
  intro: 'Recebemos uma solicita&ccedil;&atilde;o de login para <strong>{{ .Email }}</strong>. Clique no bot&atilde;o abaixo para entrar com seguran&ccedil;a no Achados Radar sem precisar de senha:',
  buttonText: 'Entrar no Achados Radar',
  showOtp: true,
  securityNotice: 'Se voc&ecirc; n&atilde;o solicitou este acesso, desconsidere esta mensagem com seguran&ccedil;a.'
});

const recoveryHtml = buildTemplate({
  title: 'Redefinição de senha',
  intro: 'Recebemos uma solicita&ccedil;&atilde;o para redefinir a senha da conta <strong>{{ .Email }}</strong>. Clique no bot&atilde;o abaixo para escolher uma nova senha:',
  buttonText: 'Redefinir minha senha',
  showOtp: false,
  securityNotice: 'Se voc&ecirc; n&atilde;o fez essa solicita&ccedil;&atilde;o, nenhuma altera&ccedil;&atilde;o foi realizada na sua conta.'
});

const confirmationHtml = buildTemplate({
  title: 'Confirme seu endereço de email',
  intro: 'Obrigado por se cadastrar no Achados Radar com o email <strong>{{ .Email }}</strong>. Clique no bot&atilde;o abaixo para confirmar seu email e ativar sua conta:',
  buttonText: 'Confirmar meu email',
  showOtp: true,
  securityNotice: 'Se voc&ecirc; n&atilde;o criou esta conta, por favor ignore este email.'
});

async function main() {
  const ref = env.SUPABASE_PROJECT_REF;
  const token = env.SUPABASE_ACCESS_TOKEN;

  if (!ref || !token) {
    console.error('SUPABASE_PROJECT_REF ou SUPABASE_ACCESS_TOKEN ausente no .env');
    process.exit(1);
  }

  const payload = {
    mailer_subjects_magic_link: 'Seu link de acesso | Achados Radar',
    mailer_templates_magic_link_content: magicLinkHtml,
    mailer_subjects_recovery: 'Redefinição de senha | Achados Radar',
    mailer_templates_recovery_content: recoveryHtml,
    mailer_subjects_confirmation: 'Confirme seu email | Achados Radar',
    mailer_templates_confirmation_content: confirmationHtml
  };

  console.log('Enviando atualização para Supabase Management API...');
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log('HTTP Status:', res.status);
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Erro na API:', errorText);
    process.exit(1);
  }

  const data = await res.json();
  console.log('Atualização concluída com sucesso!');
  console.log('- Assunto Magic Link:', data.mailer_subjects_magic_link);
  console.log('- Assunto Recuperação:', data.mailer_subjects_recovery);
  console.log('- Assunto Confirmação:', data.mailer_subjects_confirmation);
}

main();
