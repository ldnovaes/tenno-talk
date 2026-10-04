// Run locally and store the output in the deployment secret manager, never in git.
import { generateKeyPairSync } from "node:crypto";
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, "base64url"),
  Buffer.from(jwk.y, "base64url"),
]);
process.stdout.write(
  `VAPID_PUBLIC_KEY=${publicKey.toString("base64url")}\nVAPID_PRIVATE_KEY=${jwk.d}\n`,
);
