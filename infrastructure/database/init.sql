-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active TIMESTAMP NOT NULL DEFAULT NOW(),
    challenge VARCHAR(512) NOT NULL,  -- Server challenge for key derivation
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, expired, terminated
    terminated_at TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'terminated'))
);

CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created ON sessions(created_at);

-- Audit logs (metadata only, NO content)
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,  -- sanitize_request, query_request, session_end
    metadata JSONB,  -- {pages: 3, entities: 12, latency_ms: 234}
    ip_address INET
);

CREATE INDEX idx_audit_session ON audit_logs(session_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_event ON audit_logs(event_type);

-- Rate limiting counters (in PostgreSQL, but Redis preferred)
CREATE TABLE rate_limits (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,  -- IP or session_id
    window_start TIMESTAMP NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(identifier, window_start)
);

CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier);

-- Sanitized outputs table
CREATE TABLE sanitized_outputs (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id),
    processing_id UUID NOT NULL,
    input_type VARCHAR(10) NOT NULL,
    tokenized_content TEXT NOT NULL,
    engine VARCHAR(50) NOT NULL DEFAULT 'gemini',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sanitized_processing ON sanitized_outputs(processing_id);
CREATE INDEX idx_sanitized_session ON sanitized_outputs(session_id);