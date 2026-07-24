/**
 * Objective classifier - analyzes user objectives and determines type and required agents
 */

const { OBJECTIVE_TYPES } = require('./task-schema');
const logger = require('../utils/logger');

class ObjectiveClassifier {
  constructor(agentRegistry) {
    this.agentRegistry = agentRegistry;
    this.keywords = {
      [OBJECTIVE_TYPES.CREATE_CONTENT]: [
        'write', 'create', 'generate', 'compose', 'author', 'draft',
        'produce', 'make', 'build', 'develop', 'article', 'blog',
        'course', 'document', 'guide', 'tutorial', 'report'
      ],
      [OBJECTIVE_TYPES.ANALYZE_DATA]: [
        'analyze', 'analyze', 'examine', 'evaluate', 'assess', 'review',
        'study', 'investigate', 'compare', 'data', 'metrics', 'statistics',
        'dashboard', 'insights', 'trends', 'patterns'
      ],
      [OBJECTIVE_TYPES.GENERATE_MEDIA]: [
        'image', 'video', 'audio', 'visual', 'graphic', 'animate',
        'create video', 'generate image', 'draw', 'design', 'render',
        'synthesize', 'voice', 'speech', 'narrate'
      ],
      [OBJECTIVE_TYPES.AUTOMATE_WORKFLOW]: [
        'automate', 'workflow', 'process', 'pipeline', 'integration',
        'connect', 'sync', 'schedule', 'trigger', 'automation'
      ],
      [OBJECTIVE_TYPES.PROVIDE_CONSULTATION]: [
        'advice', 'consult', 'recommend', 'suggest', 'help', 'explain',
        'guide', 'assist', 'support', 'how to', 'what is', 'best practices'
      ],
      [OBJECTIVE_TYPES.INTEGRATE_SYSTEM]: [
        'integrate', 'api', 'connect', 'link', 'sync', 'interface',
        'plugin', 'extension', 'service', 'third-party', 'bridge'
      ]
    };
  }

  /**
   * Classify objective based on content
   */
  classify(objective) {
    const description = (objective.description || '').toLowerCase();

    // Check keywords for each type
    let scores = {};
    for (const [type, keywords] of Object.entries(this.keywords)) {
      scores[type] = keywords.filter(kw => description.includes(kw)).length;
    }

    // Get type with highest score
    let classifiedType = OBJECTIVE_TYPES.OTHER;
    let maxScore = 0;
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        classifiedType = type;
      }
    }

    logger.debug(`Classified objective "${objective.description}" as ${classifiedType}`);

    return {
      type: classifiedType,
      confidence: maxScore > 0 ? (maxScore / 5) : 0, // Simple confidence scoring
      scores
    };
  }

  /**
   * Suggest agents for objective based on type
   */
  suggestAgents(objectiveType) {
    const agentMapping = {
      [OBJECTIVE_TYPES.CREATE_CONTENT]: ['DD', 'BB', 'QQ'], // Delta (docs), Bravo (code), Quebec (knowledge)
      [OBJECTIVE_TYPES.ANALYZE_DATA]: ['OO', 'CC', 'VV'], // Oscar (data), Charlie (research), Victor (vision)
      [OBJECTIVE_TYPES.GENERATE_MEDIA]: ['FF', 'EE'], // Foxtrot (media), Echo (voice)
      [OBJECTIVE_TYPES.AUTOMATE_WORKFLOW]: ['II', 'BB', 'RR'], // India (automation), Bravo (code), Romeo (APIs)
      [OBJECTIVE_TYPES.PROVIDE_CONSULTATION]: ['CC', 'BB', 'DD'], // Charlie (research), Bravo (expertise), Delta (docs)
      [OBJECTIVE_TYPES.INTEGRATE_SYSTEM]: ['RR', 'II', 'BB'], // Romeo (APIs), India (automation), Bravo (code)
      [OBJECTIVE_TYPES.OTHER]: ['CC', 'BB'] // Charlie, Bravo as defaults
    };

    return agentMapping[objectiveType] || agentMapping[OBJECTIVE_TYPES.OTHER];
  }

  /**
   * Extract entities from objective (what data/resources are needed)
   */
  extractEntities(objective) {
    const description = objective.description || '';

    const entities = {
      resources: [],
      formats: [],
      constraints: []
    };

    // Look for resource mentions
    if (description.match(/blog|article|guide|tutorial|course|training|book|paper/i)) {
      entities.resources.push('content');
    }
    if (description.match(/video|image|audio|graphic|animation/i)) {
      entities.resources.push('media');
    }
    if (description.match(/api|integration|system|database|workflow/i)) {
      entities.resources.push('system');
    }

    // Look for format constraints
    if (description.match(/markdown|pdf|json|csv|html|xml/i)) {
      entities.formats.push(description.match(/markdown|pdf|json|csv|html|xml/i)[0].toLowerCase());
    }

    // Look for time constraints
    const timeMatch = description.match(/(\d+)\s*(hour|day|week|minute)/i);
    if (timeMatch) {
      entities.constraints.push(`deadline: ${timeMatch[0]}`);
    }

    return entities;
  }
}

module.exports = ObjectiveClassifier;
