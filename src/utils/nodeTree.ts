import { DialogNode } from '../types/models'

export function getNodePath(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null,
  targetNodeId: string
): DialogNode[] {
  if (!rootNodeId || !nodes[rootNodeId] || !nodes[targetNodeId]) {
    return []
  }
  
  if (rootNodeId === targetNodeId) {
    return [nodes[rootNodeId]]
  }
  
  const path: DialogNode[] = []
  const visited = new Set<string>()
  
  function dfs(nodeId: string): boolean {
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    
    const node = nodes[nodeId]
    if (!node) return false
    
    path.push(node)
    
    if (nodeId === targetNodeId) {
      return true
    }
    
    for (const childId of node.childNodeIds) {
      if (dfs(childId)) {
        return true
      }
    }
    
    path.pop()
    return false
  }
  
  if (dfs(rootNodeId)) {
    return path
  }
  
  return []
}

function findActualRootNode(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null
): string | null {
  if (rootNodeId && nodes[rootNodeId]) {
    return rootNodeId
  }
  
  for (const nodeId of Object.keys(nodes)) {
    const node = nodes[nodeId]
    if (node && node.parentNodeIds.length === 0) {
      return nodeId
    }
  }
  
  return null
}

export function getConversationHistory(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null,
  currentNodeId: string
): DialogNode[] {
  const actualRootNodeId = findActualRootNode(nodes, rootNodeId)
  return getNodePath(nodes, actualRootNodeId, currentNodeId)
}

export function getLastNPCCharacterId(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null,
  currentNodeId: string
): string | undefined {
  const history = getConversationHistory(nodes, rootNodeId, currentNodeId)
  
  for (let i = history.length - 1; i >= 0; i--) {
    const node = history[i]
    if (node.speaker === 'NPC' && node.characterId) {
      return node.characterId
    }
  }
  
  return undefined
}

export function generateNodeContext(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null,
  currentNodeId: string
): string {
  const history = getConversationHistory(nodes, rootNodeId, currentNodeId)
  
  if (history.length === 0) {
    return ''
  }

  const contextParts = history.map((node) => {
    const speaker = node.speaker === 'NPC' ? 'NPC' : 'Player'
    return `${speaker}: ${node.text}`
  })

  return contextParts.join('\n\n')
}

export function nodeTreeToLinearChat(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null
): DialogNode[] {
  if (!rootNodeId || !nodes[rootNodeId]) {
    return []
  }

  const chat: DialogNode[] = []
  const visited = new Set<string>()

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = nodes[nodeId]
    if (!node) return

    chat.push(node)

    if (node.childNodeIds.length > 0) {
      traverse(node.childNodeIds[0])
    }
  }

  traverse(rootNodeId)
  return chat
}
