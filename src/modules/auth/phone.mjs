export function normalizeBrazilianPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return `+${digits}`;

  throw new Error('Informe um telefone brasileiro válido ou deixe o campo vazio.');
}
