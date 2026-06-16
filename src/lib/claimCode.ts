// One-time ownership-claim verification code (e.g. "HSM-7K2QF"). The owner DMs
// it to @honsulmap from their venue's IG account so the operator can match the
// claim to the sender. Used by both the partner submit endpoint and the admin
// issue/reissue action.
export function genClaimCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += alphabet[bytes[i] % alphabet.length];
  return `HSM-${s}`;
}
