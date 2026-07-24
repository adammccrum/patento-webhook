/**
 * Task planner - decomposes objectives into executable subtasks
 */

const { Task, Objective, OBJECTIVE_TYPES, TASK_STATES } = require('./task-schema');
const logger = require('../utils/logger');

class TaskPlanner {
  constructor(agentRegistry, classifier) {
    this.agentRegistry = agentRegistry;
    this.classifier = classifier;
  }

  /**
   * Plan task execution for an objective
   */
  plan(objective) {
    logger.info(`Planning execution for objective: ${objective.description}`);

    // Classify the objective
    const classification = this.classifier.classify(objective);
    objective.type = classification.type;

    // Create main task
    const task = new Task({
      objective_id: objective.id,
      title: `Execute: ${objective.description.substring(0, 50)}`,
      description: objective.description,
      objective_type: classification.type,
      user_id: objective.user_id,
      priority: this.determinePriority(objective)
    });

    // Generate subtask templates based on objective type
    let subtaskTemplates = [];
    switch (classification.type) {
      case OBJECTIVE_TYPES.CREATE_CONTENT:
        subtaskTemplates = this.planContentCreation(objective);
        break;
      case OBJECTIVE_TYPES.ANALYZE_DATA:
        subtaskTemplates = this.planDataAnalysis(objective);
        break;
      case OBJECTIVE_TYPES.GENERATE_MEDIA:
        subtaskTemplates = this.planMediaGeneration(objective);
        break;
      case OBJECTIVE_TYPES.AUTOMATE_WORKFLOW:
        subtaskTemplates = this.planWorkflowAutomation(objective);
        break;
      case OBJECTIVE_TYPES.PROVIDE_CONSULTATION:
        subtaskTemplates = this.planConsultation(objective);
        break;
      case OBJECTIVE_TYPES.INTEGRATE_SYSTEM:
        subtaskTemplates = this.planIntegration(objective);
        break;
      default:
        subtaskTemplates = Array.isArray(this.planGeneric(objective)) ?
          this.planGeneric(objective) :
          [this.planGeneric(objective)];
    }

    // First pass: Create all subtasks and map template indices to actual IDs
    const indexToIdMap = new Map();
    const createdSubtasks = [];

    for (let i = 0; i < subtaskTemplates.length; i++) {
      const template = subtaskTemplates[i];
      const subtaskData = {
        title: template.title,
        description: template.description,
        agent_code: template.agent_code,
        capability_required: template.capability_required,
        input: template.input || {},
        max_retries: template.max_retries || 3,
        dependencies: [] // Will be updated in second pass
      };

      const subtask = task.addSubtask(subtaskData);
      createdSubtasks.push(subtask);
      indexToIdMap.set(i, subtask.id);
    }

    // Second pass: Wire up dependencies using actual IDs
    for (let i = 0; i < subtaskTemplates.length; i++) {
      const template = subtaskTemplates[i];
      if (template.dependsOn && template.dependsOn.length > 0) {
        const subtask = createdSubtasks[i];
        for (const depIndex of template.dependsOn) {
          if (depIndex < i && indexToIdMap.has(depIndex)) {
            subtask.dependencies.push(indexToIdMap.get(depIndex));
          }
        }
      }
    }

    logger.info(`Created task ${task.id} with ${subtaskTemplates.length} subtasks`);
    return task;
  }


  /**
   * Plan content creation tasks (articles, guides, etc.)
   */
  planContentCreation(objective) {
    const entities = this.classifier.extractEntities(objective);

    // Use null for dependencies - will be resolved after creating subtasks
    return [
      {
        title: 'Research Topic',
        description: `Gather information about: ${objective.description}`,
        agent_code: 'CC', // Charlie (research)
        capability_required: 'research',
        input: {
          topic: objective.description,
          sources: entities.resources
        },
        dependencies: []
      },
      {
        title: 'Generate Content',
        description: `Write comprehensive content based on research findings`,
        agent_code: 'DD', // Delta (documents)
        capability_required: 'document_generation',
        input: {
          topic: objective.description,
          format: entities.formats[0] || 'markdown'
        },
        dependsOn: [0] // Will be resolved to actual ID
      },
      {
        title: 'Review & Polish',
        description: `Review content for quality and correctness`,
        agent_code: 'PP', // Papa (QA)
        capability_required: 'quality_assurance',
        input: {
          content_type: 'document'
        },
        dependsOn: [1]
      }
    ];
  }

  /**
   * Plan data analysis tasks
   */
  planDataAnalysis(objective) {
    return [
      {
        title: 'Gather Data',
        description: `Collect data needed for analysis`,
        agent_code: 'OO', // Oscar (data)
        capability_required: 'data_collection',
        input: {
          analysis_type: objective.description
        },
        dependencies: []
      },
      {
        title: 'Analyze Data',
        description: `Perform analysis and generate insights`,
        agent_code: 'OO', // Oscar (data)
        capability_required: 'data_analysis',
        input: {
          analysis_focus: objective.description
        },
        dependencies: [0]
      },
      {
        title: 'Create Dashboard',
        description: `Visualize findings in a dashboard`,
        agent_code: 'VV', // Victor (vision/visualization)
        capability_required: 'visualization',
        input: {
          metrics: []
        },
        dependencies: [1]
      }
    ];
  }

  /**
   * Plan media generation tasks (images, videos, audio)
   */
  planMediaGeneration(objective) {
    return [
      {
        title: 'Plan Media Production',
        description: `Create a production plan for: ${objective.description}`,
        agent_code: 'FF', // Foxtrot (media)
        capability_required: 'media_planning',
        input: {
          media_description: objective.description
        },
        dependencies: []
      },
      {
        title: 'Generate Media',
        description: `Execute media generation according to plan`,
        agent_code: 'FF', // Foxtrot (media)
        capability_required: 'media_generation',
        input: {
          specifications: {}
        },
        dependencies: [0]
      },
      {
        title: 'Add Audio',
        description: `Add voice narration or audio`,
        agent_code: 'EE', // Echo (voice)
        capability_required: 'text_to_speech',
        input: {
          script: ''
        },
        dependencies: [1],
        max_retries: 2
      }
    ];
  }

  /**
   * Plan workflow automation tasks
   */
  planWorkflowAutomation(objective) {
    return [
      {
        title: 'Design Workflow',
        description: `Design automation workflow: ${objective.description}`,
        agent_code: 'II', // India (automation)
        capability_required: 'workflow_design',
        input: {
          workflow_description: objective.description
        },
        dependencies: []
      },
      {
        title: 'Build Automation',
        description: `Implement the automation workflow`,
        agent_code: 'BB', // Bravo (code)
        capability_required: 'automation_implementation',
        input: {
          implementation_spec: {}
        },
        dependencies: [0]
      },
      {
        title: 'Test Workflow',
        description: `Test automation for correctness`,
        agent_code: 'PP', // Papa (QA)
        capability_required: 'testing',
        input: {
          test_scenarios: []
        },
        dependencies: [1]
      }
    ];
  }

  /**
   * Plan consultation/advisory tasks
   */
  planConsultation(objective) {
    return [
      {
        title: 'Research Question',
        description: `Research and understand the question: ${objective.description}`,
        agent_code: 'CC', // Charlie (research)
        capability_required: 'research',
        input: {
          question: objective.description
        },
        dependencies: []
      },
      {
        title: 'Provide Recommendation',
        description: `Provide expert recommendation based on research`,
        agent_code: 'BB', // Bravo (expertise)
        capability_required: 'consulting',
        input: {
          context: objective.context
        },
        dependencies: [0]
      },
      {
        title: 'Prepare Documentation',
        description: `Document recommendations for reference`,
        agent_code: 'DD', // Delta (documentation)
        capability_required: 'documentation',
        input: {
          recommendation_summary: ''
        },
        dependencies: [1]
      }
    ];
  }

  /**
   * Plan system integration tasks
   */
  planIntegration(objective) {
    return [
      {
        title: 'Design Integration',
        description: `Design system integration: ${objective.description}`,
        agent_code: 'RR', // Romeo (APIs)
        capability_required: 'api_design',
        input: {
          integration_requirement: objective.description
        },
        dependencies: []
      },
      {
        title: 'Implement Integration',
        description: `Implement the integration`,
        agent_code: 'BB', // Bravo (code)
        capability_required: 'development',
        input: {
          specifications: {}
        },
        dependencies: [0]
      },
      {
        title: 'Test Integration',
        description: `Test integration endpoints and data flow`,
        agent_code: 'PP', // Papa (QA)
        capability_required: 'integration_testing',
        input: {
          endpoints: []
        },
        dependencies: [1]
      }
    ];
  }

  /**
   * Generic planning for other objective types
   */
  planGeneric(objective) {
    return {
      title: 'Process Objective',
      description: objective.description,
      agent_code: 'CC', // Charlie (research/analysis)
      capability_required: 'analysis',
      input: {
        objective: objective.description
      },
      dependencies: []
    };
  }

  /**
   * Determine priority based on constraints
   */
  determinePriority(objective) {
    const description = (objective.description || '').toLowerCase();

    if (description.includes('urgent') || description.includes('asap')) {
      return 'high';
    }
    if (description.includes('optional') || description.includes('background')) {
      return 'low';
    }
    return 'normal';
  }
}

module.exports = TaskPlanner;
