export const DEFAULT_NODE_TYPES = [
  { id: 'person', label: 'Person', color: '#3498db' },
  { id: 'company', label: 'Company', color: '#e74c3c' },
  { id: 'project', label: 'Project', color: '#2ecc71' },
  { id: 'skill', label: 'Skill', color: '#f39c12' },
  { id: 'department', label: 'Department', color: '#9b59b6' },
  { id: 'technology', label: 'Technology', color: '#f39c12' },
  { id: 'team', label: 'Team', color: '#1abc9c' },
  { id: 'product', label: 'Product', color: '#34495e' },
  { id: 'service', label: 'Service', color: '#95a5a6' },
  { id: 'location', label: 'Location', color: '#e67e22' },
  { id: 'unknown', label: 'Unknown', color: '#cccccc' }
];

export const DEFAULT_EDGE_TYPES = [
  { id: 'works_for', label: 'Works For' },
  { id: 'participates_in', label: 'Participates In' },
  { id: 'has_skill', label: 'Has Skill' },
  { id: 'belongs_to', label: 'Belongs To' },
  { id: 'uses_technology', label: 'Uses Technology' },
  { id: 'utilizes', label: 'Utilizes' },
  { id: 'part_of', label: 'Part Of' },
  { id: 'collaborates_with', label: 'Collaborates With' },
  { id: 'unknown', label: 'Unknown' }
];

export const validateId = (id, existingTypes, editingId = null) => {
  if (!id.trim()) {
    return 'Please enter an ID.';
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
    return 'ID must start with a letter or underscore, and contain only letters, numbers, and underscores.';
  }
  if (existingTypes.some(type => type.id === id && type.id !== editingId)) {
    return 'This ID already exists.';
  }
  return null;
};

export const generateRandomColor = () => {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
};
