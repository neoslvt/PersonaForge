import { useCallback, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { DialogNode } from '../types/models'
import { useDialogStore } from '../store/dialogStore'
import './DialogNodeComponent.css'

interface SceneDescriptionNodeData {
  node: DialogNode
}

export default function SceneDescriptionNode({ data, id }: NodeProps<SceneDescriptionNodeData>) {
  const { node } = data
  const { updateNode, deleteNode } = useDialogStore()
  const [description, setDescription] = useState(node.text || '')

  useEffect(() => {
    setDescription(node.text || '')
  }, [node.text])

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value)
    },
    []
  )

  const handleDescriptionBlur = useCallback(() => {
    updateNode(id, { text: description })
  }, [id, description, updateNode])

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this node?')) {
      deleteNode(id)
    }
  }, [deleteNode, id])

  return (
    <div className="dialog-node dialog-node-scene">
      <Handle type="target" position={Position.Top} />
      
      <div className="dialog-node-header">
        <span className="dialog-node-type">Scene Description</span>
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
          <label>Description:</label>
          <textarea
            value={description}
            onChange={handleDescriptionChange}
            onBlur={handleDescriptionBlur}
            placeholder="Describe the scene, environment, or current situation..."
            className="dialog-node-textarea"
            rows={4}
          />
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

