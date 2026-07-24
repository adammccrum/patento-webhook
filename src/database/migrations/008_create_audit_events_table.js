/**
 * Migration: Create audit_events table with tamper-evident hash chain
 */

exports.up = function(knex) {
  return knex.schema.createTable('audit_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.bigInteger('sequence').notNullable().unique(); // Monotonic counter
    table.datetime('timestamp').notNullable();

    // Actor information
    table.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('actor_type', 50).notNullable(); // 'user', 'service_agent', 'system', 'security'
    table.string('actor_name', 255).nullable();

    // Event information
    table.string('agent', 255).nullable(); // Which agent executed (Alpha, Bravo, etc.)
    table.string('action', 255).notNullable();
    table.string('resource_type', 100).notNullable();
    table.string('resource_id', 255).nullable();

    // Authorization & Permission tracking
    table.string('permission_evaluated', 255).nullable();
    table.uuid('authorization_ref').nullable(); // Link to authorization if applicable
    table.boolean('authorization_approved').nullable();

    // Hash chain for tamper evidence
    table.string('prev_hash', 64).nullable(); // SHA256 hash of previous event
    table.string('event_hash', 64).notNullable(); // SHA256 hash of this event

    // Correlation and status
    table.string('correlation_id', 255).nullable(); // Link related events
    table.string('status', 50).notNullable(); // 'completed', 'failed', 'pending'
    table.json('details').defaultTo('{}'); // Event-specific details

    // Timestamps
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index('actor_id');
    table.index('actor_type');
    table.index('action');
    table.index('resource_type');
    table.index('resource_id');
    table.index('timestamp');
    table.index('status');
    table.index('correlation_id');
    table.index('event_hash');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('audit_events');
};
