/**
 * Seed: Create default roles
 * Runs after all migrations to populate built-in roles
 */

exports.seed = async function(knex) {
  // Delete existing built-in roles (for idempotency)
  await knex('user_roles').whereIn('role_id',
    knex('roles').where('is_builtin', true).select('id')
  ).delete();

  await knex('role_permissions').whereIn('role_id',
    knex('roles').where('is_builtin', true).select('id')
  ).delete();

  await knex('roles').where('is_builtin', true).delete();

  // Insert built-in roles
  const roles = [
    {
      name: 'owner',
      description: 'Full system access, implicit all permissions',
      is_builtin: true
    },
    {
      name: 'administrator',
      description: 'Manage users, roles, system configuration',
      is_builtin: true
    },
    {
      name: 'operator',
      description: 'Execute and monitor objectives, approve authorizations',
      is_builtin: true
    },
    {
      name: 'reviewer',
      description: 'View-only access to objectives, tasks, and audit logs',
      is_builtin: true
    },
    {
      name: 'viewer',
      description: 'Limited view-only access to objectives and tasks',
      is_builtin: true
    },
    {
      name: 'service_agent',
      description: 'Machine identity for service agents',
      is_builtin: true
    }
  ];

  await knex('roles').insert(roles);
};
