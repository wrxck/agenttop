export const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

export const formatTime = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour12: false });
};

export const formatModel = (model: string): string => {
  if (model.includes('opus')) return 'opus';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('haiku')) return 'haiku';
  return model.slice(0, 4);
};

export const formatModelShort = (model: string): string => {
  if (model.includes('opus')) return 'opus';
  if (model.includes('sonnet')) return 'son';
  if (model.includes('haiku')) return 'hai';
  return model.slice(0, 4);
};
