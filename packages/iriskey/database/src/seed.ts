/**
 * Seeds the content a fresh deployment needs.
 *
 *   npm run seed --workspace=@iriskey/database
 *
 * Idempotent: safe to run on every deploy. It creates Course 1 if missing,
 * repairs the slug if an older row predates slugs, and otherwise does nothing.
 */

import { PrismaClient } from '@prisma/client';
import { requireDatabaseUrl } from './env';
import { COURSE_1 } from './seed-data';

// tsx loads no .env of its own. Without this the script fails on a clean
// checkout with a Prisma error that reads like a schema fault.
const prisma = new PrismaClient({ datasources: { db: { url: requireDatabaseUrl() } } });

async function seedCourse1(): Promise<string> {
  const existing = await prisma.course.findFirst({
    where: { OR: [{ slug: COURSE_1.slug }, { position: COURSE_1.position }] },
    include: { missions: true },
  });

  if (existing) {
    if (existing.slug !== COURSE_1.slug) {
      await prisma.course.update({
        where: { id: existing.id },
        data: { slug: COURSE_1.slug },
      });
      return `repaired slug on existing course (${existing.missions.length} missions)`;
    }
    return `already present (${existing.missions.length} missions)`;
  }

  const course = await prisma.course.create({
    data: {
      slug: COURSE_1.slug,
      title: COURSE_1.title,
      description: COURSE_1.description,
      position: COURSE_1.position,
      missions: {
        create: COURSE_1.missions.map((m) => ({
          title: m.title,
          tagline: m.tagline,
          description: m.description,
          position: m.position,
          problemArea: m.problemArea,
          toolkitName: m.toolkitName,
          overview: m.overview,
          coachPrompt: m.coachPrompt,
          buildTemplate: m.buildTemplate,
          reflectionPrompt: m.reflectionPrompt,
          achievement: m.achievement,
          timeSavedMinutes: m.timeSavedMinutes,
          successCriteria: m.successCriteria,
        })),
      },
    },
    include: { missions: true },
  });

  return `created with ${course.missions.length} missions`;
}

async function main(): Promise<void> {
  console.log(`Course 1: ${await seedCourse1()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
