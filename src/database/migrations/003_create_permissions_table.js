/**
 * Migration: Create permissions table
 */

exports.up = function(knex) {
  return knex.schema.createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('action', 100).notNullable();
    table.string('resource', 100).notNullable();
    table.text('description').nullable();
    table.boolean('is_builtin').defaultTo(false);
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['action', 'resource']);
    table.index('action');
    table.index('resource');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('permissions');
};
