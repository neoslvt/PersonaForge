import { DialogNode } from '../types/models'

/**
 * Finds the path from root to target node, following the correct branch.
 * When there are forks (multiple children), it follows the branch that leads to the target.
 */
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
  
  // Build a reverse map: child -> parents for efficient lookup
  const parentMap = new Map<string, string[]>()
  for (const [nodeId, node] of Object.entries(nodes)) {
    for (const childId of node.childNodeIds) {
      if (!parentMap.has(childId)) {
        parentMap.set(childId, [])
      }
      parentMap.get(childId)!.push(nodeId)
    }
  }
  
  // Build path backwards from target to root
  const path: DialogNode[] = []
  const visited = new Set<string>()
  
  function buildPathBackwards(nodeId: string): boolean {
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    
    const node = nodes[nodeId]
    if (!node) return false
    
    // Add current node to path (we'll reverse it later)
    path.push(node)
    
    if (nodeId === rootNodeId) {
      return true
    }
    
    // Get all parents of this node
    const parents = parentMap.get(nodeId) || []
    
    // Try each parent to find the path back to root
    for (const parentId of parents) {
      if (buildPathBackwards(parentId)) {
        return true
      }
    }
    
    // If no parent leads to root, backtrack
    path.pop()
    return false
  }
  
  if (buildPathBackwards(targetNodeId)) {
    // Reverse to get path from root to target
    return path.reverse()
  }
  
  // Fallback: try forward DFS if backward search fails
  const forwardPath: DialogNode[] = []
  const forwardVisited = new Set<string>()
  
  function dfs(nodeId: string): boolean {
    if (forwardVisited.has(nodeId)) return false
    forwardVisited.add(nodeId)
    
    const node = nodes[nodeId]
    if (!node) return false
    
    forwardPath.push(node)
    
    if (nodeId === targetNodeId) {
      return true
    }
    
    for (const childId of node.childNodeIds) {
      if (dfs(childId)) {
        return true
      }
    }
    
    forwardPath.pop()
    return false
  }
  
  if (dfs(rootNodeId)) {
    return forwardPath
  }
  
  return []
}

/**
 * Gets all nodes reachable from root to target, including special nodes.
 * Special nodes (setVariable, changeVariable, sceneDescription, etc.) are
 * treated as "parallel branches" - they affect state but are separate from
 * the conversation flow. This function:
 * 1. Finds the conversation path (dialog nodes only)
 * 2. Includes all special nodes connected to nodes on that path
 */
export function getAllReachableNodes(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null,
  targetNodeId: string
): DialogNode[] {
  if (!rootNodeId || !nodes[rootNodeId] || !nodes[targetNodeId]) {
    return []
  }
  
  // First, get the conversation path (following dialog flow)
  const conversationPath = getConversationHistory(nodes, rootNodeId, targetNodeId)
  const result: DialogNode[] = []
  const included = new Set<string>()
  
  // Helper to check if a node is a special/metadata node
  function isSpecialNode(node: DialogNode): boolean {
    return node.type !== undefined && node.type !== 'dialog'
  }
  
  // Add all nodes from conversation path
  for (const node of conversationPath) {
    if (!included.has(node.id)) {
      result.push(node)
      included.add(node.id)
    }
  }
  
  // Now, for each node in the conversation path, include all special nodes
  // that are connected to it (as children or parents)
  for (const pathNode of conversationPath) {
    // Include special nodes that are children of this node
    for (const childId of pathNode.childNodeIds) {
      const childNode = nodes[childId]
      if (childNode && isSpecialNode(childNode) && !included.has(childId)) {
        result.push(childNode)
        included.add(childId)
        
        // Also include special nodes connected to this special node
        for (const specialChildId of childNode.childNodeIds) {
          const specialChild = nodes[specialChildId]
          if (specialChild && isSpecialNode(specialChild) && !included.has(specialChildId)) {
            result.push(specialChild)
            included.add(specialChildId)
          }
        }
      }
    }
    
    // Include special nodes that are parents of this node
    for (const parentId of pathNode.parentNodeIds) {
      const parentNode = nodes[parentId]
      if (parentNode && isSpecialNode(parentNode) && !included.has(parentId)) {
        result.push(parentNode)
        included.add(parentId)
      }
    }
  }
  
  // Sort result to maintain order: conversation path nodes first, then special nodes
  // in the order they appear along the path
  const orderedResult: DialogNode[] = []
  const pathNodeIds = new Set(conversationPath.map(n => n.id))
  
  // Add conversation path nodes in order
  for (const node of conversationPath) {
    orderedResult.push(node)
  }
  
  // Add special nodes in the order they appear relative to the path
  for (const pathNode of conversationPath) {
    // Add special node children after this path node
    for (const childId of pathNode.childNodeIds) {
      const childNode = nodes[childId]
      if (childNode && isSpecialNode(childNode) && !pathNodeIds.has(childId)) {
        if (!orderedResult.find(n => n.id === childId)) {
          orderedResult.push(childNode)
        }
      }
    }
  }
  
  return orderedResult
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

/**
 * Gets conversation history - only dialog nodes (NPC/player), skipping special nodes.
 * Special nodes are treated as parallel branches and don't interrupt conversation flow.
 */
export function getConversationHistory(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null,
  currentNodeId: string
): DialogNode[] {
  const actualRootNodeId = findActualRootNode(nodes, rootNodeId)
  const fullPath = getNodePath(nodes, actualRootNodeId, currentNodeId)
  
  // Filter to only include dialog nodes (NPC/player), skip special nodes
  // Special nodes are processed separately for their effects
  return fullPath.filter(node => {
    const nodeType = node.type || 'dialog'
    return nodeType === 'dialog' || (!node.type && (node.speaker === 'NPC' || node.speaker === 'player'))
  })
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

/**
 * Calculates variable values by traversing the node path from root to target.
 * Special nodes (setVariable, changeVariable, sceneDescription, etc.) are processed
 * for their effects but are treated as "pass-through" nodes - they don't block the path.
 * Only includes variables from nodes on the path to the current node.
 * If there's a fork (multiple branches), only variables from the branch leading
 * to the current node are included, using values from before the fork for variables
 * not set on the current branch.
 */
export function calculateVariables(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null,
  currentNodeId: string
): Record<string, string | number> {
  // Get all nodes reachable from root to current, including special nodes
  const allReachableNodes = getAllReachableNodes(nodes, rootNodeId, currentNodeId)
  const variables: Record<string, string | number> = {}
  
  // Process all reachable nodes in order (special nodes are included)
  for (const node of allReachableNodes) {
    if (node.type === 'setVariable' && node.variableName) {
      if (node.variableValue !== undefined) {
        variables[node.variableName] = node.variableValue
      }
    } else if (node.type === 'changeVariable' && node.variableName) {
      const currentValue = variables[node.variableName]
      const changeValue = node.variableValue || 0
      
      if (typeof currentValue === 'number' && typeof changeValue === 'number') {
        if (node.variableOperation === 'subtract') {
          variables[node.variableName] = currentValue - changeValue
        } else {
          variables[node.variableName] = currentValue + changeValue
        }
      } else if (currentValue === undefined) {
        // Variable doesn't exist yet, treat as 0
        if (node.variableOperation === 'subtract') {
          variables[node.variableName] = -changeValue
        } else {
          variables[node.variableName] = changeValue
        }
      }
    }
  }
  
  return variables
}

/**
 * Collects all scene descriptions from nodes reachable from root to target.
 * Special nodes are treated as "pass-through" - they're processed for their effects
 * but don't block the path. Only includes scene descriptions from nodes reachable
 * on the path to the current node. If there's a fork, only descriptions from the
 * branch leading to the current node are included.
 */
export function collectSceneDescriptions(
  nodes: Record<string, DialogNode>,
  rootNodeId: string | null,
  currentNodeId: string
): string[] {
  // Get all nodes reachable from root to current, including special nodes
  const allReachableNodes = getAllReachableNodes(nodes, rootNodeId, currentNodeId)
  const descriptions: string[] = []
  
  // Collect scene descriptions from all reachable nodes
  for (const node of allReachableNodes) {
    if (node.type === 'sceneDescription' && node.text) {
      descriptions.push(node.text)
    }
  }
  
  return descriptions
}
