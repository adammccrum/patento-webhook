'use strict';

const ProviderAdapter = require('../../adapter-base');

/**
 * Contract every memory engine must satisfy.
 * See docs/MEMORY_PROVIDER_SPECIFICATION.md
 *
 * `context` carries caller identity, permissions and audit correlation id.
 * No method may be called without one.
 */
class MemoryAdapter extends ProviderAdapter {
  constructor(config = {}) {
    super({ ...config, category: 'memory' });
    this.category = 'memory';
    /** Adapters that can send content off the machine must set this true. */
    this.external = false;
  }

  // ---- Write (always explicit, always audited) ----

  async write(_record, _context) {
    throw new Error('write() not implemented');
  }

  async propose(_record, _context) {
    throw new Error('propose() not implemented');
  }

  // ---- Read ----

  async read(_query, _context) {
    throw new Error('read() not implemented');
  }

  async search(_query, _context) {
    throw new Error('search() not implemented');
  }

  // ---- Correction, deletion, expiry ----

  async correct(_id, _newRecord, _context) {
    throw new Error('correct() not implemented');
  }

  async delete(_id, _options, _context) {
    throw new Error('delete() not implemented');
  }

  async expire(_id, _expiresAt, _context) {
    throw new Error('expire() not implemented');
  }

  async purgeSubject(_subjectId, _context) {
    throw new Error('purgeSubject() not implemented');
  }

  // ---- Transparency ----

  async getProvenance(_id, _context) {
    throw new Error('getProvenance() not implemented');
  }

  async export(_subjectId, _context) {
    throw new Error('export() not implemented');
  }
}

module.exports = MemoryAdapter;
