/**
 * Seed: Create default permissions and assign to roles
 * Runs after role seed to create permission matrix
 */

exports.seed = async function(knex) {
  // Delete existing permissions (for idempotency)
  await knex('role_permissions').delete();
  await knex('permissions').where('is_builtin', true).delete();

  const permissions = [
    // Objective permissions
    { action: 'objective:create', resource: 'objective', description: 'Create new objectives', is_builtin: true },
    { action: 'objective:view', resource: 'objective', description: 'View objectives', is_builtin: true },
    { action: 'objective:update', resource: 'objective', description: 'Update objective details', is_builtin: true },
    { action: 'objective:pause', resource: 'objective', description: 'Pause objective execution', is_builtin: true },
    { action: 'objective:resume', resource: 'objective', description: 'Resume paused objective', is_builtin: true },
    { action: 'objective:cancel', resource: 'objective', description: 'Cancel objective', is_builtin: true },
    { action: 'objective:delete', resource: 'objective', description: 'Delete objective', is_builtin: true },

    // Task permissions
    { action: 'task:create', resource: 'task', description: 'Create new tasks', is_builtin: true },
    { action: 'task:view', resource: 'task', description: 'View tasks', is_builtin: true },
    { action: 'task:update', resource: 'task', description: 'Update task details', is_builtin: true },
    { action: 'task:retry', resource: 'task', description: 'Retry failed task', is_builtin: true },
    { action: 'task:delete', resource: 'task', description: 'Delete task', is_builtin: true },
    { action: 'task:execute', resource: 'task', description: 'Execute task (service agents only)', is_builtin: true },

    // Agent permissions
    { action: 'agent:view', resource: 'agent', description: 'View agent status and capabilities', is_builtin: true },
    { action: 'agent:manage', resource: 'agent', description: 'Manage agent configuration', is_builtin: true },
    { action: 'agent:report_status', resource: 'agent', description: 'Report agent status (service agents only)', is_builtin: true },

    // Authorization permissions
    { action: 'authorization:view', resource: 'authorization', description: 'View authorization requests', is_builtin: true },
    { action: 'authorization:approve', resource: 'authorization', description: 'Approve authorization requests', is_builtin: true },
    { action: 'authorization:deny', resource: 'authorization', description: 'Deny authorization requests', is_builtin: true },
    { action: 'authorization:revoke', resource: 'authorization', description: 'Revoke previous authorizations', is_builtin: true },

    // Audit permissions
    { action: 'audit:view', resource: 'audit', description: 'View audit logs', is_builtin: true },
    { action: 'audit:export', resource: 'audit', description: 'Export audit logs', is_builtin: true },

    // Provider permissions
    { action: 'provider:manage', resource: 'provider', description: 'Manage external providers', is_builtin: true },

    // System permissions
    { action: 'system:admin', resource: 'system', description: 'System administration access', is_builtin: true }
  ];

  await knex('permissions').insert(permissions);

  // Get all permissions
  const allPerms = await knex('permissions');
  const permsByAction = {};
  allPerms.forEach(p => {
    permsByAction[p.action] = p.id;
  });

  // Get all roles
  const allRoles = await knex('roles');
  const rolesByName = {};
  allRoles.forEach(r => {
    rolesByName[r.name] = r.id;
  });

  // Define permission matrix for each role
  const rolePermissions = [
    // Administrator - has most permissions except owner-only ones
    {
      roleId: rolesByName.administrator,
      permissions: [
        'objective:create', 'objective:view', 'objective:update', 'objective:pause', 'objective:resume', 'objective:cancel', 'objective:delete',
        'task:create', 'task:view', 'task:update', 'task:retry', 'task:delete',
        'agent:view', 'agent:manage',
        'authorization:view', 'authorization:approve', 'authorization:deny', 'authorization:revoke',
        'audit:view', 'audit:export',
        'provider:manage',
        'system:admin'
      ]
    },
    // Operator - can execute objectives and approve authorizations
    {
      roleId: rolesByName.operator,
      permissions: [
        'objective:view', 'objective:pause', 'objective:resume', 'objective:cancel',
        'task:view', 'task:retry',
        'agent:view',
        'authorization:view', 'authorization:approve', 'authorization:deny'
      ]
    },
    // Reviewer - view-only with audit access
    {
      roleId: rolesByName.reviewer,
      permissions: [
        'objective:view',
        'task:view',
        'agent:view',
        'authorization:view',
        'audit:view'
      ]
    },
    // Viewer - limited view-only access
    {
      roleId: rolesByName.viewer,
      permissions: [
        'objective:view',
        'task:view',
        'agent:view'
      ]
    },
    // Service Agent - can execute tasks and report status
    {
      roleId: rolesByName.service_agent,
      permissions: [
        'task:execute',
        'agent:report_status',
        'objective:view'
      ]
    }
  ];

  // Insert role_permissions associations
  for (const rp of rolePermissions) {
    const rows = rp.permissions.map(action => ({
      role_id: rp.roleId,
      permission_id: permsByAction[action]
    }));
    await knex('role_permissions').insert(rows);
  }

  // Owner role has no explicit permissions (implicit all)
};
