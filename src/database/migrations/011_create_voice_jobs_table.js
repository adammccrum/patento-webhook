/**
 * Migration: Create voice_jobs and voice_outputs tables
 * Persistent storage for Echo agent voice operations
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('voice_jobs', (table) => {
      table.uuid('id').primary();
      table.uuid('job_id').notNullable().unique();
      table.uuid('task_id').notNullable();
      table.uuid('objective_id').notNullable();
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('audit_reference').nullable();
      table.string('operation', 50).notNullable(); // text_to_speech, speech_to_text, audio_metadata, voice_preview
      table.string('status', 50).notNullable(); // started, processing, completed, failed, cancelled
      table.string('provider_id', 100).nullable();
      table.integer('retry_count').defaultTo(0);
      table.integer('max_retries').defaultTo(3);
      table.string('language', 10).nullable();
      table.string('output_format', 10).nullable();
      table.integer('sample_rate').nullable();
      table.string('privacy_classification', 50).notNullable().defaultTo('internal');
      table.json('retention_policy').defaultTo('{}');
      table.text('input_text').nullable();
      table.string('input_reference', 500).nullable();
      table.integer('duration_ms').nullable();
      table.text('error').nullable();
      table.string('error_code', 50).nullable();
      table.json('warnings').defaultTo('[]');
      table.datetime('created_at').notNullable();
      table.datetime('started_at').nullable();
      table.datetime('completed_at').nullable();
      table.datetime('expires_at').nullable(); // Based on retention policy

      table.index('user_id');
      table.index('job_id');
      table.index('status');
      table.index('operation');
      table.index('provider_id');
      table.index('expires_at');
    })
    .createTable('voice_outputs', (table) => {
      table.uuid('id').primary();
      table.uuid('job_id').notNullable().unique().references('job_id').inTable('voice_jobs').onDelete('CASCADE');
      table.string('output_reference', 500).notNullable(); // File path or URL
      table.string('output_format', 10).notNullable();
      table.bigInteger('file_size').nullable();
      table.integer('duration_seconds').nullable();
      table.integer('sample_rate').nullable();
      table.string('mime_type', 100).nullable();
      table.text('transcript').nullable(); // For STT results
      table.decimal('confidence', 5, 2).nullable(); // For STT confidence (0-1)
      table.string('file_hash', 64).nullable(); // SHA256 for integrity verification
      table.boolean('is_public').defaultTo(false);
      table.datetime('expires_at').notNullable();
      table.datetime('created_at').notNullable();
      table.datetime('accessed_at').nullable();
      table.datetime('deleted_at').nullable();

      table.index('job_id');
      table.index('output_reference');
      table.index('expires_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('voice_outputs')
    .dropTableIfExists('voice_jobs');
};
