import { useCallback, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { DialogNode } from '../types/models'
import { useDialogStore } from '../store/dialogStore'
import './DialogNodeComponent.css'

interface SetVariableNodeData {
  node: DialogNode
}

export default function SetVariableNode({ data, id }: NodeProps<SetVariableNodeData>) {
  const { node } = data
  const { updateNode, deleteNode } = useDialogStore()
  const [variableName, setVariableName] = useState(node.variableName || '')
  const [variableValue, setVariableValue] = useState(node.variableValue?.toString() || '')

  useEffect(() => {
    setVariableName(node.variableName || '')
    setVariableValue(node.variableValue?.toString() || '')
  }, [node.variableName, node.variableValue])

  const handleVariableNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVariableName(e.target.value)
    },
    []
  )

  const handleVariableNameBlur = useCallback(() => {
    updateNode(id, { variableName: variableName || undefined })
  }, [id, variableName, updateNode])

  const handleVariableValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVariableValue(e.target.value)
    },
    []
  )

  const handleVariableValueBlur = useCallback(() => {
    const numValue = parseFloat(variableValue)
    updateNode(id, { 
      variableValue: variableValue === '' ? undefined : (isNaN(numValue) ? variableValue : numValue)
    })
  }, [id, variableValue, updateNode])

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this node?')) {
      deleteNode(id)
    }
  }, [deleteNode, id])

  return (
    <div className="dialog-node dialog-node-variable">
      <Handle type="target" position={Position.Top} />
      
      <div className="dialog-node-header">
        <span className="dialog-node-type">Set Variable</span>
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
          <label>Variable Name:</label>
          <input
            type="text"
            value={variableName}
            onChange={handleVariableNameChange}
            onBlur={handleVariableNameBlur}
            placeholder="variable_name"
            className="dialog-node-input"
          />
        </div>
        <div className="dialog-node-field">
          <label>Value:</label>
          <input
            type="text"
            value={variableValue}
            onChange={handleVariableValueChange}
            onBlur={handleVariableValueBlur}
            placeholder="0 or text"
            className="dialog-node-input"
          />
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

