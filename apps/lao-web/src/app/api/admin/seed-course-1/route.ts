import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const COURSE_1_DATA = {
  title: 'Building AI Assistants for Your Work',
  description:
    'Learn to build practical AI assistants that solve real problems in your daily work. Each lesson teaches you to create a working tool you can use immediately.',
  position: 1,

  lessons: [
    {
      title: 'Your First AI Assistant',
      description: 'Build an AI assistant to solve a real problem you face at work',
      position: 1,
      problemArea: 'General',
      overview: `You already know how to build AI assistants. In this lesson, you'll apply that skill to solve your first real problem.

Pick something you do regularly that takes up your time. Something that would free up 30 minutes in your week if you could automate it.

Then build an AI assistant to do it for you.`,
      coachPrompt:
        'What\'s one task at work that takes up your time? Something repetitive that you wish you could skip?',
      reflectionPrompt:
        'Did it work? What surprised you about building this? How will you use it this week?',
      buildTemplate: null,
      successCriteria: JSON.stringify([
        'Clearly defines what the AI should do',
        'Includes specific instructions for the AI',
        'Tested with a real example',
        'Produces usable output',
      ]),
    },
    {
      title: 'AI for Email Management',
      description:
        'Build an AI assistant that processes your emails and extracts what matters',
      position: 2,
      problemArea: 'Email',
      overview: `Email is a constant source of interruption. In this lesson, you'll build an AI assistant that reads your emails and does the thinking for you.

You'll create a tool that:
- Summarizes long emails into key action items
- Flags urgent messages
- Categorizes by type
- Drafts quick responses`,
      coachPrompt:
        'What\'s your biggest email headache? Too many emails? Hard to find what\'s important? Too long to read?',
      reflectionPrompt:
        'How much time could this save you each week? What would you do with that time?',
      buildTemplate: `Task: Read email and extract action items
Instructions:
1. Look for deadlines and urgency signals
2. Extract specific action items (who, what, when)
3. Categorize: Decision Needed, Follow-up Required, FYI
4. Keep summary to 2-3 sentences max`,
      successCriteria: JSON.stringify([
        'Handles multiple types of emails (sales, support, collaboration)',
        'Consistent formatting of action items',
        'Correctly identifies urgency',
        'Safe to use on sensitive emails',
      ]),
    },
    {
      title: 'AI for Content Creation',
      description: 'Build an AI assistant that helps you write faster and better',
      position: 3,
      problemArea: 'Writing',
      overview: `Whether you write emails, reports, or social media, an AI assistant can help you write faster and more clearly.

In this lesson, you'll build a writing assistant that:
- Improves tone and clarity
- Expands brief ideas into full thoughts
- Adapts your voice to different audiences
- Checks for common mistakes`,
      coachPrompt:
        'What type of writing takes you the longest? Reports? Emails? Social media? Something else?',
      reflectionPrompt:
        'Did it make your writing better? Faster? How will this change your daily work?',
      buildTemplate: `Task: Improve and expand written content
Instructions:
1. Check for clarity and tone
2. Improve word choice without changing meaning
3. Expand with specific examples
4. Adapt formality level based on audience
5. Keep original message intact`,
      successCriteria: JSON.stringify([
        'Preserves original intent and tone',
        'Output is more professional and clear',
        'Appropriate for the stated audience',
        'Specific enough to be actionable',
      ]),
    },
    {
      title: 'AI for Data Analysis',
      description:
        'Build an AI assistant that turns raw data into insights you can act on',
      position: 4,
      problemArea: 'Analysis',
      overview: `You collect data every day. Sales numbers, metrics, feedback, metrics. But extracting insights takes time.

In this lesson, you'll build an analysis assistant that:
- Finds patterns you would miss
- Highlights anomalies
- Calculates key metrics
- Suggests what to do about trends`,
      coachPrompt:
        'What data do you look at regularly but find hard to analyze? Sales? Metrics? Customer feedback? Logs?',
      reflectionPrompt:
        'What insight surprised you? How will you act on what you learned?',
      buildTemplate: `Task: Analyze data and provide insights
Instructions:
1. Read and understand the data format
2. Calculate key metrics
3. Identify trends and anomalies
4. Compare to expected patterns
5. Suggest top 3 actions to take`,
      successCriteria: JSON.stringify([
        'Identifies real patterns in the data',
        'Insights are specific and actionable',
        'Explains the "why" behind findings',
        'Suggests concrete next steps',
      ]),
    },
    {
      title: 'Build Your Next AI Assistant',
      description: 'Apply everything you\'ve learned to solve your next problem',
      position: 5,
      problemArea: 'Your Choice',
      overview: `You\'ve built four AI assistants. You understand the process. You\'ve seen what\'s possible.

Now pick the next problem you want to solve. It could be something you thought of while building the first four. Or something completely new.

Whatever it is, you know how to build it.`,
      coachPrompt:
        'What\'s the next problem you want an AI assistant to solve? It could be anything—work, personal, creative.',
      reflectionPrompt:
        'You\'ve now built five working AI assistants. How has that changed what you think is possible? What will you build next?',
      buildTemplate: null,
      successCriteria: JSON.stringify([
        'Solves a real problem you face',
        'You actually use it',
        'You\'d recommend it to someone else',
      ]),
    },
  ],
};

export async function POST() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Course 1 already exists
    const existingCourse = await prisma.course.findFirst({
      where: { position: 1 },
    });

    if (existingCourse) {
      return NextResponse.json(
        { message: 'Course 1 already exists', courseId: existingCourse.id },
        { status: 200 }
      );
    }

    // Create course with lessons
    const course = await prisma.course.create({
      data: {
        title: COURSE_1_DATA.title,
        description: COURSE_1_DATA.description,
        position: COURSE_1_DATA.position,
        lessons: {
          create: COURSE_1_DATA.lessons.map((lesson) => ({
            title: lesson.title,
            description: lesson.description,
            position: lesson.position,
            problemArea: lesson.problemArea,
            overview: lesson.overview,
            coachPrompt: lesson.coachPrompt,
            reflectionPrompt: lesson.reflectionPrompt,
            buildTemplate: lesson.buildTemplate,
            successCriteria: lesson.successCriteria,
          })),
        },
      },
      include: { lessons: true },
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
}
