import { useCallback, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { DialogNode } from '../types/models'
import { useDialogStore } from '../store/dialogStore'
import './DialogNodeComponent.css'

interface SoundPlayNodeData {
  node: DialogNode
}

export default function SoundPlayNode({ data, id }: NodeProps<SoundPlayNodeData>) {
  const { node } = data
  const { updateNode, deleteNode } = useDialogStore()
  const [soundFile, setSoundFile] = useState(node.soundFile || '')

  useEffect(() => {
    setSoundFile(node.soundFile || '')
  }, [node.soundFile])

  const handleSoundFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSoundFile(e.target.value)
    },
    []
  )

  const handleSoundFileBlur = useCallback(() => {
    updateNode(id, { soundFile: soundFile || undefined })
  }, [id, soundFile, updateNode])

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this node?')) {
      deleteNode(id)
    }
  }, [deleteNode, id])

  return (
    <div className="dialog-node dialog-node-sound">
      <Handle type="target" position={Position.Top} />
      
      <div className="dialog-node-header">
        <span className="dialog-node-type">Play Sound</span>
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
          <label>Sound File:</label>
          <input
            type="text"
            value={soundFile}
            onChange={handleSoundFileChange}
            onBlur={handleSoundFileBlur}
            placeholder="sound/click.ogg"
            className="dialog-node-input"
          />
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

