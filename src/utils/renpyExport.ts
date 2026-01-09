import { Dialog, DialogNode, Character, Scene } from '../types/models'

/**
 * Converts a character name to a valid RenPy variable name
 */
function sanitizeVariableName(name: string): string {
  // Convert to lowercase, replace spaces and special chars with underscores
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&') // Variables can't start with numbers
    .replace(/_+/g, '_') // Replace multiple underscores with one
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    || 'character' // Fallback if name becomes empty
}

/**
 * Escapes quotes in dialog text for RenPy
 */
function escapeText(text: string): string {
  return text.replace(/"/g, '\\"').replace(/\n/g, ' ')
}

/**
 * Generates a valid RenPy label name from a node ID
 */
function generateLabelName(nodeId: string, index: number = 0): string {
  // Use node_ prefix and sanitize the ID
  const baseName = `node_${nodeId.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`
  // If index is provided, append it to ensure uniqueness
  return index > 0 ? `${baseName}_${index}` : baseName
}

/**
 * Converts a Dialog tree to RenPy script format
 */
export function exportToRenPy(
  dialog: Dialog,
  characters: Record<string, Character>,
  scenes: Record<string, Scene>
): string {
  const lines: string[] = []
  
  // Header comment
  lines.push('# The script of the game goes in this file.')
  lines.push('')
  lines.push('')
  
  // Character definitions
  const characterMap = new Map<string, string>() // characterId -> variableName
  
  // Add characters used in the dialog
  const usedCharacterIds = new Set<string>()
  Object.values(dialog.nodes).forEach((node) => {
    if (node.characterId && node.speaker === 'NPC') {
      usedCharacterIds.add(node.characterId)
    }
  })
  
  if (usedCharacterIds.size > 0) {
    lines.push('# Declare characters used by this game. The color argument colorizes the')
    lines.push('# name of the character.')
    lines.push('')
    
    usedCharacterIds.forEach((charId) => {
      const character = characters[charId]
      if (character) {
        const varName = sanitizeVariableName(character.name)
        characterMap.set(charId, varName)
        lines.push(`define ${varName} = Character("${escapeText(character.name)}")`)
      }
    })
    
    lines.push('')
  }
  
  // Collect all variables used in the dialog tree
  const usedVariables = new Set<string>()
  
  // First pass: collect variables from setVariable nodes and if statements
  function collectVariables(nodeId: string, visited: Set<string>) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    
    const node = dialog.nodes[nodeId]
    if (!node) return
    
    const nodeType = node.type || 'dialog'
    
    // Collect from setVariable nodes
    if (nodeType === 'setVariable' && node.variableName) {
      const varName = sanitizeVariableName(node.variableName)
      usedVariables.add(varName)
    }
    
    // Collect from if statements
    if (nodeType === 'ifStatement' && node.conditionVariable) {
      const varName = sanitizeVariableName(node.conditionVariable)
      usedVariables.add(varName)
    }
    
    // Collect from switch case statements
    if (nodeType === 'switchCase' && node.conditionVariable) {
      const varName = sanitizeVariableName(node.conditionVariable)
      usedVariables.add(varName)
    }
    
    // Recursively process children
    for (const childId of node.childNodeIds) {
      collectVariables(childId, visited)
    }
  }
  
  // Collect variables from all nodes
  if (dialog.rootNodeId) {
    collectVariables(dialog.rootNodeId, new Set())
  }
  
  // Identify nodes that are referenced by multiple parents (need labels)
  // Use parentNodeIds directly from nodes - more reliable
  // Only dialog nodes (NPC/player) need labels - special nodes are processed inline
  const nodesNeedingLabels = new Set<string>()
  Object.values(dialog.nodes).forEach((node) => {
    // If a node has more than one parent AND it's a dialog node (not a special node), it needs a label
    const nodeType = node.type || 'dialog'
    const isDialogNode = nodeType === 'dialog' && (node.speaker === 'NPC' || node.speaker === 'player')
    if (node.parentNodeIds.length > 1 && isDialogNode) {
      nodesNeedingLabels.add(node.id)
    }
  })
  
  // Generate label names for nodes that need them
  const labelMap = new Map<string, string>() // nodeId -> labelName
  let labelIndex = 0
  nodesNeedingLabels.forEach((nodeId) => {
    labelMap.set(nodeId, generateLabelName(nodeId, labelIndex++))
  })
  
  // Transform definition for half-size sprites
  lines.push('transform half_size:')
  lines.push('    zoom 1.3')
  lines.push('    xalign 0.5')
  lines.push('    yalign 0.0')
  lines.push('')
  
  // The game starts here
  lines.push('# The game starts here.')
  lines.push('')
  lines.push('label start:')
  lines.push('')
  
  // Initialize all variables used in the dialog
  // This prevents NameError when variables are used in if statements
  // but might not be set in all code paths
  if (usedVariables.size > 0) {
    lines.push('    # Initialize variables')
    usedVariables.forEach(varName => {
      // Default to 0 for numeric variables (most common case)
      // If a variable is set to a string later, Ren'Py will handle the type conversion
      lines.push(`    $ ${varName} = 0`)
    })
    lines.push('')
  }
  
  // Track which labels have been defined and referenced
  const definedLabels = new Set<string>()
  const referencedLabels = new Set<string>()
  const emittedNodes = new Set<string>() // Track which nodes have had their content emitted
  
  // Convert dialog nodes to RenPy script
  if (dialog.rootNodeId && dialog.nodes[dialog.rootNodeId]) {
    const visited = new Set<string>()
    const nodeLines = convertNodeToRenPy(
      dialog.rootNodeId,
      dialog.nodes,
      characterMap,
      visited,
      nodesNeedingLabels,
      labelMap,
      definedLabels,
      referencedLabels,
      emittedNodes,
      1
    )
    lines.push(...nodeLines)
  } else {
    lines.push('    # No dialog nodes found.')
  }
  
  lines.push('')
  lines.push('    # This ends the game.')
  lines.push('    return')
  lines.push('')
  
  // Add any labels that were referenced but not yet defined
  // (Define them at the top level, outside of start label)
  const allLabelLines: string[] = []
  referencedLabels.forEach((nodeId) => {
    if (!definedLabels.has(nodeId) && dialog.nodes[nodeId]) {
      const labelName = labelMap.get(nodeId)!
      allLabelLines.push('')
      allLabelLines.push(`label ${labelName}:`)
      allLabelLines.push('')
      
      const labelVisited = new Set<string>()
      // Create a fresh emittedNodes set for label processing to avoid conflicts
      const labelEmittedNodes = new Set<string>()
      const labelContent = convertNodeToRenPy(
        nodeId,
        dialog.nodes,
        characterMap,
        labelVisited,
        nodesNeedingLabels,
        labelMap,
        definedLabels,
        referencedLabels,
        labelEmittedNodes, // Use separate set for label processing
        1,
        true // isLabelDefinition
      )
      allLabelLines.push(...labelContent)
      definedLabels.add(nodeId)
      // Don't mark as emitted in the main set - label processing uses its own set
    }
  })
  
  if (allLabelLines.length > 0) {
    lines.push(...allLabelLines)
  }
  
  return lines.join('\n')
}

/**
 * Recursively converts a dialog node and its children to RenPy format
 */
function convertNodeToRenPy(
  nodeId: string,
  nodes: Record<string, DialogNode>,
  characterMap: Map<string, string>,
  visited: Set<string>,
  nodesNeedingLabels: Set<string>,
  labelMap: Map<string, string>,
  definedLabels: Set<string>,
  referencedLabels: Set<string>,
  emittedNodes: Set<string>,
  indent: number,
  isLabelDefinition: boolean = false
): string[] {
  const lines: string[] = []
  const node = nodes[nodeId]
  
  if (!node) {
    return lines
  }
  
  // If this node needs a label and we're not defining it, use jump
  if (nodesNeedingLabels.has(nodeId) && !isLabelDefinition) {
    const labelName = labelMap.get(nodeId)!
    const indentStr = '    '.repeat(indent)
    
    // Mark this label as referenced (will be defined later if not already)
    referencedLabels.add(nodeId)
    
    // Always jump to the label - the content will be in the label definition
    lines.push(`${indentStr}jump ${labelName}`)
    lines.push('')
    return lines
  }
  
  // Get node type early to check if it's a special node
  const nodeType = node.type || 'dialog'
  const isSpecialNode = nodeType !== 'dialog'
  
  // If we're defining a label, we should emit its content even if it was referenced before
  // Otherwise, if node has already been emitted and doesn't need a label, skip to prevent duplicates
  // BUT: if it's a shared node (needs label), we should have already handled it above
  // Special nodes should not be skipped here - they need to be processed to emit their content
  if (emittedNodes.has(nodeId) && !isLabelDefinition && !nodesNeedingLabels.has(nodeId) && !isSpecialNode) {
    return lines
  }
  
  // Prevent infinite loops but allow revisiting for menus
  // BUT: if it's a shared node, we should have already handled it with a jump above
  // Special nodes should not be skipped here either
  if (visited.has(nodeId) && node.speaker === 'NPC' && !isLabelDefinition && !nodesNeedingLabels.has(nodeId) && !isSpecialNode) {
    return lines
  }
  
  visited.add(nodeId)
  const indentStr = '    '.repeat(indent)
  
  // Mark dialog nodes as emitted (special nodes will be marked after they emit their content)
  if (!isLabelDefinition && nodeType === 'dialog') {
    emittedNodes.add(nodeId)
  }
  
  if (nodeType === 'dialog' && node.speaker === 'NPC') {
    // NPC dialog line
    const escapedText = escapeText(node.text)
    
    // Before showing character emotion, check if there are scene/background changes
    // that should be processed first.
    const processedScenes = new Set<string>()
    
    // First, check this NPC node's own children for setBackground nodes
    // (These should appear before this NPC's emotion)
    for (const childId of node.childNodeIds) {
      const childNode = nodes[childId]
      if (childNode && childNode.type === 'setBackground' && childNode.backgroundImage) {
        const bgKey = childNode.backgroundImage.trim()
        if (!processedScenes.has(bgKey) && !emittedNodes.has(childId)) {
          const bgName = bgKey
          const bgTag = bgName.startsWith('bg ') ? bgName : `bg ${bgName}`
          lines.push(`${indentStr}scene ${bgTag} at Transform(xsize=config.screen_width, ysize=config.screen_height)`)
          lines.push(`${indentStr}with dissolve`)
          lines.push('')
          processedScenes.add(bgKey)
          emittedNodes.add(childId) // Mark as emitted to prevent duplicate
        }
      }
    }
    
    // Also check grandparent NPC nodes for setBackground children
    // (These should appear before this NPC's emotion if they're from a previous NPC)
    for (const parentId of node.parentNodeIds) {
      const parent = nodes[parentId]
      if (!parent) continue
      
      // Check grandparents (NPC nodes that are parents of the player node)
      // These are the previous NPC nodes that might have setBackground children
      for (const grandParentId of parent.parentNodeIds) {
        const grandParent = nodes[grandParentId]
        if (!grandParent || grandParent.speaker !== 'NPC') continue
        
        // Check if grandparent has setBackground children (siblings of the player node)
        for (const childId of grandParent.childNodeIds) {
          const childNode = nodes[childId]
          if (childNode && childNode.type === 'setBackground' && childNode.backgroundImage) {
            const bgKey = childNode.backgroundImage.trim()
            if (!processedScenes.has(bgKey) && !emittedNodes.has(childId)) {
              const bgName = bgKey
              const bgTag = bgName.startsWith('bg ') ? bgName : `bg ${bgName}`
              lines.push(`${indentStr}scene ${bgTag} at Transform(xsize=config.screen_width, ysize=config.screen_height)`)
              lines.push('')
              processedScenes.add(bgKey)
              emittedNodes.add(childId) // Mark as emitted to prevent duplicate
            }
          }
        }
      }
    }
    
    // Handle avatar and emotion if shown
    // Ren'Py uses image tags for character expressions: show character emotion
    // Format: show <character> <emotion> at half_size
    if (node.showAvatar && node.characterId && node.emotion) {
      const charVar = characterMap.get(node.characterId)
      if (charVar) {
        // Convert emotion to valid Ren'Py image tag format
        const emotion = node.emotion.replace(/\s+/g, '_').toLowerCase()
        lines.push(`${indentStr}show ${charVar} ${emotion} at half_size`)
        lines.push(`${indentStr}with dissolve`)
        lines.push('')
      }
    }
    
    if (node.characterId && characterMap.has(node.characterId)) {
      // Character dialog
      const charVar = characterMap.get(node.characterId)!
      lines.push(`${indentStr}${charVar} "${escapedText}"`)
    } else {
      // Narrator text (no character)
      lines.push(`${indentStr}"${escapedText}"`)
    }
    lines.push('')
  } else if (nodeType === 'setVariable') {
    // Set variable node
    if (node.variableName) {
      const value = typeof node.variableValue === 'number' 
        ? node.variableValue.toString()
        : `"${escapeText(String(node.variableValue || ''))}"`
      lines.push(`${indentStr}$ ${node.variableName} = ${value}`)
      lines.push('')
    }
  } else if (nodeType === 'changeVariable') {
    // Change variable node
    if (node.variableName && node.variableValue !== undefined) {
      const op = node.variableOperation === 'subtract' ? '-' : '+'
      lines.push(`${indentStr}$ ${node.variableName} ${op}= ${node.variableValue}`)
      lines.push('')
    }
  } else if (nodeType === 'setBackground') {
    // Set background node - Ren'Py uses "scene bg <name>" or "scene <name>"
    // If already emitted (processed early before an NPC emotion), skip
    // Otherwise, emit it now (it might not be a child of an NPC node)
    if (!emittedNodes.has(nodeId) && node.backgroundImage) {
      const bgName = node.backgroundImage.trim()
      const bgTag = bgName.startsWith('bg ') ? bgName : `bg ${bgName}`
      lines.push(`${indentStr}scene ${bgTag} at Transform(xsize=config.screen_width, ysize=config.screen_height)`)
      lines.push('')
      emittedNodes.add(nodeId) // Mark as emitted
    }
    
    // Process children - process all children, not just the first one
    if (node.childNodeIds.length > 0) {
      const branchVisited = new Set(visited)
      node.childNodeIds.forEach((childId) => {
        const childLines = convertNodeToRenPy(
          childId,
          nodes,
          characterMap,
          branchVisited,
          nodesNeedingLabels,
          labelMap,
          definedLabels,
          referencedLabels,
          emittedNodes,
          indent
        )
        lines.push(...childLines)
      })
    }
    
    return lines // Return early after processing children
  } else if (nodeType === 'soundPlay') {
    // Play sound node - Ren'Py uses "play sound <file>"
    if (node.soundFile) {
      const soundFile = node.soundFile.trim()
      lines.push(`${indentStr}play sound "${soundFile}"`)
      lines.push('')
    }
  } else if (nodeType === 'musicSet') {
    // Set music node - Ren'Py uses "play music <file> [fadein <time>] [fadeout <time>]"
    if (node.musicFile) {
      const musicFile = node.musicFile.trim()
      const fadeParams: string[] = []
      if (node.fadeIn !== undefined && node.fadeIn > 0) {
        fadeParams.push(`fadein ${node.fadeIn}`)
      }
      if (node.fadeOut !== undefined && node.fadeOut > 0) {
        fadeParams.push(`fadeout ${node.fadeOut}`)
      }
      const fadeStr = fadeParams.length > 0 ? ' ' + fadeParams.join(' ') : ''
      lines.push(`${indentStr}play music "${musicFile}"${fadeStr}`)
      lines.push('')
    }
  } else if (nodeType === 'ifStatement') {
    // If statement node
    if (node.conditionVariable && node.conditionOperator && node.conditionValue !== undefined) {
      // Sanitize variable name for Ren'Py
      const varName = sanitizeVariableName(node.conditionVariable)
      
      // Format the value - handle booleans, numbers, and strings
      let value: string
      const valueStr = String(node.conditionValue).trim()
      const valueLower = valueStr.toLowerCase()
      
      // Check for boolean values
      if (valueLower === 'true' || valueLower === 'false') {
        // Ren'Py uses True/False (capitalized, no quotes)
        value = valueLower === 'true' ? 'True' : 'False'
      } else if (typeof node.conditionValue === 'number') {
        value = node.conditionValue.toString()
      } else {
        // String value - wrap in quotes
        value = `"${escapeText(valueStr)}"`
      }
      
      const operator = node.conditionOperator === '==' ? '==' : 
                      node.conditionOperator === '!=' ? '!=' :
                      node.conditionOperator === '>' ? '>' :
                      node.conditionOperator === '<' ? '<' :
                      node.conditionOperator === '>=' ? '>=' : '<='
      lines.push(`${indentStr}if ${varName} ${operator} ${value}:`)
      lines.push('')
      
      // Process true branch (first child if available)
      const trueChildId = node.childNodeIds[0]
      if (trueChildId) {
        const trueLines = convertNodeToRenPy(
          trueChildId,
          nodes,
          characterMap,
          visited,
          nodesNeedingLabels,
          labelMap,
          definedLabels,
          referencedLabels,
          emittedNodes,
          indent + 1
        )
        lines.push(...trueLines)
      }
      
      // Process false branch (second child if available)
      const falseChildId = node.childNodeIds[1]
      if (falseChildId) {
        lines.push(`${indentStr}else:`)
        lines.push('')
        const falseLines = convertNodeToRenPy(
          falseChildId,
          nodes,
          characterMap,
          visited,
          nodesNeedingLabels,
          labelMap,
          definedLabels,
          referencedLabels,
          emittedNodes,
          indent + 1
        )
        lines.push(...falseLines)
      }
      
      return lines // Return early for if statement as we handled children
    }
  } else if (nodeType === 'sceneDescription') {
    // Scene description node - export as comment for reference
    if (node.text) {
      lines.push(`${indentStr}# Scene Description: ${escapeText(node.text)}`)
      lines.push('')
    }
  } else if (nodeType === 'switchCase') {
    // Switch case node - Ren'Py uses if-elif-else chain
    if (node.switchVariable && node.cases && node.cases.length > 0) {
      // Ren'Py doesn't have a direct switch statement, so we use if-elif-else
      node.cases.forEach((caseItem, index) => {
        const value = typeof caseItem.value === 'number'
          ? caseItem.value.toString()
          : `"${escapeText(String(caseItem.value))}"`
        const keyword = index === 0 ? 'if' : 'elif'
        lines.push(`${indentStr}${keyword} ${node.switchVariable} == ${value}:`)
        lines.push('')
        
        // Process case branch
        if (caseItem.nodeId) {
          const caseLines = convertNodeToRenPy(
            caseItem.nodeId,
            nodes,
            characterMap,
            visited,
            nodesNeedingLabels,
            labelMap,
            definedLabels,
            referencedLabels,
            emittedNodes,
            indent + 1
          )
          lines.push(...caseLines)
          // If no content, add pass to ensure valid syntax
          if (caseLines.length === 0) {
            lines.push(`${indentStr}    pass`)
            lines.push('')
          }
        } else if (node.childNodeIds[index]) {
          const caseLines = convertNodeToRenPy(
            node.childNodeIds[index],
            nodes,
            characterMap,
            visited,
            nodesNeedingLabels,
            labelMap,
            definedLabels,
            referencedLabels,
            emittedNodes,
            indent + 1
          )
          lines.push(...caseLines)
          // If no content, add pass to ensure valid syntax
          if (caseLines.length === 0) {
            lines.push(`${indentStr}    pass`)
            lines.push('')
          }
        } else {
          // No branch content, add pass
          lines.push(`${indentStr}    pass`)
          lines.push('')
        }
      })
      
      // Add else clause if there are more children than cases
      if (node.childNodeIds.length > node.cases.length) {
        lines.push(`${indentStr}else:`)
        lines.push('')
        const elseChildId = node.childNodeIds[node.cases.length]
        if (elseChildId) {
          const elseLines = convertNodeToRenPy(
            elseChildId,
            nodes,
            characterMap,
            visited,
            nodesNeedingLabels,
            labelMap,
            definedLabels,
            referencedLabels,
            emittedNodes,
            indent + 1
          )
          lines.push(...elseLines)
          if (elseLines.length === 0) {
            lines.push(`${indentStr}    pass`)
            lines.push('')
          }
        } else {
          lines.push(`${indentStr}    pass`)
          lines.push('')
        }
      }
      
      return lines // Return early for switch case as we handled children
    }
  }
  
  // For non-dialog nodes that aren't if/switch/sceneDescription, continue with normal flow
  if (nodeType !== 'dialog' && nodeType !== 'ifStatement' && nodeType !== 'switchCase' && nodeType !== 'sceneDescription') {
    // These nodes just execute and continue to children
    // Process children after executing the node's action
    if (node.childNodeIds.length > 0) {
      if (node.childNodeIds.length === 1) {
        const childLines = convertNodeToRenPy(
          node.childNodeIds[0],
          nodes,
          characterMap,
          visited,
          nodesNeedingLabels,
          labelMap,
          definedLabels,
          referencedLabels,
          emittedNodes,
          indent
        )
        lines.push(...childLines)
      } else {
        // Multiple children - follow first path
        lines.push(`${indentStr}# Note: Multiple paths available, following first path`)
        const childLines = convertNodeToRenPy(
          node.childNodeIds[0],
          nodes,
          characterMap,
          visited,
          nodesNeedingLabels,
          labelMap,
          definedLabels,
          referencedLabels,
          emittedNodes,
          indent
        )
        lines.push(...childLines)
      }
    }
    return lines
  }
  
  // Scene description nodes are just comments, continue to children
  if (nodeType === 'sceneDescription') {
    // Already processed above, now continue to children
    if (node.childNodeIds.length > 0) {
      if (node.childNodeIds.length === 1) {
        const childLines = convertNodeToRenPy(
          node.childNodeIds[0],
          nodes,
          characterMap,
          visited,
          nodesNeedingLabels,
          labelMap,
          definedLabels,
          referencedLabels,
          emittedNodes,
          indent
        )
        lines.push(...childLines)
      } else {
        // Multiple children - follow first path
        lines.push(`${indentStr}# Note: Multiple paths available, following first path`)
        const childLines = convertNodeToRenPy(
          node.childNodeIds[0],
          nodes,
          characterMap,
          visited,
          nodesNeedingLabels,
          labelMap,
          definedLabels,
          referencedLabels,
          emittedNodes,
          indent
        )
        lines.push(...childLines)
      }
    }
    return lines
  }
  
  // Handle dialog node children (original logic)
  if (nodeType === 'dialog' && node.speaker === 'NPC') {
    // Before processing children, check if there are setBackground nodes as children
    // that should be processed before showing emotion in the next dialog node
    // (This is handled in the mixed children section below)
    
    // Handle children
    if (node.childNodeIds.length > 0) {
      if (node.childNodeIds.length === 1) {
        // Single child - continue linearly
        const childLines = convertNodeToRenPy(
          node.childNodeIds[0],
          nodes,
          characterMap,
          visited,
          nodesNeedingLabels,
          labelMap,
          definedLabels,
          referencedLabels,
          emittedNodes,
          indent
        )
        lines.push(...childLines)
      } else {
        // Multiple children - check if they're player nodes (choices)
        const childNodes = node.childNodeIds
          .map(id => nodes[id])
          .filter(n => n !== undefined)
        
        const allPlayerNodes = childNodes.every(n => n.speaker === 'player')
        
        if (allPlayerNodes) {
          // If there's only one player choice, show it as direct dialog instead of a menu
          if (node.childNodeIds.length === 1) {
            const playerNodeId = node.childNodeIds[0]
            const playerNode = nodes[playerNodeId]
            if (playerNode && playerNode.speaker === 'player') {
              // Show as direct player dialog
              const playerText = escapeText(playerNode.text)
              lines.push(`${indentStr}"${playerText}"`)
              lines.push('')
              
              // Process the player node's children (typically NPC responses)
              if (playerNode.childNodeIds.length > 0) {
                const branchVisited = new Set(visited)
                playerNode.childNodeIds.forEach((grandChildId) => {
                  if (nodesNeedingLabels.has(grandChildId)) {
                    const labelName = labelMap.get(grandChildId)!
                    referencedLabels.add(grandChildId)
                    lines.push(`${indentStr}jump ${labelName}`)
                    lines.push('')
                  } else {
                    const grandChildLines = convertNodeToRenPy(
                      grandChildId,
                      nodes,
                      characterMap,
                      branchVisited,
                      nodesNeedingLabels,
                      labelMap,
                      definedLabels,
                      referencedLabels,
                      emittedNodes,
                      indent
                    )
                    lines.push(...grandChildLines)
                  }
                })
              }
            }
          } else {
            // Multiple player choices - create a menu
            lines.push(`${indentStr}menu:`)
            lines.push('')
            
            node.childNodeIds.forEach((childId) => {
              const childNode = nodes[childId]
              if (childNode && childNode.speaker === 'player') {
                const choiceText = escapeText(childNode.text)
                lines.push(`${indentStr}    "${choiceText}":`)
                
                // Process the child's children (typically NPC responses)
                if (childNode.childNodeIds.length > 0) {
                  // Create a new visited set for menu branches to allow proper flow
                  const branchVisited = new Set(visited)
                  
                  // Separate special nodes from dialog nodes
                  const specialGrandChildren: string[] = []
                  const dialogGrandChildren: string[] = []
                  
                  childNode.childNodeIds.forEach((grandChildId) => {
                    const grandChildNode = nodes[grandChildId]
                    if (grandChildNode) {
                      const grandChildType = grandChildNode.type || 'dialog'
                      if (grandChildType !== 'dialog' || (grandChildNode.speaker !== 'NPC' && grandChildNode.speaker !== 'player')) {
                        specialGrandChildren.push(grandChildId)
                      } else {
                        dialogGrandChildren.push(grandChildId)
                      }
                    }
                  })
                  
                  // Process special nodes first (before any jumps)
                  for (const specialGrandChildId of specialGrandChildren) {
                    const specialGrandChild = nodes[specialGrandChildId]
                    if (!specialGrandChild) continue
                    
                    const specialType = specialGrandChild.type || 'dialog'
                    if (specialType === 'setVariable' && specialGrandChild.variableName) {
                      const value = typeof specialGrandChild.variableValue === 'number' 
                        ? specialGrandChild.variableValue.toString()
                        : `"${escapeText(String(specialGrandChild.variableValue || ''))}"`
                      lines.push(`${indentStr}        $ ${specialGrandChild.variableName} = ${value}`)
                      lines.push('')
                    } else if (specialType === 'changeVariable' && specialGrandChild.variableName && specialGrandChild.variableValue !== undefined) {
                      const op = specialGrandChild.variableOperation === 'subtract' ? '-' : '+'
                      lines.push(`${indentStr}        $ ${specialGrandChild.variableName} ${op}= ${specialGrandChild.variableValue}`)
                      lines.push('')
                    } else if (specialType === 'setBackground' && specialGrandChild.backgroundImage) {
                      if (!emittedNodes.has(specialGrandChildId)) {
                        const bgName = specialGrandChild.backgroundImage.trim()
                        const bgTag = bgName.startsWith('bg ') ? bgName : `bg ${bgName}`
                        lines.push(`${indentStr}        scene ${bgTag} at Transform(xsize=config.screen_width, ysize=config.screen_height)`)
                        lines.push('')
                        emittedNodes.add(specialGrandChildId)
                      }
                    } else if (specialType === 'soundPlay' && specialGrandChild.soundFile) {
                      lines.push(`${indentStr}        play sound "${specialGrandChild.soundFile.trim()}"`)
                      lines.push('')
                    } else if (specialType === 'musicSet' && specialGrandChild.musicFile) {
                      const fadeParams: string[] = []
                      if (specialGrandChild.fadeIn !== undefined && specialGrandChild.fadeIn > 0) {
                        fadeParams.push(`fadein ${specialGrandChild.fadeIn}`)
                      }
                      if (specialGrandChild.fadeOut !== undefined && specialGrandChild.fadeOut > 0) {
                        fadeParams.push(`fadeout ${specialGrandChild.fadeOut}`)
                      }
                      const fadeStr = fadeParams.length > 0 ? ' ' + fadeParams.join(' ') : ''
                      lines.push(`${indentStr}        play music "${specialGrandChild.musicFile.trim()}"${fadeStr}`)
                      lines.push('')
                    }
                  }
                  
                  // Then process dialog nodes (which might generate jumps)
                  dialogGrandChildren.forEach((grandChildId) => {
                    // If this grandchild is a shared node, we should jump to it
                    if (nodesNeedingLabels.has(grandChildId)) {
                      const labelName = labelMap.get(grandChildId)!
                      referencedLabels.add(grandChildId)
                      lines.push(`${indentStr}        jump ${labelName}`)
                      lines.push('')
                    } else {
                      // Not a shared node, process normally
                      const grandChildLines = convertNodeToRenPy(
                        grandChildId,
                        nodes,
                        characterMap,
                        branchVisited,
                        nodesNeedingLabels,
                        labelMap,
                        definedLabels,
                        referencedLabels,
                        emittedNodes,
                        indent + 2
                      )
                      lines.push(...grandChildLines)
                      // If we got empty lines, add pass to ensure menu choice has content
                      if (grandChildLines.length === 0) {
                        lines.push(`${indentStr}        pass`)
                        lines.push('')
                      }
                    }
                  })
                  
                  // If no children were processed, add pass
                  if (specialGrandChildren.length === 0 && dialogGrandChildren.length === 0) {
                    lines.push(`${indentStr}        pass`)
                  }
                } else {
                  lines.push(`${indentStr}        pass`)
                }
                lines.push('')
              }
            })
          }
        } else {
          // Mixed children - process special nodes first, then find next dialog node
          // Process all special nodes (they execute in parallel)
          const specialNodes: string[] = []
          const dialogNodes: string[] = []
          
          node.childNodeIds.forEach((childId) => {
            const childNode = nodes[childId]
            if (childNode) {
              const childType = childNode.type || 'dialog'
              if (childType !== 'dialog' || (childNode.speaker !== 'NPC' && childNode.speaker !== 'player')) {
                specialNodes.push(childId)
              } else {
                dialogNodes.push(childId)
              }
            }
          })
          
          // Process all special nodes first (they affect state but don't block flow)
          // Only process the immediate effect, don't process children yet
          for (const specialNodeId of specialNodes) {
            const specialNode = nodes[specialNodeId]
            if (!specialNode) continue
            
            const specialType = specialNode.type || 'dialog'
            
            // Process only the immediate effect of the special node
            if (specialType === 'setVariable' && specialNode.variableName) {
              const value = typeof specialNode.variableValue === 'number' 
                ? specialNode.variableValue.toString()
                : `"${escapeText(String(specialNode.variableValue || ''))}"`
              lines.push(`${indentStr}$ ${specialNode.variableName} = ${value}`)
              lines.push('')
            } else if (specialType === 'changeVariable' && specialNode.variableName && specialNode.variableValue !== undefined) {
              const op = specialNode.variableOperation === 'subtract' ? '-' : '+'
              lines.push(`${indentStr}$ ${specialNode.variableName} ${op}= ${specialNode.variableValue}`)
              lines.push('')
            } else if (specialType === 'setBackground' && specialNode.backgroundImage) {
              // Skip if already emitted (processed early before NPC emotion)
              if (!emittedNodes.has(specialNodeId)) {
                const bgName = specialNode.backgroundImage.trim()
                const bgTag = bgName.startsWith('bg ') ? bgName : `bg ${bgName}`
                lines.push(`${indentStr}scene ${bgTag} at Transform(xsize=config.screen_width, ysize=config.screen_height)`)
                lines.push('')
                emittedNodes.add(specialNodeId) // Mark as emitted
              }
            } else if (specialType === 'soundPlay' && specialNode.soundFile) {
              const soundFile = specialNode.soundFile.trim()
              lines.push(`${indentStr}play sound "${soundFile}"`)
              lines.push('')
            } else if (specialType === 'musicSet' && specialNode.musicFile) {
              const musicFile = specialNode.musicFile.trim()
              const fadeParams: string[] = []
              if (specialNode.fadeIn !== undefined && specialNode.fadeIn > 0) {
                fadeParams.push(`fadein ${specialNode.fadeIn}`)
              }
              if (specialNode.fadeOut !== undefined && specialNode.fadeOut > 0) {
                fadeParams.push(`fadeout ${specialNode.fadeOut}`)
              }
              const fadeStr = fadeParams.length > 0 ? ' ' + fadeParams.join(' ') : ''
              lines.push(`${indentStr}play music "${musicFile}"${fadeStr}`)
              lines.push('')
            } else if (specialType === 'sceneDescription' && specialNode.text) {
              lines.push(`${indentStr}# Scene Description: ${escapeText(specialNode.text)}`)
              lines.push('')
            }
            // Note: We don't process children of special nodes here - they'll be handled
            // when we continue with dialog nodes, or if they're in the dialog path
          }
          
          // Then continue with the first dialog node (or all if menu needed)
          if (dialogNodes.length > 0) {
            if (dialogNodes.length === 1) {
              // Single dialog child - check if it's a player node to show as dialog
              const singleDialogNode = nodes[dialogNodes[0]]
              if (singleDialogNode && singleDialogNode.speaker === 'player') {
                // Show player node as direct dialog (parent has only this dialog node as child)
                const playerText = escapeText(singleDialogNode.text)
                lines.push(`${indentStr}"${playerText}"`)
                lines.push('')
                
                // Process the player node's children (typically NPC responses)
                if (singleDialogNode.childNodeIds.length > 0) {
                  const branchVisited = new Set(visited)
                  singleDialogNode.childNodeIds.forEach((grandChildId) => {
                    if (nodesNeedingLabels.has(grandChildId)) {
                      const labelName = labelMap.get(grandChildId)!
                      referencedLabels.add(grandChildId)
                      lines.push(`${indentStr}jump ${labelName}`)
                      lines.push('')
                    } else {
                      const grandChildLines = convertNodeToRenPy(
                        grandChildId,
                        nodes,
                        characterMap,
                        branchVisited,
                        nodesNeedingLabels,
                        labelMap,
                        definedLabels,
                        referencedLabels,
                        emittedNodes,
                        indent
                      )
                      lines.push(...grandChildLines)
                    }
                  })
                }
              } else {
                // Single NPC dialog child - continue normally
                const dialogLines = convertNodeToRenPy(
                  dialogNodes[0],
                  nodes,
                  characterMap,
                  visited,
                  nodesNeedingLabels,
                  labelMap,
                  definedLabels,
                  referencedLabels,
                  emittedNodes,
                  indent
                )
                lines.push(...dialogLines)
              }
            } else {
              // Multiple dialog children - check if they're player choices
              const dialogChildNodes = dialogNodes.map(id => nodes[id]).filter(n => n !== undefined)
              const allPlayerChoices = dialogChildNodes.every(n => n.speaker === 'player')
              
              if (allPlayerChoices) {
                // If there's only one player choice, show it as direct dialog instead of a menu
                if (dialogNodes.length === 1) {
                  const playerNodeId = dialogNodes[0]
                  const playerNode = nodes[playerNodeId]
                  if (playerNode && playerNode.speaker === 'player') {
                    // Show as direct player dialog
                    const playerText = escapeText(playerNode.text)
                    lines.push(`${indentStr}"${playerText}"`)
                    lines.push('')
                    
                    // Process the player node's children (typically NPC responses)
                    if (playerNode.childNodeIds.length > 0) {
                      const branchVisited = new Set(visited)
                      playerNode.childNodeIds.forEach((grandChildId) => {
                        if (nodesNeedingLabels.has(grandChildId)) {
                          const labelName = labelMap.get(grandChildId)!
                          referencedLabels.add(grandChildId)
                          lines.push(`${indentStr}jump ${labelName}`)
                          lines.push('')
                        } else {
                          const grandChildLines = convertNodeToRenPy(
                            grandChildId,
                            nodes,
                            characterMap,
                            branchVisited,
                            nodesNeedingLabels,
                            labelMap,
                            definedLabels,
                            referencedLabels,
                            emittedNodes,
                            indent
                          )
                          lines.push(...grandChildLines)
                        }
                      })
                    }
                  }
                } else {
                  // Multiple player choices - create menu
                  lines.push(`${indentStr}menu:`)
                  lines.push('')
                  
                  dialogNodes.forEach((childId) => {
                    const childNode = nodes[childId]
                    if (childNode && childNode.speaker === 'player') {
                      const choiceText = escapeText(childNode.text)
                      lines.push(`${indentStr}    "${choiceText}":`)
                      
                      if (childNode.childNodeIds.length > 0) {
                        const branchVisited = new Set(visited)
                        childNode.childNodeIds.forEach((grandChildId) => {
                          if (nodesNeedingLabels.has(grandChildId)) {
                            const labelName = labelMap.get(grandChildId)!
                            referencedLabels.add(grandChildId)
                            lines.push(`${indentStr}        jump ${labelName}`)
                            lines.push('')
                          } else {
                            const grandChildLines = convertNodeToRenPy(
                              grandChildId,
                              nodes,
                              characterMap,
                              branchVisited,
                              nodesNeedingLabels,
                              labelMap,
                              definedLabels,
                              referencedLabels,
                              emittedNodes,
                              indent + 2
                            )
                            lines.push(...grandChildLines)
                            if (grandChildLines.length === 0) {
                              lines.push(`${indentStr}        pass`)
                              lines.push('')
                            }
                          }
                        })
                      } else {
                        lines.push(`${indentStr}        pass`)
                      }
                      lines.push('')
                    }
                  })
                }
              } else {
                // Multiple NPC dialog nodes - follow first
                lines.push(`${indentStr}# Note: Multiple dialog paths available, following first path`)
                const dialogLines = convertNodeToRenPy(
                  dialogNodes[0],
                  nodes,
                  characterMap,
                  visited,
                  nodesNeedingLabels,
                  labelMap,
                  definedLabels,
                  referencedLabels,
                  emittedNodes,
                  indent
                )
                lines.push(...dialogLines)
              }
            }
          }
        }
      }
    }
  } else if (node.speaker === 'player') {
    // Player dialog nodes are typically choices in menus
    // If this player node appears outside a menu context, check if parent has only one dialog child
    // (ignoring special nodes). If so, show as direct dialog; otherwise show as comment
    
    // Check if any parent has only this player node as a dialog child (ignoring special nodes)
    const parentHasSingleDialogChild = node.parentNodeIds.length > 0 && 
      node.parentNodeIds.some(parentId => {
        const parent = nodes[parentId]
        if (!parent) return false
        
        // Count dialog children (NPC/player), ignoring special nodes
        const dialogChildren = parent.childNodeIds.filter(childId => {
          const child = nodes[childId]
          if (!child) return false
          const childType = child.type || 'dialog'
          return childType === 'dialog' || (!child.type && (child.speaker === 'NPC' || child.speaker === 'player'))
        })
        
        // If parent has only one dialog child and it's this player node, show as dialog
        return dialogChildren.length === 1 && dialogChildren[0] === nodeId
      })
    
    if (node.text.trim()) {
      if (parentHasSingleDialogChild) {
        // Parent has only this player node as dialog child (ignoring special nodes) - show as direct dialog
        const playerText = escapeText(node.text)
        lines.push(`${indentStr}"${playerText}"`)
        lines.push('')
      } else {
        // Multiple dialog exits or no clear parent - show as comment
        lines.push(`${indentStr}# Player choice: ${escapeText(node.text)}`)
      }
    }
    
    // Process children (typically NPC responses or more player dialog)
    if (node.childNodeIds.length > 0) {
      // Separate special nodes from dialog nodes
      const specialChildren: string[] = []
      const dialogChildren: string[] = []
      
      node.childNodeIds.forEach((childId) => {
        const childNode = nodes[childId]
        if (childNode) {
          const childType = childNode.type || 'dialog'
          if (childType !== 'dialog' || (childNode.speaker !== 'NPC' && childNode.speaker !== 'player')) {
            specialChildren.push(childId)
          } else {
            dialogChildren.push(childId)
          }
        }
      })
      
      // Process special nodes first (setBackground, setVariable, etc.)
      // Process them fully (including children) by calling convertNodeToRenPy
      const branchVisited = new Set(visited)
      for (const specialChildId of specialChildren) {
        const specialChildLines = convertNodeToRenPy(
          specialChildId,
          nodes,
          characterMap,
          branchVisited,
          nodesNeedingLabels,
          labelMap,
          definedLabels,
          referencedLabels,
          emittedNodes,
          indent
        )
        lines.push(...specialChildLines)
      }
      
      // Then process dialog children
      if (dialogChildren.length > 0) {
        // Check if all dialog children are player nodes (player talking to himself sequentially)
        const dialogChildNodes = dialogChildren
          .map(id => nodes[id])
          .filter(n => n !== undefined)
        const allPlayerChildren = dialogChildNodes.length > 0 && dialogChildNodes.every(n => n.speaker === 'player')
        
        if (allPlayerChildren) {
          // All children are player nodes - process them sequentially (player talking to himself)
          const branchVisited = new Set(visited)
          dialogChildren.forEach((childId) => {
            const childLines = convertNodeToRenPy(
              childId,
              nodes,
              characterMap,
              branchVisited,
              nodesNeedingLabels,
              labelMap,
              definedLabels,
              referencedLabels,
              emittedNodes,
              indent
            )
            lines.push(...childLines)
          })
        } else if (dialogChildren.length === 1) {
          // Single dialog child - continue linearly
          const childLines = convertNodeToRenPy(
            dialogChildren[0],
            nodes,
            characterMap,
            visited,
            nodesNeedingLabels,
            labelMap,
            definedLabels,
            referencedLabels,
            emittedNodes,
            indent
          )
          lines.push(...childLines)
        } else {
          // Multiple dialog children with mixed types - process all sequentially
          const branchVisited = new Set(visited)
          dialogChildren.forEach((childId) => {
            const childLines = convertNodeToRenPy(
              childId,
              nodes,
              characterMap,
              branchVisited,
              nodesNeedingLabels,
              labelMap,
              definedLabels,
              referencedLabels,
              emittedNodes,
              indent
            )
            lines.push(...childLines)
          })
        }
      }
    } else {
      lines.push('')
    }
  }
  
  return lines
}

