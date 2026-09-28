package ws

func (s *Server) NotifyNodeDeleted(id int64) {
	if s != nil {
		s.broadcastTyped(id, "node_deleted", "")
	}
}

func (s *Server) DisconnectNode(id int64) {
	if s == nil {
		return
	}
	s.mu.RLock()
	node := s.nodes[id]
	s.mu.RUnlock()
	if node != nil {
		_ = node.conn.conn.Close()
	}
}
