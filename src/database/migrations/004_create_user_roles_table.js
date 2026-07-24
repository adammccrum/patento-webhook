/**
 * Migration: Create user_roles junction table
 */

exports.up = function(knex) {
  return knex.schema.createTable('user_roles', (table) => {
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    table.datetime('assigned_at').notNullable().defaultTo(knex.fn.now());

    table.primary(['user_id', 'role_id']);
    table.index('user_id');
    table.index('role_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_roles');
};
