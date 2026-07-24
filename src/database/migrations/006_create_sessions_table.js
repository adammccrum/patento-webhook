/**
 * Migration: Create sessions table
 */

exports.up = function(knex) {
  return knex.schema.createTable('sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_hash', 255).notNullable().unique();
    table.string('ip_address', 45).nullable();
    table.string('user_agent', 500).nullable();
    table.datetime('expires_at').notNullable();
    table.datetime('revoked_at').nullable();
    table.text('revocation_reason').nullable();
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('expires_at');
    table.index('revoked_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sessions');
};
