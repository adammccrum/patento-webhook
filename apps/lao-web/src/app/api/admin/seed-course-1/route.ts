import { withCapability } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
// One definition, shared with the seed script that runs on deploy.
import { COURSE_1 as COURSE_1_DATA } from '@iriskey/database';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';


export const POST = withCapability('content.seed', async (_request: Request) => {
  try {

    // Check if Course 1 already exists
    const existingCourse = await prisma.course.findFirst({
      where: { OR: [{ slug: COURSE_1_DATA.slug }, { position: 1 }] },
    });

    if (existingCourse) {
      // A course seeded before slugs existed still needs one, or its links
      // will not resolve.
      if (existingCourse.slug !== COURSE_1_DATA.slug) {
        await prisma.course.update({
          where: { id: existingCourse.id },
          data: { slug: COURSE_1_DATA.slug },
        });
      }
      return NextResponse.json(
        { message: 'Course 1 already exists', courseId: existingCourse.id },
        { status: 200 }
      );
    }

    // Create course with missions
    const course = await prisma.course.create({
      data: {
        slug: COURSE_1_DATA.slug,
        title: COURSE_1_DATA.title,
        description: COURSE_1_DATA.description,
        position: COURSE_1_DATA.position,
        missions: {
          create: COURSE_1_DATA.missions.map((mission) => ({
            title: mission.title,
            tagline: mission.tagline,
            description: mission.description,
            position: mission.position,
            problemArea: mission.problemArea,
            toolkitName: mission.toolkitName,
            overview: mission.overview,
            coachPrompt: mission.coachPrompt,
            reflectionPrompt: mission.reflectionPrompt,
            buildTemplate: mission.buildTemplate,
            achievement: mission.achievement,
            timeSavedMinutes: mission.timeSavedMinutes,
            successCriteria: mission.successCriteria,
          })),
        },
      },
      include: { missions: true },
    });

    return NextResponse.json(
      {
        message: 'Course 1 created successfully',
        course,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error seeding Course 1:', error);
    return NextResponse.json(
      { error: 'Failed to seed course' },
      { status: 500 }
    );
  }
});
