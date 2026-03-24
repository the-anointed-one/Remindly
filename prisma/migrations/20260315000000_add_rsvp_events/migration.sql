-- Add event-level RSVP event log table
CREATE TABLE IF NOT EXISTS rsvp_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    response TEXT NOT NULL,
    channel TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT fk_rsvp_events_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_rsvp_events_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_rsvp_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rsvp_events_event_id ON rsvp_events(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_events_contact_id ON rsvp_events(contact_id);

-- event_participants enhancement
ALTER TABLE event_participants
    ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants(event_id);
