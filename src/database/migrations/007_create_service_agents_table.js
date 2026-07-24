/**
 * Migration: Create service_agents table
 * Service agents are machine identities used for API access and orchestration
 */

exports.up = function(knex) {
  return knex.schema.createTable('service_agents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('agent_code', 2).unique().notNullable();
    table.string('agent_name', 100).notNullable();
    table.string('api_key_hash', 255).notNullable().unique();
    table.json('scopes').defaultTo('[]');
    table.boolean('is_active').defaultTo(true);
    table.datetime('last_used_at').nullable();
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('revoked_at').nullable();

    table.index('agent_code');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('service_agents');
};
