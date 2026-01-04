import { Dialog, DialogNode, Character } from '../types/models'

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

