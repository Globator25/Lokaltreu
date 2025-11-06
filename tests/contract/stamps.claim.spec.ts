/* eslint-disable @typescript-eslint/no-unused-expressions */
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
import chai from 'chai';
import chaiResponseValidator from 'chai-openapi-response-validator';
chai.use(chaiResponseValidator('apps/api/openapi/lokaltreu-openapi-v2.0.yaml'));
describe('stamps/claim contract', () => {
  it('201 matches schema', async () => {
    const res = await fetch('http://localhost:4010/stamps/claim', { method:'POST', headers:{'Idempotency-Key':'a'}, body: JSON.stringify({ qrToken:'x'}) });
    chai.expect(res.status).to.equal(201);
    chai.expect(res).to.satisfyApiSpec;
  });
});


