/**
 * Migration: Create objectives, tasks, subtasks and agent_state tables
 * Persistent storage for orchestration state
 */

exports.up = function(knex) {
  return knex.schema
    .createTable('objectives', (table) => {
      table.uuid('id').primary();
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.text('description').notNullable();
      table.string('type', 100).nullable();
      table.string('status', 50).notNullable();
      table.json('details').defaultTo('{}');
      table.datetime('created_at').notNullable();
      table.datetime('updated_at').notNullable();
      table.datetime('completed_at').nullable();

      table.index('user_id');
      table.index('status');
    })
    .createTable('tasks', (table) => {
      table.uuid('id').primary();
      table.uuid('objective_id').notNullable().references('id').inTable('objectives').onDelete('CASCADE');
      table.string('title', 255).notNullable();
      table.text('description').nullable();
      table.string('agent_code', 2).nullable();
      table.string('status', 50).notNullable();
      table.json('details').defaultTo('{}');
      table.datetime('created_at').notNullable();
      table.datetime('updated_at').notNullable();
      table.datetime('completed_at').nullable();

      table.index('objective_id');
      table.index('status');
      table.index('agent_code');
    })
    .createTable('subtasks', (table) => {
      table.uuid('id').primary();
      table.uuid('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
      table.string('title', 255).notNullable();
      table.text('description').nullable();
      table.string('agent_code', 2).notNullable();
      table.string('capability_required', 255).notNullable();
      table.string('status', 50).notNullable();
      table.integer('retry_count').defaultTo(0);
      table.integer('max_retries').defaultTo(3);
      table.json('dependencies').defaultTo('[]');
      table.json('input').defaultTo('{}');
      table.json('output').defaultTo('{}');
      table.datetime('created_at').notNullable();
      table.datetime('updated_at').notNullable();
      table.datetime('completed_at').nullable();

      table.index('task_id');
      table.index('status');
      table.index('agent_code');
    })
    .createTable('agent_state', (table) => {
      table.string('agent_code', 2).primary();
      table.string('status', 50).notNullable();
      table.uuid('current_task_id').nullable();
      table.string('current_action', 255).nullable();
      table.datetime('last_heartbeat').notNullable();
      table.json('capabilities').defaultTo('[]');
      table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());

      table.index('status');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('agent_state')
    .dropTableIfExists('subtasks')
    .dropTableIfExists('tasks')
    .dropTableIfExists('objectives');
};
