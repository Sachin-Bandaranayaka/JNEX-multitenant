// src/app/(superadmin)/superadmin/hierarchy/custom-node.tsx
'use client';

import { Handle, Position } from 'reactflow';

// This component receives data for a single node, including our custom color
export function CustomNode({ data }: { data: { label: string; color: string } }) {
  return (
    <>
      {/* This Handle is the connection point for incoming lines */}
      <Handle type="target" position={Position.Top} />
      
      {/* This is the custom styled node */}
      <div
        style={{
          background: `${data.color}1f`, // Apply light tint for the background
          borderColor: data.color,      // Apply full color for the border
        }}
        className="px-4 py-2 shadow-md rounded-md border-2"
      >
        <div className="text-sm font-bold text-slate-900">{data.label}</div>
      </div>
      
      {/* This Handle is the connection point for outgoing lines */}
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}