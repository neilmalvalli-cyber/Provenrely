import crypto from 'crypto';

function canonicalize(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalize).join(',')}]`;
  const sortedKeys = Object.keys(obj).sort();
  return `{${sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

export function createCertificatePayload(scanData: any, issuerName: string) {
  const salt = crypto.randomBytes(32).toString('hex');
  const certPayload = { schemaVersion: '1.0', issuerName, scanResult: scanData, salt };
  const canonicalString = canonicalize(certPayload);
  const certHash = '0x' + crypto.createHash('sha256').update(salt + canonicalString).digest('hex');
  
  return { certificateId: crypto.randomUUID(), certHash, payload: certPayload };
}
