import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useDialogStore } from '../store/dialogStore'
import { generateNodeContext, getLastNPCCharacterId, getConversationHistory, calculateVariables, collectSceneDescriptions } from '../utils/nodeTree'
import { getAIService } from '../services/aiService'
import { DialogNode } from '../types/models'
import { createDialogNode } from '../utils/dialogUtils'
import './NodeChatPanel.css'

interface NodeChatPanelProps {
  nodeId: string | null
  onClose: () => void
  onNodeChange?: (newNodeId: string) => void
}

export default function NodeChatPanel({ nodeId, onClose, onNodeChange }: NodeChatPanelProps) {
  const {
    currentDialog,
    characters,
    currentScene,
    addNode,
    linkNodes,
    saveToHistory,
  } = useDialogStore()

  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const [chatNodeId, setChatNodeId] = useState<string | null>(nodeId)

  const history = useMemo(() => {
    if (!chatNodeId || !currentDialog) return []
    return getConversationHistory(currentDialog.nodes, currentDialog.rootNodeId, chatNodeId)
  }, [chatNodeId, currentDialog])

  const selectedNode = useMemo(() => {
    if (!chatNodeId || !currentDialog) return null
    return currentDialog.nodes[chatNodeId] || null
  }, [chatNodeId, currentDialog])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, selectedNode])
  
  useEffect(() => {
    setChatNodeId(nodeId)
  }, [nodeId])

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !chatNodeId || !currentDialog || isGenerating) return

    const trimmedText = inputText.trim()
    setInputText('')
    setIsGenerating(true)

    try {
      const lastNode = selectedNode || history[history.length - 1]
      if (!lastNode) {
        setIsGenerating(false)
        return
      }

      const playerNode: DialogNode = createDialogNode('player', trimmedText, [lastNode.id])
      const playerNodeId = playerNode.id
      
      addNode(playerNode)
      linkNodes(lastNode.id, playerNodeId)
      saveToHistory()

      const updatedDialog = useDialogStore.getState().currentDialog
      if (!updatedDialog) {
        alert('Failed to update dialog')
        setIsGenerating(false)
        return
      }

      let context = generateNodeContext(
        updatedDialog.nodes,
        updatedDialog.rootNodeId,
        playerNodeId
      )
      
      if (!context || context.trim() === '') {
        const historyContext = history
          .map((node) => {
            const speaker = node.speaker === 'NPC' ? 'NPC' : 'Player'
            return `${speaker}: ${node.text}`
          })
          .join('\n\n')
        context = historyContext
          ? `${historyContext}\n\nPlayer: ${trimmedText}`
          : `Player: ${trimmedText}`
      }

      let inheritedCharacterId = getLastNPCCharacterId(
        updatedDialog.nodes,
        updatedDialog.rootNodeId,
        playerNodeId
      )

      if (!inheritedCharacterId && lastNode.speaker === 'NPC' && lastNode.characterId) {
        inheritedCharacterId = lastNode.characterId
      }

      if (!inheritedCharacterId) {
        const npcNodes = Object.values(updatedDialog.nodes).filter(
          (n) => n.speaker === 'NPC' && n.characterId
        )
        if (npcNodes.length > 0) {
          inheritedCharacterId = npcNodes[npcNodes.length - 1].characterId
        }
      }

      if (!inheritedCharacterId) {
        alert('No character found for this conversation. Please ensure at least one NPC node has a character assigned.')
        setIsGenerating(false)
        return
      }

      const character = characters[inheritedCharacterId]
      if (!character) {
        alert('Character not found.')
        setIsGenerating(false)
        return
      }

      // Calculate variables and collect scene descriptions
      const variables = calculateVariables(
        updatedDialog.nodes,
        updatedDialog.rootNodeId,
        playerNodeId
      )
      const sceneDescriptions = collectSceneDescriptions(
        updatedDialog.nodes,
        updatedDialog.rootNodeId,
        playerNodeId
      )

      const aiService = getAIService()
      const response = await aiService.generateNPCResponse(
        context,
        character,
        currentScene || undefined,
        variables,
        sceneDescriptions
      )

      // Detect emotion from the response
      const detectedEmotion = await aiService.detectEmotion(
        response,
        character,
        variables,
        sceneDescriptions
      )

      const npcNode: DialogNode = createDialogNode('NPC', response, [playerNodeId])
      npcNode.characterId = character.id
      npcNode.showAvatar = true
      npcNode.emotion = detectedEmotion as any
      const npcNodeId = npcNode.id

      addNode(npcNode)
      linkNodes(playerNodeId, npcNodeId)
      
      // Analyze response and create variable nodes if needed
      const nodeActions = await aiService.analyzeAndCreateNodes(
        response,
        character,
        variables,
        sceneDescriptions
      )
      
      let lastNodeId = npcNodeId
      for (const action of nodeActions) {
        const actionNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        let actionNode: DialogNode
        
        if (action.type === 'setVariable') {
          actionNode = {
            id: actionNodeId,
            type: 'setVariable',
            speaker: 'NPC',
            text: '',
            variableName: action.variableName,
            variableValue: action.variableValue,
            childNodeIds: [],
            parentNodeIds: [lastNodeId],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        } else {
          actionNode = {
            id: actionNodeId,
            type: 'changeVariable',
            speaker: 'NPC',
            text: '',
            variableName: action.variableName,
            variableOperation: action.variableOperation,
            variableValue: action.variableValue,
            childNodeIds: [],
            parentNodeIds: [lastNodeId],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        }
        
        addNode(actionNode)
        linkNodes(lastNodeId, actionNodeId)
        lastNodeId = actionNodeId
      }
      
      saveToHistory()

      const latestDialog = useDialogStore.getState().currentDialog
      if (latestDialog && latestDialog.nodes[npcNodeId] && latestDialog.nodes[playerNodeId]) {
        setChatNodeId(npcNodeId)
        if (onNodeChange) {
          onNodeChange(npcNodeId)
        }
      } else {
        console.error('Failed to find created nodes in dialog store', {
          npcNodeId,
          playerNodeId,
          hasNpc: !!latestDialog?.nodes[npcNodeId],
          hasPlayer: !!latestDialog?.nodes[playerNodeId],
        })
      }
    } catch (error) {
      console.error('Error generating response:', error)
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsGenerating(false)
    }
  }, [inputText, chatNodeId, currentDialog, selectedNode, history, characters, currentScene, addNode, linkNodes, saveToHistory, onNodeChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  if (!chatNodeId || !currentDialog) {
    return null
  }

  return (
    <div className="node-chat-panel-overlay" onClick={onClose}>
      <div className="node-chat-panel" onClick={(e) => e.stopPropagation()}>
        <div className="node-chat-header">
          <h3>Chat from Node</h3>
          <button onClick={onClose} className="node-chat-close">×</button>
        </div>

        <div className="node-chat-messages">
          {history.map((node, index) => (
            <div
              key={node.id}
              className={`node-chat-message node-chat-message-${node.speaker.toLowerCase()}`}
            >
              <div className="node-chat-message-header">
                <span className="node-chat-message-speaker">
                  {node.speaker === 'NPC' && node.characterId
                    ? characters[node.characterId]?.name || 'NPC'
                    : node.speaker}
                </span>
              </div>
              <div className="node-chat-message-text">{node.text}</div>
            </div>
          ))}
          {selectedNode && !history.some(n => n.id === selectedNode.id) && (
            <div
              className={`node-chat-message node-chat-message-${selectedNode.speaker.toLowerCase()}`}
            >
              <div className="node-chat-message-header">
                <span className="node-chat-message-speaker">
                  {selectedNode.speaker === 'NPC' && selectedNode.characterId
                    ? characters[selectedNode.characterId]?.name || 'NPC'
                    : selectedNode.speaker}
                </span>
              </div>
              <div className="node-chat-message-text">{selectedNode.text}</div>
            </div>
          )}
          {isGenerating && (
            <div className="node-chat-message node-chat-message-generating">
              <div className="node-chat-message-text">Generating response...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="node-chat-input-container">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send)"
            className="node-chat-input"
            disabled={isGenerating}
            rows={2}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isGenerating}
            className="node-chat-send"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

