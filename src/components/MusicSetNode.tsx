import { useCallback, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { DialogNode } from '../types/models'
import { useDialogStore } from '../store/dialogStore'
import './DialogNodeComponent.css'

interface MusicSetNodeData {
  node: DialogNode
}

export default function MusicSetNode({ data, id }: NodeProps<MusicSetNodeData>) {
  const { node } = data
  const { updateNode, deleteNode } = useDialogStore()
  const [musicFile, setMusicFile] = useState(node.musicFile || '')
  const [fadeIn, setFadeIn] = useState(node.fadeIn?.toString() || '')
  const [fadeOut, setFadeOut] = useState(node.fadeOut?.toString() || '')

  useEffect(() => {
    setMusicFile(node.musicFile || '')
    setFadeIn(node.fadeIn?.toString() || '')
    setFadeOut(node.fadeOut?.toString() || '')
  }, [node.musicFile, node.fadeIn, node.fadeOut])

  const handleMusicFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setMusicFile(e.target.value)
    },
    []
  )

  const handleMusicFileBlur = useCallback(() => {
    updateNode(id, { musicFile: musicFile || undefined })
  }, [id, musicFile, updateNode])

  const handleFadeInChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFadeIn(e.target.value)
    },
    []
  )

  const handleFadeInBlur = useCallback(() => {
    const numValue = parseFloat(fadeIn)
    updateNode(id, { fadeIn: fadeIn === '' ? undefined : (isNaN(numValue) ? undefined : numValue) })
  }, [id, fadeIn, updateNode])

  const handleFadeOutChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFadeOut(e.target.value)
    },
    []
  )

  const handleFadeOutBlur = useCallback(() => {
    const numValue = parseFloat(fadeOut)
    updateNode(id, { fadeOut: fadeOut === '' ? undefined : (isNaN(numValue) ? undefined : numValue) })
  }, [id, fadeOut, updateNode])

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this node?')) {
      deleteNode(id)
    }
  }, [deleteNode, id])

  return (
    <div className="dialog-node dialog-node-music">
      <Handle type="target" position={Position.Top} />
      
      <div className="dialog-node-header">
        <span className="dialog-node-type">Set Music</span>
        <button 
          onClick={handleDelete} 
          className="dialog-node-delete" 
          title="Delete node"
        >
          ×
        </button>
      </div>
      
      <div className="dialog-node-content">
        <div className="dialog-node-field">
          <label>Music File:</label>
          <input
            type="text"
            value={musicFile}
            onChange={handleMusicFileChange}
            onBlur={handleMusicFileBlur}
            placeholder="music/theme.ogg"
            className="dialog-node-input"
          />
        </div>
        <div className="dialog-node-field">
          <label>Fade In (seconds):</label>
          <input
            type="number"
            value={fadeIn}
            onChange={handleFadeInChange}
            onBlur={handleFadeInBlur}
            placeholder="0"
            className="dialog-node-input"
            step="0.1"
          />
        </div>
        <div className="dialog-node-field">
          <label>Fade Out (seconds):</label>
          <input
            type="number"
            value={fadeOut}
            onChange={handleFadeOutChange}
            onBlur={handleFadeOutBlur}
            placeholder="0"
            className="dialog-node-input"
            step="0.1"
          />
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

