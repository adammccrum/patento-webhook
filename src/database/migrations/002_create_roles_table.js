/**
 * Migration: Create roles table
 */

exports.up = function(knex) {
  return knex.schema.createTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).unique().notNullable();
    table.text('description').nullable();
    table.boolean('is_builtin').defaultTo(false);
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('name');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('roles');
};
