import { useCallback, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { DialogNode } from '../types/models'
import { useDialogStore } from '../store/dialogStore'
import { createDialogNode } from '../utils/dialogUtils'
import './DialogNodeComponent.css'

interface DialogNodeData {
  node: DialogNode
  onGenerate?: (nodeId: string) => void
  onAddPlayerResponse?: (nodeId: string) => void
  onDoubleClick?: (nodeId: string) => void
}

export default function DialogNodeComponent({ data, id }: NodeProps<DialogNodeData>) {
  const { node, onGenerate, onAddPlayerResponse, onDoubleClick } = data
  const { updateNode, deleteNode, characters } = useDialogStore()
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState(node.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isEditing && node.text !== text) {
      setText(node.text)
    }
  }, [node.text, isEditing])

  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText)
    },
    []
  )

  const handleBlur = useCallback(() => {
    updateNode(id, { text })
    setIsEditing(false)
  }, [id, text, updateNode])

  const handleSpeakerChange = useCallback(
    (newSpeaker: 'NPC' | 'player') => {
      const updates: Partial<DialogNode> = { speaker: newSpeaker }
      if (newSpeaker === 'player') {
        updates.characterId = undefined
      }
      updateNode(id, updates)
    },
    [id, updateNode]
  )

  const handleCharacterChange = useCallback(
    (characterId: string) => {
      updateNode(id, { characterId: characterId || undefined })
    },
    [id, updateNode]
  )

  const handleGenerate = useCallback(() => {
    if (onGenerate && node.speaker === 'player') {
      onGenerate(id)
    }
  }, [onGenerate, node.speaker, id])

  const handleAddPlayerResponse = useCallback(() => {
    if (onAddPlayerResponse && node.speaker === 'NPC') {
      onAddPlayerResponse(id)
    }
  }, [onAddPlayerResponse, node.speaker, id])

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this node?')) {
      deleteNode(id)
    }
  }, [deleteNode, id])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    
    if (e.key === 'Escape') {
      setIsEditing(false)
      setText(node.text)
      textareaRef.current?.blur()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      updateNode(id, { text })
      setIsEditing(false)
      textareaRef.current?.blur()
    }
  }, [node.text, id, text, updateNode])

  const characterList = Object.values(characters)
  const selectedCharacter = node.characterId ? characters[node.characterId] : null

  const handleDoubleClickNode = useCallback(() => {
    if (onDoubleClick) {
      onDoubleClick(id)
    }
  }, [onDoubleClick, id])

  return (
    <div
      className={`dialog-node dialog-node-${node.speaker.toLowerCase()}`}
      onDoubleClick={handleDoubleClickNode}
      style={{ cursor: onDoubleClick ? 'pointer' : 'default' }}
    >
      <Handle type="target" position={Position.Top} />
      
      <div className="dialog-node-header">
        <select
          value={node.speaker}
          onChange={(e) => handleSpeakerChange(e.target.value as 'NPC' | 'player')}
          className="dialog-node-speaker"
        >
          <option value="NPC">NPC</option>
          <option value="player">Player</option>
        </select>
        {node.speaker === 'NPC' && (
          <select
            value={node.characterId || ''}
            onChange={(e) => handleCharacterChange(e.target.value)}
            className="dialog-node-character"
            title="Select character for this NPC"
          >
            <option value="">-- Select Character --</option>
            {characterList.map((char) => (
              <option key={char.id} value={char.id}>
                {char.name}
              </option>
            ))}
          </select>
        )}
        <div className="dialog-node-actions">
          {node.speaker === 'player' && onGenerate && (
            <button onClick={handleGenerate} className="dialog-node-generate" title="Generate AI response">
              ✨
            </button>
          )}
          {node.speaker === 'NPC' && onAddPlayerResponse && (
            <button 
              onClick={handleAddPlayerResponse} 
              className="dialog-node-add-response" 
              title="Add player response option"
            >
              +
            </button>
          )}
          <button 
            onClick={handleDelete} 
            className="dialog-node-delete" 
            title="Delete node"
          >
            ×
          </button>
        </div>
      </div>
      
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="dialog-node-textarea"
          autoFocus
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="dialog-node-text"
          onClick={() => setIsEditing(true)}
          title="Click to edit"
        >
          {text || '(empty)'}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
