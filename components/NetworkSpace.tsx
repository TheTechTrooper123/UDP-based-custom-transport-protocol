import React from 'react';
import { Packet, PacketFlag } from '../types';

interface NetworkSpaceProps {
  packets: Packet[];
  onDropPacket: (id: string) => void;
}

const NetworkSpace: React.FC<NetworkSpaceProps> = ({ packets, onDropPacket }) => {
  return (
    <div className="relative h-48 w-full bg-slate-950/50 border-y border-slate-800 my-4 overflow-hidden flex items-center justify-center">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10" 
           style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>
      
      <div className="absolute top-2 left-2 text-slate-600 text-xs font-mono uppercase tracking-widest">
        Unreliable UDP Layer simulation
      </div>

      {packets.map((pkt) => {
        // Calculate position direction based on source
        const isClientSource = pkt.source === 'CLIENT';
        
        return (
          <div
            key={pkt.id}
            className={`absolute top-1/2 transform -translate-y-1/2 transition-all duration-[2000ms] ease-linear cursor-pointer group`}
            style={{
              left: isClientSource ? '10%' : '90%', 
               // In a real animation engine we'd track progress, but for React simple state transition:
               // We will rely on the parent moving it to a "arrived" state or CSS animation triggers.
               // However, for this sim, we might use a keyframe class applied dynamically.
              animation: isClientSource ? 'travelRight 3s linear forwards' : 'travelLeft 3s linear forwards',
            }}
            onClick={() => onDropPacket(pkt.id)}
          >
            <div className={`relative px-4 py-2 rounded border shadow-[0_0_15px_rgba(0,0,0,0.5)] 
              ${pkt.flag === PacketFlag.SYN || pkt.flag === PacketFlag.SYN_ACK ? 'bg-amber-900/80 border-amber-500 text-amber-200 shadow-amber-900/50' : 
                pkt.flag === PacketFlag.ACK ? 'bg-blue-900/80 border-blue-500 text-blue-200 shadow-blue-900/50' : 
                pkt.flag === PacketFlag.FIN ? 'bg-red-900/80 border-red-500 text-red-200 shadow-red-900/50' :
                'bg-emerald-900/80 border-emerald-500 text-emerald-200 shadow-emerald-900/50'
              }
            `}>
              <div className="text-xs font-bold text-center">{pkt.flag}</div>
              <div className="text-[10px] opacity-75">SEQ:{pkt.seq} ACK:{pkt.ack}</div>
              
              {/* Drop interaction overlay */}
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Click to DROP
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes travelRight {
          0% { left: 10%; opacity: 0; transform: scale(0.8) translateY(-50%); }
          10% { opacity: 1; transform: scale(1) translateY(-50%); }
          90% { opacity: 1; transform: scale(1) translateY(-50%); }
          100% { left: 90%; opacity: 0; transform: scale(0.8) translateY(-50%); }
        }
        @keyframes travelLeft {
          0% { left: 90%; opacity: 0; transform: scale(0.8) translateY(-50%); }
          10% { opacity: 1; transform: scale(1) translateY(-50%); }
          90% { opacity: 1; transform: scale(1) translateY(-50%); }
          100% { left: 10%; opacity: 0; transform: scale(0.8) translateY(-50%); }
        }
      `}</style>
    </div>
  );
};

export default NetworkSpace;
