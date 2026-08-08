'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Append-only JSONL journal with real erasure.
 *
 * Append-only gives correction-by-supersede and a replayable history for free.
 * It also conflicts with erasure, so `hardRemove()` rewrites the journal
 * without the erased content and appends a contentless tombstone. Erasure
 * beats append-only — requirement 5 is not negotiable against a storage
 * convenience.
 *
 * The backend is deliberately behind this small interface. Swapping JSONL for
 * SQLite later is one file, no adapter change. JSONL is the default because it
 * needs no native module and no dependency.
 */
class JournalStore {
  constructor({ path: filePath }) {
    this.path = filePath;
    this.events = [];
    this.loaded = false;
  }

  async load() {
    try {
      const raw = await fs.promises.readFile(this.path, 'utf8');
      this.events = raw
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.events = [];
    }
    this.loaded = true;
    return this.events.length;
  }

  async append(event) {
    if (!this.loaded) await this.load();
    this.events.push(event);
    await fs.promises.mkdir(path.dirname(this.path), { recursive: true });
    await fs.promises.appendFile(this.path, `${JSON.stringify(event)}\n`, 'utf8');
    return event;
  }

  /**
   * Physically remove every event matching `predicate` and rewrite the journal.
   * Returns the number of events removed.
   */
  async hardRemove(predicate, tombstone) {
    if (!this.loaded) await this.load();

    const kept = this.events.filter((e) => !predicate(e));
    const removed = this.events.length - kept.length;

    if (tombstone) kept.push(tombstone);
    this.events = kept;

    await fs.promises.mkdir(path.dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${process.pid}.tmp`;
    const body = kept.map((e) => `${JSON.stringify(e)}\n`).join('');
    await fs.promises.writeFile(tmp, body, 'utf8');
    await fs.promises.rename(tmp, this.path);

    return removed;
  }

  /** Replay the journal into current record state. */
  materialise() {
    const records = new Map();

    for (const event of this.events) {
      switch (event.op) {
        case 'write':
          records.set(event.record.id, { ...event.record });
          break;

        case 'correct': {
          const previous = records.get(event.supersedes);
          if (previous) {
            previous.superseded_by = event.record.id;
            records.set(previous.id, previous);
          }
          records.set(event.record.id, { ...event.record });
          break;
        }

        case 'delete': {
          const record = records.get(event.id);
          if (record) {
            if (event.hard) {
              records.delete(event.id);
            } else {
              record.deleted_at = event.at;
              records.set(record.id, record);
            }
          }
          break;
        }

        case 'expire': {
          const record = records.get(event.id);
          if (record) {
            record.expires_at = event.expires_at;
            records.set(record.id, record);
          }
          break;
        }

        case 'verify': {
          const record = records.get(event.id);
          if (record) {
            record.trust = {
              level: event.level,
              verified_by: event.verified_by,
              verified_at: event.at
            };
            records.set(record.id, record);
          }
          break;
        }

        case 'erased':
          // Contentless tombstone. Nothing to apply — the events it refers to
          // were physically removed from the journal.
          break;

        default:
          break;
      }
    }

    return records;
  }
}

module.exports = { JournalStore };
