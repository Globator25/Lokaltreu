import { expect } from 'vitest';
import { requireDeviceProof } from '../../../apps/api/src/mw/device-proof';
test('missing proof → 401', async () => {
  const req = new Request('http://localhost:4010/rewards/redeem',{ method:'POST', headers:{} });
  await expect(requireDeviceProof(req, 'PUBKEY', 'jti-1')).rejects.toBeTruthy();
});
