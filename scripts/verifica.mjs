import { spawnSync } from "node:child_process";

const comandos = [
  ["npm", ["run", "lint"]],
  ["npm", ["run", "coverage"]],
  ["npm", ["exec", "--", "tsc", "--noEmit"]],
  ["npm", ["run", "build"]],
];

for (const [comando, args] of comandos) {
  const resultado = spawnSync(comando, args, { stdio: "inherit", shell: true, env: { ...process.env } });
  if (resultado.status !== 0) process.exit(resultado.status ?? 1);
}
