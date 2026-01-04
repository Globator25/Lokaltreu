/**
 * DEV ONLY – not for production.
 *
 * CLI helper to create a RewardToken for local testing.
 *
 * Usage:
 *   npx ts-node src/dev/create-reward-token.ts --tenant-id TENANT1 --card-id CARD1
 */
import crypto from "node:crypto";
import { hashToken } from "../handlers/http-utils.js";
import { InMemoryRewardTokenStore } from "../modules/rewards/reward.service.js";

type Args = {
  tenantId?: string;
  cardId?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key || !value) continue;
    if (key === "--tenant-id") {
      args.tenantId = value;
    }
    if (key === "--card-id") {
      args.cardId = value;
    }
  }
  return args;
}

async function main() {
  const { tenantId, cardId } = parseArgs(process.argv.slice(2));
  if (!tenantId || !cardId) {
    console.error("Missing required args: --tenant-id TENANT --card-id CARD");
    process.exit(1);
  }

  const redeemToken = crypto.randomBytes(32).toString("base64url");
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const tokenHash = hashToken(redeemToken);

  const tokenStore = new InMemoryRewardTokenStore();
  await tokenStore.createToken({
    id: jti,
    tenantId,
    deviceId: "dev-device",
    cardId,
    tokenHash,
    expiresAt,
  });

  console.log(
    JSON.stringify(
      {
        redeemToken,
        jti,
        tenantId,
        cardId,
        expiresAt: expiresAt.toISOString(),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Failed to create reward token:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});

