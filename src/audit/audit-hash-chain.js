/**
 * Audit Hash Chain - Ensures integrity of audit events through cryptographic hashing
 * Implements SHA256-based hash chain to detect tampering
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Generate deterministic canonical JSON string for consistent hashing
 */
function canonicalEventString(event) {
  // Create a canonical representation of the event for hashing
  const canonical = {
    id: event.id,
    timestamp: event.timestamp,
    actor_id: event.actor_id,
    actor_type: event.actor_type,
    action: event.action,
    resource_type: event.resource_type,
    resource_id: event.resource_id,
    permission: event.permission,
    status: event.status,
    details: event.details
  };

  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

/**
 * Generate SHA256 hash of event + previous hash
 */
function generateEventHash(event, prevHash = null) {
  try {
    const eventStr = canonicalEventString(event);
    const hashInput = prevHash ? `${eventStr}${prevHash}` : eventStr;

    const hash = crypto
      .createHash('sha256')
      .update(hashInput)
      .digest('hex');

    return hash;
  } catch (error) {
    logger.error(`Error generating event hash: ${error.message}`);
    throw error;
  }
}

/**
 * Verify integrity of event hash
 */
function verifyEventHash(event, expectedHash) {
  try {
    if (!event.prev_hash && !event.event_hash) {
      // Events without hashes can't be verified (legacy or unset)
      return { valid: false, reason: 'Event missing hash fields' };
    }

    if (!expectedHash && !event.event_hash) {
      return { valid: false, reason: 'No hash to verify against' };
    }

    const calculateHash = generateEventHash(event, event.prev_hash);
    const actualHash = expectedHash || event.event_hash;

    if (calculateHash !== actualHash) {
      return {
        valid: false,
        reason: 'Hash mismatch - possible tampering',
        expectedHash: actualHash,
        calculatedHash: calculateHash
      };
    }

    return { valid: true };
  } catch (error) {
    logger.error(`Error verifying event hash: ${error.message}`);
    return { valid: false, reason: error.message };
  }
}

/**
 * Verify entire hash chain from start to end
 */
async function verifyHashChain(events) {
  try {
    if (!events || events.length === 0) {
      return { valid: true, count: 0 };
    }

    let previousHash = null;
    const failures = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Verify this event's hash
      const eventHash = generateEventHash(event, event.prev_hash);
      const storedHash = event.event_hash;

      if (storedHash && eventHash !== storedHash) {
        failures.push({
          index: i,
          eventId: event.id,
          reason: 'Event hash mismatch',
          expectedHash: storedHash,
          calculatedHash: eventHash
        });
      }

      // Verify chain link (this event's prev_hash should match previous event's hash)
      if (i > 0) {
        if (event.prev_hash !== previousHash) {
          failures.push({
            index: i,
            eventId: event.id,
            reason: 'Chain broken - previous hash mismatch',
            expectedPrevHash: previousHash,
            actualPrevHash: event.prev_hash
          });
        }
      }

      previousHash = storedHash;
    }

    if (failures.length > 0) {
      logger.warn(`Hash chain verification found ${failures.length} failures`);
      return {
        valid: false,
        count: events.length,
        failures
      };
    }

    return { valid: true, count: events.length };
  } catch (error) {
    logger.error(`Error verifying hash chain: ${error.message}`);
    return {
      valid: false,
      reason: error.message
    };
  }
}

/**
 * Prepare audit event with hash fields
 * Should be called before inserting event into database
 */
function prepareAuditEvent(event, previousEvent = null) {
  const prevHash = previousEvent?.event_hash || null;
  const eventHash = generateEventHash(event, prevHash);

  return {
    ...event,
    prev_hash: prevHash,
    event_hash: eventHash
  };
}

/**
 * Get hash chain statistics
 */
async function getHashChainStats(db) {
  try {
    if (!db) {
      return { chainLength: 0, verified: false };
    }

    const count = await db('audit_events').count('* as total').first();
    const lastEvent = await db('audit_events')
      .orderBy('sequence', 'desc')
      .first();

    return {
      chainLength: count?.total || 0,
      lastEventId: lastEvent?.id,
      lastEventHash: lastEvent?.event_hash,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error(`Error getting hash chain stats: ${error.message}`);
    return { chainLength: 0, error: error.message };
  }
}

/**
 * Report tampering detection
 */
function reportTampering(event, expectedHash, actualHash) {
  logger.error('🚨 AUDIT TAMPERING DETECTED 🚨');
  logger.error(`Event ID: ${event.id}`);
  logger.error(`Expected Hash: ${expectedHash}`);
  logger.error(`Actual Hash: ${actualHash}`);
  logger.error('This indicates the audit event has been modified after insertion.');
  logger.error('Immediate investigation required.');

  return {
    tampered: true,
    eventId: event.id,
    expectedHash,
    actualHash,
    detectedAt: new Date()
  };
}

module.exports = {
  canonicalEventString,
  generateEventHash,
  verifyEventHash,
  verifyHashChain,
  prepareAuditEvent,
  getHashChainStats,
  reportTampering
};
