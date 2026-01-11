import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionState, NodeState, Packet, PacketFlag, LogEntry } from './types';
import ProtocolLog from './components/ProtocolLog';
import NetworkSpace from './components/NetworkSpace';
import { analyzePacket, generateSecurePayload } from './services/geminiService';
import { GoogleGenAI } from "@google/genai";

// Constants
const INITIAL_SEQ = 100;
const INITIAL_SERVER_SEQ = 5000;
const LATENCY_MS = 3000;

function App() {
  // --- State ---
  const [client, setClient] = useState<NodeState>({
    role: 'CLIENT',
    connectionState: ConnectionState.CLOSED,
    seq: INITIAL_SEQ,
    lastAckReceived: 0,
    sessionId: null,
    logs: [],
  });

  const [server, setServer] = useState<NodeState>({
    role: 'SERVER',
    connectionState: ConnectionState.LISTEN,
    seq: INITIAL_SERVER_SEQ,
    lastAckReceived: 0,
    sessionId: null,
    logs: [],
  });

  const [packets, setPackets] = useState<Packet[]>([]);
  const [geminiAnalysis, setGeminiAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Audio refs for sound effects (simulated/conceptual)
  // We won't implement actual audio to keep it simple, but the hooks are here.

  // --- Helpers ---
  const addLog = (role: 'CLIENT' | 'SERVER', message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      type
    };

    if (role === 'CLIENT') {
      setClient(prev => ({ ...prev, logs: [...prev.logs, entry] }));
    } else {
      setServer(prev => ({ ...prev, logs: [...prev.logs, entry] }));
    }
  };

  const sendPacket = (from: 'CLIENT' | 'SERVER', flag: PacketFlag, payload: string = '', overrideSeq?: number, overrideAck?: number) => {
    const sender = from === 'CLIENT' ? client : server;
    const receiverRole = from === 'CLIENT' ? 'SERVER' : 'CLIENT';
    
    // Determine Sequence and Ack numbers
    const seq = overrideSeq !== undefined ? overrideSeq : sender.seq;
    const ack = overrideAck !== undefined ? overrideAck : sender.lastAckReceived;
    
    const newPacket: Packet = {
      id: Math.random().toString(36).substring(7),
      source: from,
      destination: receiverRole,
      flag,
      seq,
      ack,
      payload,
      sessionId: sender.sessionId || undefined,
      timestamp: Date.now(),
    };

    setPackets(prev => [...prev, newPacket]);
    addLog(from, `Sent ${flag} (Seq=${seq} Ack=${ack})`, 'traffic');

    // Analyze specific packets automatically with Gemini if interesting
    if (flag === PacketFlag.SYN || flag === PacketFlag.SYN_ACK) {
       handleAnalyzePacket(newPacket, sender.connectionState);
    }

    // Advance sequence number for SYN and FIN and DATA
    if (flag === PacketFlag.SYN || flag === PacketFlag.FIN || flag === PacketFlag.DATA || flag === PacketFlag.SYN_ACK) {
      if (from === 'CLIENT') {
          setClient(prev => ({ ...prev, seq: prev.seq + 1 }));
      } else {
          setServer(prev => ({ ...prev, seq: prev.seq + 1 }));
      }
    }
  };

  const handleDropPacket = (id: string) => {
    setPackets(prev => prev.filter(p => p.id !== id));
    // Determine who lost it for a global log
    const pkt = packets.find(p => p.id === id);
    if(pkt) addLog(pkt.source, `Packet ${pkt.flag} lost/dropped in transit!`, 'error');
  };

  const handleAnalyzePacket = async (packet: Packet, state: ConnectionState) => {
    setIsAnalyzing(true);
    setGeminiAnalysis("Analyzing packet signature...");
    const result = await analyzePacket(packet, state);
    setGeminiAnalysis(result);
    setIsAnalyzing(false);
  };

  // --- Core Protocol Logic (Packet Arrival) ---
  const processPacketArrival = useCallback((packet: Packet) => {
    // Remove packet from flight
    setPackets(prev => prev.filter(p => p.id !== packet.id));

    const receiver = packet.destination === 'CLIENT' ? client : server;
    const senderRole = packet.source;
    
    addLog(receiver.role, `Received ${packet.flag} (Seq=${packet.seq})`, 'traffic');

    // SERVER STATE MACHINE
    if (receiver.role === 'SERVER') {
      if (server.connectionState === ConnectionState.LISTEN) {
        if (packet.flag === PacketFlag.SYN) {
          addLog('SERVER', 'SYN received. Initiating Handshake.', 'success');
          // Generate Session ID
          const newSessionId = "SES-" + Math.random().toString(36).substring(2, 8).toUpperCase();
          setServer(prev => ({ 
            ...prev, 
            connectionState: ConnectionState.SYN_RCVD, 
            lastAckReceived: packet.seq + 1, // Expecting next byte
            sessionId: newSessionId
          }));
          
          // Send SYN-ACK
          // Delay slightly to ensure state update processes before reading it in sendPacket
          setTimeout(() => {
              // We need to access the NEW server state, so we pass overrides or functional updates. 
              // For simplicity in this React implementation, we just pass values calculated here.
              // Note: In a real app we'd use a reducer or refs to avoid stale closures.
              // We will invoke sendPacket via a useEffect or direct helper that doesn't rely on stale closure if possible,
              // but here we manually trigger the response logic.
              
              // We need to send SYN-ACK. Server Seq is INITIAL_SERVER_SEQ. Ack is Packet.Seq + 1.
              // We use a functional update on the packet queue inside sendPacket, so that's safe.
              // But we need to update server state seq.
              
              // Actually, sendPacket reads state. To avoid race conditions in this simulated function,
              // we will implement a "Responder" effect.
          }, 100);
        }
      } else if (server.connectionState === ConnectionState.SYN_RCVD) {
        if (packet.flag === PacketFlag.ACK && packet.ack === server.seq) { // Acking the SYN-ACK (Seq was incremented)
             addLog('SERVER', 'ACK received. Connection ESTABLISHED.', 'success');
             setServer(prev => ({ ...prev, connectionState: ConnectionState.ESTABLISHED }));
        }
      } else if (server.connectionState === ConnectionState.ESTABLISHED) {
          if (packet.flag === PacketFlag.DATA) {
              addLog('SERVER', `Data Processed: ${packet.payload}`, 'success');
              // Auto-ACK data
              setServer(prev => ({...prev, lastAckReceived: packet.seq + 1}));
              // Send ACK
          } else if (packet.flag === PacketFlag.FIN) {
              addLog('SERVER', 'FIN received. Closing connection.', 'warning');
              setServer(prev => ({ ...prev, connectionState: ConnectionState.CLOSED, sessionId: null }));
              // Ideally send FIN-ACK, but simplifying to close.
          }
      }
    }

    // CLIENT STATE MACHINE
    if (receiver.role === 'CLIENT') {
      if (client.connectionState === ConnectionState.SYN_SENT) {
        if (packet.flag === PacketFlag.SYN_ACK) {
          addLog('CLIENT', 'SYN-ACK received. Session: ' + packet.sessionId, 'success');
          setClient(prev => ({ 
            ...prev, 
            connectionState: ConnectionState.ESTABLISHED, 
            lastAckReceived: packet.seq + 1,
            sessionId: packet.sessionId || null
          }));
        }
      } else if (client.connectionState === ConnectionState.ESTABLISHED) {
         if (packet.flag === PacketFlag.ACK) {
             addLog('CLIENT', 'Data/Packet Acknowledged by Server.', 'success');
         }
      }
    }

  }, [client, server]);


  // --- Simulation Loop & Automated Responses ---
  // This effect handles the "Travel Time" and triggers arrival
  useEffect(() => {
    const timer = setInterval(() => {
      setPackets(currentPackets => {
        const now = Date.now();
        const arrivedPackets = currentPackets.filter(p => now - p.timestamp > LATENCY_MS);
        const keepingPackets = currentPackets.filter(p => now - p.timestamp <= LATENCY_MS);

        if (arrivedPackets.length > 0) {
          // We must handle effects outside the state setter to avoid side-effects in render
          // But we can't easily trigger the `processPacketArrival` here because of closure scope on client/server state.
          // Solution: Use a separate effect that watches `arrivedQueue`.
          // For now, let's just use a ref or simplified approach.
          // We will clear them here, and handle them in the next useEffect.
        }
        return currentPackets; // This interval is purely for forcing re-renders if we were animating JS. 
                               // CSS handles animation. Logic uses Timeouts.
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Use timeouts for packet arrival logic to ensure they hit the latest state
  useEffect(() => {
    if (packets.length === 0) return;

    packets.forEach(pkt => {
       // We only want to set a timeout ONCE per packet.
       // In a real game loop this is different, but for React:
       // We attach a property to the packet or use a ref Set to track scheduled arrivals.
    });
  }, [packets]);

  // Better approach: When a packet is added, schedule its arrival.
  const schedulePacketArrival = (packet: Packet) => {
      setTimeout(() => {
          // Check if it was dropped
          setPackets(current => {
              const exists = current.find(p => p.id === packet.id);
              if (exists) {
                  processPacketArrival(packet);
                  return current; // The processing removes it usually, or we return current and let process remove it
              }
              return current;
          });
      }, LATENCY_MS);
  };

  // Modify sendPacket to call schedule
  const sendPacketWithSchedule = (from: 'CLIENT' | 'SERVER', flag: PacketFlag, payload: string = '', overrideSeq?: number, overrideAck?: number) => {
    // Logic duplicated from sendPacket to capture the packet object
    const sender = from === 'CLIENT' ? client : server;
    const receiverRole = from === 'CLIENT' ? 'SERVER' : 'CLIENT';
    const seq = overrideSeq !== undefined ? overrideSeq : sender.seq;
    const ack = overrideAck !== undefined ? overrideAck : sender.lastAckReceived;
    
    // Server logic for handshake response needs specific SEQ/ACK handling
    // If Server Sending SYN-ACK: Seq = ServerSeq, Ack = ClientSeq+1
    
    const newPacket: Packet = {
      id: Math.random().toString(36).substring(7),
      source: from,
      destination: receiverRole,
      flag,
      seq,
      ack,
      payload,
      sessionId: sender.sessionId || undefined,
      timestamp: Date.now(),
    };

    setPackets(prev => [...prev, newPacket]);
    addLog(from, `Sent ${flag} (Seq=${seq} Ack=${ack})`, 'traffic');

    if (flag === PacketFlag.SYN || flag === PacketFlag.SYN_ACK) {
       handleAnalyzePacket(newPacket, sender.connectionState);
    }

    // State Updates
    if (flag === PacketFlag.SYN || flag === PacketFlag.FIN || flag === PacketFlag.DATA || flag === PacketFlag.SYN_ACK) {
      if (from === 'CLIENT') setClient(prev => ({ ...prev, seq: prev.seq + 1 }));
      else setServer(prev => ({ ...prev, seq: prev.seq + 1 }));
    }

    schedulePacketArrival(newPacket);
  };

  // Automated Responses (The "Protocol Implementation" running on the nodes)
  // We use an effect that watches the logs or last received to trigger the automatic protocol replies
  useEffect(() => {
      // Server Logic: Reply to SYN with SYN-ACK
      if (server.connectionState === ConnectionState.SYN_RCVD && packets.length === 0) {
          // Check if we just entered this state and haven't replied yet?
          // This is tricky in React. simpler: do it in processPacketArrival
      }
  }, [server.connectionState]);
  
  // Refactoring processPacketArrival to handle automated replies immediately
  // We need to override the previous processPacketArrival to actually trigger the next send
  
  const processPacketArrivalRef = useRef(processPacketArrival);
  processPacketArrivalRef.current = (packet: Packet) => {
      setPackets(prev => prev.filter(p => p.id !== packet.id));
      const receiver = packet.destination === 'CLIENT' ? client : server;
      addLog(receiver.role, `Received ${packet.flag}`, 'traffic');

      // --- SERVER LOGIC ---
      if (receiver.role === 'SERVER') {
          if (packet.flag === PacketFlag.SYN && server.connectionState === ConnectionState.LISTEN) {
              const newSessionId = "SES-" + Math.floor(Math.random()*10000);
              addLog('SERVER', 'SYN Valid. Allocating Session ' + newSessionId, 'success');
              
              setServer(prev => ({ 
                  ...prev, 
                  connectionState: ConnectionState.SYN_RCVD, 
                  lastAckReceived: packet.seq + 1,
                  sessionId: newSessionId
              }));

              // AUTO REPLY: SYN-ACK
              setTimeout(() => {
                  sendPacketWithSchedule('SERVER', PacketFlag.SYN_ACK, '', undefined, packet.seq + 1);
              }, 500); // Processing delay
          }
          else if (packet.flag === PacketFlag.ACK && server.connectionState === ConnectionState.SYN_RCVD) {
              addLog('SERVER', 'Handshake Completed.', 'success');
              setServer(prev => ({ ...prev, connectionState: ConnectionState.ESTABLISHED }));
          }
          else if (packet.flag === PacketFlag.DATA && server.connectionState === ConnectionState.ESTABLISHED) {
             // ACK Data
             setServer(prev => ({...prev, lastAckReceived: packet.seq + 1}));
             setTimeout(() => {
                 sendPacketWithSchedule('SERVER', PacketFlag.ACK, '', undefined, packet.seq + 1);
             }, 300);
          }
          else if (packet.flag === PacketFlag.FIN) {
              setServer(prev => ({ ...prev, connectionState: ConnectionState.CLOSED, sessionId: null }));
              addLog('SERVER', 'Connection Reset/Closed', 'warning');
          }
      }

      // --- CLIENT LOGIC ---
      if (receiver.role === 'CLIENT') {
          if (packet.flag === PacketFlag.SYN_ACK && client.connectionState === ConnectionState.SYN_SENT) {
              addLog('CLIENT', 'Server Accepted. Sending Final ACK.', 'success');
              setClient(prev => ({
                  ...prev,
                  connectionState: ConnectionState.ESTABLISHED,
                  lastAckReceived: packet.seq + 1,
                  sessionId: packet.sessionId || null
              }));

              // AUTO REPLY: ACK
              setTimeout(() => {
                  sendPacketWithSchedule('CLIENT', PacketFlag.ACK, '', undefined, packet.seq + 1);
              }, 200);
          }
          else if (packet.flag === PacketFlag.ACK && client.connectionState === ConnectionState.ESTABLISHED) {
              // Just a data ack
          }
      }
  };

  // The actual exposed wrapper that calls the ref (to break cyclic dependency)
  const handleArrival = (p: Packet) => processPacketArrivalRef.current(p);

  // Re-bind schedule to use the new handleArrival
  const schedulePacketArrivalRef = useRef<(p: Packet) => void>(() => {});
  schedulePacketArrivalRef.current = (packet: Packet) => {
      setTimeout(() => {
          setPackets(current => {
              const exists = current.find(p => p.id === packet.id);
              if (exists) {
                  handleArrival(packet); 
              }
              return current;
          });
      }, LATENCY_MS);
  };

  // --- User Actions ---

  const handleConnect = () => {
      if (client.connectionState !== ConnectionState.CLOSED) return;
      setClient(prev => ({ ...prev, connectionState: ConnectionState.SYN_SENT }));
      sendPacketWithSchedule('CLIENT', PacketFlag.SYN);
  };

  const handleDisconnect = () => {
      sendPacketWithSchedule('CLIENT', PacketFlag.FIN);
      setClient(prev => ({ ...prev, connectionState: ConnectionState.CLOSED, sessionId: null }));
  };

  const handleSendData = async () => {
      if (client.connectionState !== ConnectionState.ESTABLISHED) return;
      const payload = await generateSecurePayload();
      sendPacketWithSchedule('CLIENT', PacketFlag.DATA, payload);
  };


  return (
    <div className="min-h-screen flex flex-col p-4 bg-slate-950 text-slate-200">
      <header className="mb-6 flex justify-between items-end border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            SCTP SIMULATOR
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Secure Custom Transport Protocol • UDP-Based • Connection Oriented
          </p>
        </div>
        <div className="text-right">
             <div className="text-xs text-slate-500 font-mono">GEMINI ANALYZER</div>
             <div className={`text-xs font-mono max-w-md ${isAnalyzing ? 'animate-pulse text-yellow-500' : 'text-slate-400'}`}>
               {geminiAnalysis || "Ready to analyze packets..."}
             </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* CLIENT NODE */}
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-lg bg-slate-900 border border-blue-900/50 shadow-lg shadow-blue-900/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-blue-400">CLIENT NODE</h2>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                client.connectionState === ConnectionState.ESTABLISHED ? 'bg-green-900 text-green-300' : 
                client.connectionState === ConnectionState.CLOSED ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
              }`}>
                {client.connectionState}
              </span>
            </div>
            
            <div className="space-y-2 font-mono text-sm mb-6 text-slate-400">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Session ID:</span> <span className="text-slate-200">{client.sessionId || '---'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Sequence #:</span> <span className="text-slate-200">{client.seq}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Last Ack Rx:</span> <span className="text-slate-200">{client.lastAckReceived}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handleConnect}
                disabled={client.connectionState !== ConnectionState.CLOSED}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded font-bold transition-colors"
              >
                INIT HANDSHAKE
              </button>
              <button 
                onClick={handleDisconnect}
                disabled={client.connectionState === ConnectionState.CLOSED}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded font-bold transition-colors"
              >
                DISCONNECT
              </button>
              <button 
                onClick={handleSendData}
                disabled={client.connectionState !== ConnectionState.ESTABLISHED}
                className="col-span-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>SEND SECURE DATA</span>
                {client.connectionState === ConnectionState.ESTABLISHED && <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>}
              </button>
            </div>
          </div>
          <ProtocolLog logs={client.logs} title="CLIENT" />
        </div>

        {/* NETWORK & VISUALIZATION */}
        <div className="flex flex-col justify-center">
            <div className="text-center mb-2">
                <span className="text-xs uppercase tracking-widest text-slate-500">Visualization</span>
            </div>
            <NetworkSpace packets={packets} onDropPacket={handleDropPacket} />
            
            <div className="bg-slate-900 p-4 rounded-md border border-slate-800 text-xs text-slate-400 font-mono space-y-2">
                <p className="font-bold text-slate-300 mb-2">PROTOCOL SPEC:</p>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-amber-900 border border-amber-500 block"></span> SYN: Synchonize Seq #
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-900 border border-emerald-500 block"></span> SYN-ACK: Confirm & Synch
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-900 border border-blue-500 block"></span> ACK: Acknowledge Receipt
                </div>
                <p className="mt-4 italic opacity-75">
                    * Click packets in transit to simulate UDP packet loss (Simulates DDoS or bad connection).
                </p>
            </div>
        </div>

        {/* SERVER NODE */}
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-lg bg-slate-900 border border-emerald-900/50 shadow-lg shadow-emerald-900/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-emerald-400">SERVER NODE</h2>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                server.connectionState === ConnectionState.ESTABLISHED ? 'bg-green-900 text-green-300' : 
                server.connectionState === ConnectionState.LISTEN ? 'bg-blue-900 text-blue-300' : 'bg-yellow-900 text-yellow-300'
              }`}>
                {server.connectionState}
              </span>
            </div>
            
            <div className="space-y-2 font-mono text-sm mb-6 text-slate-400">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Session ID:</span> <span className="text-slate-200">{server.sessionId || 'WAITING...'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Sequence #:</span> <span className="text-slate-200">{server.seq}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Last Ack Rx:</span> <span className="text-slate-200">{server.lastAckReceived}</span>
              </div>
            </div>

            <div className="h-20 flex items-center justify-center border border-dashed border-slate-700 rounded bg-slate-950/50">
               <span className="text-slate-600 text-sm">Listening on UDP:8080...</span>
            </div>
          </div>
          <ProtocolLog logs={server.logs} title="SERVER" />
        </div>

      </div>
    </div>
  );
}

export default App;
