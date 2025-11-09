// Role-based permission mapping
// '*' means all destructive actions
export const roleMatrix = {
  viewer: [],
  operator: ['createTicket'],
  engineer: [
    'createTicket',
    'createS3Bucket','destroyS3Bucket',
    'createEC2','destroyEC2',
    'createLambda','destroyLambda'
  ],
  admin: ['*']
};

export function canPerform(role, tool) {
  if (!role) return false;
  const allowed = roleMatrix[role] || [];
  return allowed.includes('*') || allowed.includes(tool);
}

// Tools considered destructive (confirmation & permission required)
export const destructiveTools = [
  'createS3Bucket','destroyS3Bucket',
  'createEC2','destroyEC2',
  'createLambda','destroyLambda',
  'createTicket'
];
