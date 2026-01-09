import { Dialog, DialogNode, Character, NodeType } from '../types/models'

export function createNewDialog(characterId?: string): Dialog {
  return {
    id: `dialog_${Date.now()}`,
    characterId,
    rootNodeId: null,
    nodes: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function createDialogNode(
  speaker: 'NPC' | 'player',
  text: string,
  parentNodeIds: string[] = []
): DialogNode {
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    speaker,
    text,
    childNodeIds: [],
    parentNodeIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function generateUniqueId(prefix: string = ''): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function createSpecialNode(nodeType: NodeType, parentNodeIds: string[] = []): DialogNode {
  const baseNode: DialogNode = {
    id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: nodeType,
    speaker: 'NPC', // Default speaker, may not be used for all node types
    text: '',
    childNodeIds: [],
    parentNodeIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Set default values based on node type
  switch (nodeType) {
    case 'setVariable':
      return { ...baseNode, variableOperation: 'set' }
    case 'changeVariable':
      return { ...baseNode, variableOperation: 'add', variableValue: 0 }
    case 'ifStatement':
      return { ...baseNode, conditionOperator: '==' }
    case 'switchCase':
      return { ...baseNode, cases: [] }
    case 'sceneDescription':
      return { ...baseNode, text: '' }
    default:
      return baseNode
  }
}

