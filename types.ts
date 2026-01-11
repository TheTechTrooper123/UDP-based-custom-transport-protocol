export enum ConnectionState {
  CLOSED = 'CLOSED',
  LISTEN = 'LISTEN',
  SYN_SENT = 'SYN_SENT',
  SYN_RCVD = 'SYN_RCVD',
  ESTABLISHED = 'ESTABLISHED',
  FIN_WAIT = 'FIN_WAIT',
}

export enum PacketFlag {
  NONE = 'NONE',
  SYN = 'SYN',
  ACK = 'ACK',
  SYN_ACK = 'SYN-ACK',
  FIN = 'FIN',
  RST = 'RST',
  DATA = 'DATA',
}

export interface Packet {
  id: string;
  source: 'CLIENT' | 'SERVER';
  destination: 'CLIENT' | 'SERVER';
  flag: PacketFlag;
  seq: number;
  ack: number;
  payload: string;
  sessionId?: string;
  timestamp: number;
  dropped?: boolean; // For simulation purposes
}

export interface NodeState {
  role: 'CLIENT' | 'SERVER';
  connectionState: ConnectionState;
  seq: number;
  lastAckReceived: number;
  sessionId: string | null;
  logs: LogEntry[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'traffic';
}
