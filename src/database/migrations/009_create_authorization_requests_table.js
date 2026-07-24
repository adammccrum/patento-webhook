/**
 * Migration: Create authorization_requests table
 * Tracks high-impact action approvals and denials
 */

exports.up = function(knex) {
  return knex.schema.createTable('authorization_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('action', 255).notNullable();
    table.string('agent', 255).notNullable();
    table.string('risk_level', 50).notNullable(); // 'high', 'medium', 'low'
    table.string('status', 50).notNullable(); // 'pending', 'approved', 'denied'
    table.text('reason').nullable();

    // Requestor information
    table.uuid('requester_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('requester_name', 255).nullable();

    // Approval information
    table.uuid('approver_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('approver_name', 255).nullable();
    table.text('decision_reason').nullable();
    table.string('approval_proof', 500).nullable(); // Signature or biometric proof reference

    // Constraint information
    table.boolean('approval_required').defaultTo(false);
    table.integer('approval_levels').defaultTo(0);
    table.boolean('escalation_required').defaultTo(false);
    table.integer('auth_assurance_level').defaultTo(0); // 1-5 scale

    // Timestamps
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('decided_at').nullable();
    table.datetime('expires_at').nullable();

    // Indexes
    table.index('status');
    table.index('action');
    table.index('requester_id');
    table.index('risk_level');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('authorization_requests');
};
