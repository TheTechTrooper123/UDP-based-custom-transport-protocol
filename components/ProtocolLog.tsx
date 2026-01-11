import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface ProtocolLogProps {
  logs: LogEntry[];
  title: string;
}

const ProtocolLog: React.FC<ProtocolLogProps> = ({ logs, title }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-64 bg-slate-900 border border-slate-700 rounded-md overflow-hidden font-mono text-xs">
      <div className="bg-slate-800 px-3 py-1 border-b border-slate-700 font-bold text-slate-300 flex justify-between items-center">
        <span>{title} TERMINAL</span>
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {logs.length === 0 && <span className="text-slate-600 italic">No activity...</span>}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-slate-500 flex-shrink-0">[{log.timestamp}]</span>
            <span className={`${
              log.type === 'error' ? 'text-red-400' :
              log.type === 'success' ? 'text-green-400' :
              log.type === 'traffic' ? 'text-blue-400' :
              log.type === 'warning' ? 'text-yellow-400' :
              'text-slate-300'
            }`}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default ProtocolLog;
