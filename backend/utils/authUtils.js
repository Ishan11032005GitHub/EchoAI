import crypto from 'crypto';

const STATE_SECRET = process.env.STATE_SECRET || 'some-default-secret';

export function generateStateParam() {
  // Random + HMAC (optional)
  const raw = crypto.randomBytes(8).toString('hex');
  const hmac = crypto.createHmac('sha256', STATE_SECRET).update(raw).digest('hex').slice(0, 8);
  return `${raw}.${hmac}`;
}

export function verifyStateParam(receivedState) {
  const [raw, receivedHmac] = receivedState.split('.');
  const expectedHmac = crypto.createHmac('sha256', STATE_SECRET).update(raw).digest('hex').slice(0, 8);

  if (receivedHmac !== expectedHmac) {
    throw new Error('Invalid state parameter');
  }

  // ✅ Return the raw part (used as redirect path)
  return `/${raw}`;
}