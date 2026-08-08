'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { AuditWriteError } = require('./memory-errors');

/**
 * Audit sink for memory operations.
 *
 * Every mutating memory operation records an audit event and waits for it to
 * land BEFORE the operation is acknowledged. If the sink fails, the memory
 * operation fails — an unauditable write is not performed.
 *
 * This is deliberately a narrow interface so it can be swapped for the
 * system-wide audit logger described in docs/AUTHORIZATION_AND_AUDIT.md
 * without touching the adapter.
 */
class AuditSink {
  async record(_event) {
    throw new Error('record() must be implemented');
  }
}

/** Append-only JSONL audit sink. */
class FileAuditSink extends AuditSink {
  constructor({ path: filePath }) {
    super();
    this.path = filePath;
  }

  async record(event) {
    const entry = {
      audit_event_id: crypto.randomUUID(),
      recorded_at: new Date().toISOString(),
      ...event
    };
    try {
      await fs.promises.mkdir(path.dirname(this.path), { recursive: true });
      await fs.promises.appendFile(this.path, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (err) {
      throw new AuditWriteError(`Audit write failed; memory operation refused: ${err.message}`, {
        cause: err.message
      });
    }
    return entry.audit_event_id;
  }

  async readAll() {
    try {
      const raw = await fs.promises.readFile(this.path, 'utf8');
      return raw
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }
}

/** In-memory sink for tests. Set `failNext` to simulate an audit outage. */
class InMemoryAuditSink extends AuditSink {
  constructor() {
    super();
    this.events = [];
    this.failNext = false;
  }

  async record(event) {
    if (this.failNext) {
      this.failNext = false;
      throw new AuditWriteError('Audit sink unavailable (simulated)');
    }
    const entry = {
      audit_event_id: crypto.randomUUID(),
      recorded_at: new Date().toISOString(),
      ...event
    };
    this.events.push(entry);
    return entry.audit_event_id;
  }

  async readAll() {
    return [...this.events];
  }
}

module.exports = { AuditSink, FileAuditSink, InMemoryAuditSink };
