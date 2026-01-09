import { useState, useMemo, useCallback } from 'react'
import { useDialogStore } from '../store/dialogStore'
import { nodeTreeToLinearChat, generateNodeContext, getLastNPCCharacterId, calculateVariables, collectSceneDescriptions } from '../utils/nodeTree'
import { getAIService } from '../services/aiService'
import { DialogNode } from '../types/models'
import './ChatEditor.css'

export default function ChatEditor() {
  const {
    currentDialog,
    characters,
    currentScene,
    addNode,
    updateNode,
    linkNodes,
    saveToHistory,
  } = useDialogStore()
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const linearChat = useMemo(() => {
    if (!currentDialog || !currentDialog.rootNodeId) return []
    return nodeTreeToLinearChat(currentDialog.nodes, currentDialog.rootNodeId)
  }, [currentDialog])

  const handleGenerateResponse = useCallback(async () => {
    if (!currentDialog) return
    
    const lastNode = linearChat[linearChat.length - 1]
    if (!lastNode || lastNode.speaker !== 'player') {
      const playerNodeId = `node_${Date.now()}`
      const playerNode: DialogNode = {
        id: playerNodeId,
        speaker: 'player',
        text: '[Player message]',
        childNodeIds: [],
        parentNodeIds: lastNode ? [lastNode.id] : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      addNode(playerNode)
      if (lastNode) {
        linkNodes(lastNode.id, playerNodeId)
      } else if (!currentDialog.rootNodeId) {
        useDialogStore.setState((state) => {
          if (state.currentDialog) {
            state.currentDialog.rootNodeId = playerNodeId
          }
        })
      }
    }
    
    const contextNode = linearChat[linearChat.length - 1] || Object.values(currentDialog.nodes)[0]
    if (!contextNode) return
    
    const playerNode = contextNode
    const parentNodeId = playerNode.parentNodeIds[0]
    if (!parentNodeId) {
      alert('No parent NPC node found. Connect this node to an NPC node first.')
      return
    }
    
    const parentNode = currentDialog.nodes[parentNodeId]
    if (!parentNode || parentNode.speaker !== 'NPC') {
      alert('Parent node is not an NPC. Connect to an NPC node first.')
      return
    }
    
    if (!parentNode.characterId) {
      alert('Please select a character for the parent NPC node first.')
      return
    }
    
    const character = characters[parentNode.characterId]
    if (!character) {
      alert('Character not found. Please select a valid character for the NPC node.')
      return
    }
    
    const context = generateNodeContext(
      currentDialog.nodes,
      currentDialog.rootNodeId,
      contextNode.id
    )
    
    const inheritedCharacterId = getLastNPCCharacterId(
      currentDialog.nodes,
      currentDialog.rootNodeId,
      contextNode.id
    ) || parentNode.characterId
    
    // Calculate variables and collect scene descriptions
    const variables = calculateVariables(
      currentDialog.nodes,
      currentDialog.rootNodeId,
      contextNode.id
    )
    const sceneDescriptions = collectSceneDescriptions(
      currentDialog.nodes,
      currentDialog.rootNodeId,
      contextNode.id
    )
    
    const aiService = getAIService()
    
    try {
      const response = await aiService.generateNPCResponse(
        context,
        character,
        currentScene || undefined,
        variables,
        sceneDescriptions
      )
      
      const newNodeId = `node_${Date.now()}`
      const newNode: DialogNode = {
        id: newNodeId,
        speaker: 'NPC',
      text: response,
      characterId: inheritedCharacterId,
      childNodeIds: [],
        parentNodeIds: [contextNode.id],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      
      addNode(newNode)
      linkNodes(contextNode.id, newNodeId)
      saveToHistory()
    } catch (error) {
      console.error('Error generating AI response:', error)
    }
  }, [currentDialog, characters, currentScene, linearChat, addNode, linkNodes, saveToHistory])

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
  }, [])

  const handleNodeEdit = useCallback((node: DialogNode) => {
    setEditingNodeId(node.id)
    setEditText(node.text)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!editingNodeId) return
    
    updateNode(editingNodeId, { text: editText })
    setEditingNodeId(null)
    setEditText('')
    saveToHistory()
  }, [editingNodeId, editText, updateNode, saveToHistory])

  const handleCancelEdit = useCallback(() => {
    setEditingNodeId(null)
    setEditText('')
  }, [])

  if (!currentDialog) {
    return (
      <div className="chat-editor-empty">
        <p>No dialog loaded. Create a new dialog or load an existing one.</p>
      </div>
    )
  }

  return (
    <div className="chat-editor">
      <div className="chat-toolbar">
        <button onClick={handleGenerateResponse} className="chat-generate-btn">
          Generate AI Response
        </button>
      </div>
      
      <div className="chat-messages">
        {linearChat.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet. Click "Generate AI Response" to start a conversation.</p>
          </div>
        ) : (
          linearChat.map((node) => (
            <div
              key={node.id}
              className={`chat-message chat-message-${node.speaker.toLowerCase()} ${
                selectedNodeId === node.id ? 'selected' : ''
              }`}
              onClick={() => handleNodeSelect(node.id)}
            >
              <div className="chat-message-header">
                <span className="chat-message-speaker">{node.speaker}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNodeEdit(node)
                  }}
                  className="chat-message-edit"
                >
                  Edit
                </button>
              </div>
              
              {editingNodeId === node.id ? (
                <div className="chat-message-edit-form">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="chat-message-edit-textarea"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleSaveEdit()
                      } else if (e.key === 'Escape') {
                        handleCancelEdit()
                      }
                    }}
                  />
                  <div className="chat-message-edit-actions">
                    <button onClick={handleSaveEdit}>Save (Ctrl+Enter)</button>
                    <button onClick={handleCancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="chat-message-text">{node.text}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

