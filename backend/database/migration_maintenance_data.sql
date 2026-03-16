-- Maintenance Data table for storing categories, affected systems, priorities, etc.
CREATE TABLE IF NOT EXISTS maintenance_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('category', 'affected_system', 'priority', 'incident_category', 'severity', 'ticket_status', 'incident_status')),
  value VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(type, value)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_data_type ON maintenance_data(type);

-- Insert default values
INSERT INTO maintenance_data (type, value) VALUES
  -- Affected Systems
  ('affected_system', 'Windows 11'),
  ('affected_system', 'Viber'),
  ('affected_system', 'Wi-Fi Network'),
  ('affected_system', 'LAN'),
  ('affected_system', 'Desktop'),
  ('affected_system', 'Laptop'),
  ('affected_system', 'Printer'),
  -- Categories
  ('category', 'Hardware'),
  ('category', 'Software'),
  ('category', 'Network'),
  ('category', 'Peripheral'),
  -- Priorities
  ('priority', 'Low'),
  ('priority', 'Medium'),
  ('priority', 'High'),
  ('priority', 'Urgent'),
  -- Incident Categories
  ('incident_category', 'Phishing'),
  ('incident_category', 'Malware'),
  ('incident_category', 'Unauthorized Access'),
  ('incident_category', 'Data Exposure'),
  ('incident_category', 'Policy Violation'),
  ('incident_category', 'System Compromise'),
  ('incident_category', 'Other'),
  -- Severities
  ('severity', 'Low'),
  ('severity', 'Medium'),
  ('severity', 'High'),
  ('severity', 'Critical'),
  -- Ticket Statuses
  ('ticket_status', 'New'),
  ('ticket_status', 'Assigned'),
  ('ticket_status', 'In Progress'),
  ('ticket_status', 'Waiting for User'),
  ('ticket_status', 'Resolved'),
  ('ticket_status', 'Closed'),
  ('ticket_status', 'Converted to Incident'),
  -- Incident Statuses
  ('incident_status', 'New'),
  ('incident_status', 'Triaged'),
  ('incident_status', 'Investigating'),
  ('incident_status', 'Contained'),
  ('incident_status', 'Recovered'),
  ('incident_status', 'Closed')
ON CONFLICT (type, value) DO NOTHING;
