import { useCallback, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { DialogNode } from '../types/models'
import { useDialogStore } from '../store/dialogStore'
import './DialogNodeComponent.css'

interface ChangeVariableNodeData {
  node: DialogNode
}

export default function ChangeVariableNode({ data, id }: NodeProps<ChangeVariableNodeData>) {
  const { node } = data
  const { updateNode, deleteNode } = useDialogStore()
  const [variableName, setVariableName] = useState(node.variableName || '')
  const [variableValue, setVariableValue] = useState(node.variableValue?.toString() || '0')

  useEffect(() => {
    setVariableName(node.variableName || '')
    setVariableValue(node.variableValue?.toString() || '0')
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

  const handleOperationChange = useCallback(
    (operation: 'add' | 'subtract') => {
      updateNode(id, { variableOperation: operation })
    },
    [id, updateNode]
  )

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVariableValue(e.target.value)
    },
    []
  )

  const handleValueBlur = useCallback(() => {
    const numValue = parseFloat(variableValue)
    updateNode(id, { 
      variableValue: isNaN(numValue) ? 0 : numValue 
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
        <span className="dialog-node-type">Change Variable</span>
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
          <label>Operation:</label>
          <select
            value={node.variableOperation || 'add'}
            onChange={(e) => handleOperationChange(e.target.value as 'add' | 'subtract')}
            className="dialog-node-select"
          >
            <option value="add">Add (+)</option>
            <option value="subtract">Subtract (-)</option>
          </select>
        </div>
        <div className="dialog-node-field">
          <label>Value:</label>
          <input
            type="number"
            value={variableValue}
            onChange={handleValueChange}
            onBlur={handleValueBlur}
            placeholder="0"
            className="dialog-node-input"
          />
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

