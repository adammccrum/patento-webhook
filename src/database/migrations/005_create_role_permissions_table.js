/**
 * Migration: Create role_permissions junction table
 */

exports.up = function(knex) {
  return knex.schema.createTable('role_permissions', (table) => {
    table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    table.uuid('permission_id').notNullable().references('id').inTable('permissions').onDelete('CASCADE');
    table.datetime('assigned_at').notNullable().defaultTo(knex.fn.now());

    table.primary(['role_id', 'permission_id']);
    table.index('role_id');
    table.index('permission_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('role_permissions');
};
