import { verifyGamePackages } from '../release/verify-game-packages.mjs';
console.log(
  JSON.stringify(
    await verifyGamePackages({
      out: process.argv.find((arg) => arg.startsWith('--out='))?.slice(6),
    }),
  ),
);
