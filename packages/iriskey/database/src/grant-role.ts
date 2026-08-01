/**
 * Grant or revoke a platform role.
 *
 * Roles are data so they can change without a deploy; what a role *means* is
 * code, in @iriskey/authz, so it can only change under review. This script is
 * the supported way to move the data half.
 *
 *   npm run grant-role --workspace=@iriskey/database -- --email a@b.com --role founder
 *   npm run grant-role --workspace=@iriskey/database -- --email a@b.com --role founder --revoke
 *   npm run grant-role --workspace=@iriskey/database -- --list
 *
 * Deliberately a script, not an endpoint: granting `founder` is a privileged
 * operation and should require access to the deployment, not a session.
 */

import { PrismaClient } from '@prisma/client';
import { requireDatabaseUrl } from './env';

// Kept in step with @iriskey/authz. The database package cannot import authz
// (authz depends on the generated client), so this list is duplicated here and
// guarded by the check below.
const ROLES = ['learner', 'coach', 'support', 'enterprise', 'admin', 'founder'] as const;
type RoleName = (typeof ROLES)[number];

// Same reason as seed.ts: tsx loads no .env.
const prisma = new PrismaClient({ datasources: { db: { url: requireDatabaseUrl() } } });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function list(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { roles: { some: {} } },
    select: { email: true, roles: { select: { name: true } } },
    orderBy: { email: 'asc' },
  });

  if (users.length === 0) {
    console.log('No user holds an explicit role. Everyone is a learner.');
    return;
  }

  console.log('Explicit role assignments:\n');
  for (const user of users) {
    console.log(`  ${user.email.padEnd(40)} ${user.roles.map((r) => r.name).join(', ')}`);
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--list')) {
    await list();
    return;
  }

  const email = arg('email');
  const role = arg('role') as RoleName | undefined;
  const revoke = process.argv.includes('--revoke');

  if (!email || !role) {
    console.error(
      'Usage: --email <address> --role <' + ROLES.join('|') + '> [--revoke]\n' +
        '       --list'
    );
    process.exitCode = 1;
    return;
  }

  if (!ROLES.includes(role)) {
    console.error(`Unknown role "${role}". Known roles: ${ROLES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exitCode = 1;
    return;
  }

  // The Role row is created on first use rather than pre-seeded, so the table
  // only ever contains roles somebody actually holds.
  const roleRow = await prisma.role.upsert({
    where: { name: role },
    update: {},
    create: { name: role, description: `Platform role: ${role}` },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { roles: revoke ? { disconnect: { id: roleRow.id } } : { connect: { id: roleRow.id } } },
  });

  const after = await prisma.user.findUnique({
    where: { id: user.id },
    select: { roles: { select: { name: true } } },
  });

  console.log(
    `${revoke ? 'Revoked' : 'Granted'} "${role}" ${revoke ? 'from' : 'to'} ${email}.\n` +
      `Now holds: ${after?.roles.map((r) => r.name).join(', ') || '(learner only)'}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
