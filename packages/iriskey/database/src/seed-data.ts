/**
 * Canonical seed content.
 *
 * Lives in the database package so the seed script and the admin re-seed
 * endpoint share one definition. A fresh deployment must not depend on someone
 * remembering to POST an endpoint — without Course 1 a new learner's first
 * click has nowhere to go.
 */

export const COURSE_1 = {
  slug: 'course-1',
  title: 'Building AI Assistants for Your Work',
  description:
    'Learn to build practical AI assistants that solve real problems in your daily work. Each mission teaches you to create a working tool you can use immediately.',
  position: 1,

  missions: [
    {
      title: 'Win Back One Hour',
      tagline: 'Free up an hour every week',
      description:
        'Identify a task you do regularly that steals your time. Solve it with AI and reclaim that hour each week.',
      position: 1,
      problemArea: 'General',
      toolkitName: 'Personal Assistant',
      overview: `What takes up your time?

Pick something you do regularly that you'd love to stop doing. Something you'd skip if you could.

Then solve it with AI. Not with perfect AI. With AI that's good enough to let you focus on what matters.`,
      coachPrompt:
        'What\'s a task at work that wastes your time? Something you do over and over that you\'d love to skip?',
      reflectionPrompt:
        'Does this actually work? What surprised you? What will you do with the extra hour each week?',
      buildTemplate: null,
      achievement: 'You saved 1 hour per week',
      timeSavedMinutes: 60,
      successCriteria: JSON.stringify([
        'Clearly defines what the AI should do',
        'Includes specific instructions for the AI',
        'Tested with a real example',
        'Produces usable output',
      ]),
    },
    {
      title: 'Clear Your Inbox Faster',
      tagline: 'Reclaim your inbox time',
      description:
        'Email drowns your day. Solve it: let AI triage what matters, summarize action items, and help you clear your inbox before lunch.',
      position: 2,
      problemArea: 'Email',
      toolkitName: 'Email Assistant',
      overview: `Email is a constant source of interruption.

Instead of reading every email, what if AI could read them for you? Summarize what matters. Flag what's urgent. Help you focus on what actually needs your attention.

You'll solve the problem: "Email eats my day."`,
      coachPrompt:
        'What\'s the real email problem you\'re solving? Too many arriving? Hard to find what\'s urgent? Takes too long to process?',
      reflectionPrompt:
        'Does this actually clear your inbox faster? What surprised you? What time does this give you back?',
      buildTemplate: `Task: Read email and extract action items
Instructions:
1. Look for deadlines and urgency signals
2. Extract specific action items (who, what, when)
3. Categorize: Decision Needed, Follow-up Required, FYI
4. Keep summary to 2-3 sentences max`,
      achievement: 'You reclaimed email time',
      timeSavedMinutes: 45,
      successCriteria: JSON.stringify([
        'Handles multiple types of emails (sales, support, collaboration)',
        'Consistent formatting of action items',
        'Correctly identifies urgency',
        'Safe to use on sensitive emails',
      ]),
    },
    {
      title: 'Create Content That Sounds Like You',
      tagline: 'Write faster, keep your voice',
      description:
        'Writing takes time. Solve it: let AI handle the rough draft, improve your tone, adapt to your audience — while you focus on what you want to say.',
      position: 3,
      problemArea: 'Writing',
      toolkitName: 'Content Assistant',
      overview: `You have something to say. You just don't want to spend an hour writing it.

What if AI could handle the draft? Improve the tone. Keep your voice. Adapt it to whoever you're writing to.

You'll solve the problem: "Writing takes too long."`,
      coachPrompt:
        'What writing problem are you solving? Too slow to draft? Tone issues? Struggling to adapt to your audience?',
      reflectionPrompt:
        'Is your writing actually faster now? Does it still sound like you? What can you do with the time you saved?',
      buildTemplate: `Task: Improve and expand written content
Instructions:
1. Check for clarity and tone
2. Improve word choice without changing meaning
3. Expand with specific examples
4. Adapt formality level based on audience
5. Keep original message intact`,
      achievement: 'Your writing got better and faster',
      timeSavedMinutes: 30,
      successCriteria: JSON.stringify([
        'Preserves original intent and tone',
        'Output is more professional and clear',
        'Appropriate for the stated audience',
        'Specific enough to be actionable',
      ]),
    },
    {
      title: 'Find Insights In Minutes',
      tagline: 'Let AI read your data',
      description:
        'Your data holds answers. Solve it: let AI find patterns you\'d miss, surface anomalies, calculate metrics, tell you what to do.',
      position: 4,
      problemArea: 'Analysis',
      toolkitName: 'Research Assistant',
      overview: `You look at data every day. Sales numbers. Metrics. Feedback. But turning data into insight takes time.

What if AI could read it for you? Find patterns. Surface anomalies. Calculate what matters. Tell you what to do.

You'll solve the problem: "I can't extract insights fast enough."`,
      coachPrompt:
        'What data problem are you solving? Can\'t find insights? Spend too long analyzing? Overwhelmed by the volume?',
      reflectionPrompt:
        'Did you find insights you missed before? What surprised you? What will you do differently now?',
      buildTemplate: `Task: Analyze data and provide insights
Instructions:
1. Read and understand the data format
2. Calculate key metrics
3. Identify trends and anomalies
4. Compare to expected patterns
5. Suggest top 3 actions to take`,
      achievement: 'You found insights in minutes, not hours',
      timeSavedMinutes: 90,
      successCriteria: JSON.stringify([
        'Identifies real patterns in the data',
        'Insights are specific and actionable',
        'Explains the "why" behind findings',
        'Suggests concrete next steps',
      ]),
    },
    {
      title: 'Solve Your Own Problem',
      tagline: 'Pick any problem. You know how now.',
      description:
        "You've solved four real problems. Now solve the one that actually matters to you. Work. Personal. Creative. Anything.",
      position: 5,
      problemArea: 'Your Choice',
      toolkitName: 'Custom Solution',
      overview: `You've solved four problems with AI. You've felt it work. You understand the pattern.

Now pick the problem that's been nagging at you. The one you thought about while solving the first four. The one you really wish would go away.

Solve it. You know how.`,
      coachPrompt:
        'What problem keeps coming back to you? The one that\'s really slowing you down? Work, personal, creative—whatever it is.',
      reflectionPrompt:
        "You've now solved five real problems. What could change in your life if you kept using these solutions? What's next?",
      buildTemplate: null,
      achievement: 'You solved your own problem',
      timeSavedMinutes: 120,
      successCriteria: JSON.stringify([
        'Solves a real problem you face',
        'You actually use it',
        'You\'d recommend it to someone else',
      ]),
    },
  ],
};
