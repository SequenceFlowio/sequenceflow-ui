-- Make tenant ownership part of every commerce relationship. UUID primary keys
-- prevent accidental id collisions, while these composite foreign keys also
-- prevent a privileged server path from linking records across tenants.

CREATE UNIQUE INDEX IF NOT EXISTS uq_support_conversations_tenant_id
  ON support_conversations (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_support_decisions_tenant_conversation_id
  ON support_decisions (tenant_id, conversation_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_facts_tenant_id
  ON tenant_profile_facts (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_connections_tenant_id
  ON commerce_connections (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_orders_tenant_id
  ON commerce_orders (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_actions_tenant_id
  ON commerce_action_proposals (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_actions_tenant_decision_id
  ON commerce_action_proposals (tenant_id, decision_id, id);

ALTER TABLE profile_learning_events
  DROP CONSTRAINT IF EXISTS profile_learning_events_tenant_fact_fk,
  ADD CONSTRAINT profile_learning_events_tenant_fact_fk
    FOREIGN KEY (tenant_id, proposed_fact_id)
    REFERENCES tenant_profile_facts (tenant_id, id)
    ON DELETE SET NULL (proposed_fact_id);

ALTER TABLE commerce_orders
  DROP CONSTRAINT IF EXISTS commerce_orders_tenant_connection_fk,
  ADD CONSTRAINT commerce_orders_tenant_connection_fk
    FOREIGN KEY (tenant_id, connection_id)
    REFERENCES commerce_connections (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE commerce_order_items
  DROP CONSTRAINT IF EXISTS commerce_order_items_tenant_order_fk,
  ADD CONSTRAINT commerce_order_items_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE commerce_fulfillments
  DROP CONSTRAINT IF EXISTS commerce_fulfillments_tenant_order_fk,
  ADD CONSTRAINT commerce_fulfillments_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE conversation_entity_links
  DROP CONSTRAINT IF EXISTS conversation_entity_links_tenant_conversation_fk,
  DROP CONSTRAINT IF EXISTS conversation_entity_links_tenant_order_fk,
  ADD CONSTRAINT conversation_entity_links_tenant_conversation_fk
    FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES support_conversations (tenant_id, id)
    ON DELETE CASCADE,
  ADD CONSTRAINT conversation_entity_links_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE commerce_events
  DROP CONSTRAINT IF EXISTS commerce_events_tenant_connection_fk,
  DROP CONSTRAINT IF EXISTS commerce_events_tenant_order_fk,
  ADD CONSTRAINT commerce_events_tenant_connection_fk
    FOREIGN KEY (tenant_id, connection_id)
    REFERENCES commerce_connections (tenant_id, id)
    ON DELETE CASCADE,
  ADD CONSTRAINT commerce_events_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders (tenant_id, id)
    ON DELETE SET NULL (order_id);

ALTER TABLE commerce_action_proposals
  DROP CONSTRAINT IF EXISTS commerce_actions_tenant_conversation_fk,
  DROP CONSTRAINT IF EXISTS commerce_actions_tenant_decision_fk,
  DROP CONSTRAINT IF EXISTS commerce_actions_tenant_order_fk,
  ADD CONSTRAINT commerce_actions_tenant_conversation_fk
    FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES support_conversations (tenant_id, id)
    ON DELETE SET NULL (conversation_id),
  ADD CONSTRAINT commerce_actions_tenant_decision_fk
    FOREIGN KEY (tenant_id, conversation_id, decision_id)
    REFERENCES support_decisions (tenant_id, conversation_id, id)
    ON DELETE SET NULL (decision_id),
  ADD CONSTRAINT commerce_actions_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders (tenant_id, id)
    ON DELETE SET NULL (order_id);

ALTER TABLE commerce_action_executions
  DROP CONSTRAINT IF EXISTS commerce_executions_tenant_proposal_fk,
  ADD CONSTRAINT commerce_executions_tenant_proposal_fk
    FOREIGN KEY (tenant_id, proposal_id)
    REFERENCES commerce_action_proposals (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE operational_outcomes
  DROP CONSTRAINT IF EXISTS operational_outcomes_tenant_conversation_fk,
  DROP CONSTRAINT IF EXISTS operational_outcomes_tenant_order_fk,
  DROP CONSTRAINT IF EXISTS operational_outcomes_tenant_action_fk,
  ADD CONSTRAINT operational_outcomes_tenant_conversation_fk
    FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES support_conversations (tenant_id, id)
    ON DELETE SET NULL (conversation_id),
  ADD CONSTRAINT operational_outcomes_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders (tenant_id, id)
    ON DELETE SET NULL (order_id),
  ADD CONSTRAINT operational_outcomes_tenant_action_fk
    FOREIGN KEY (tenant_id, action_id)
    REFERENCES commerce_action_proposals (tenant_id, id)
    ON DELETE SET NULL (action_id);

ALTER TABLE case_memories
  DROP CONSTRAINT IF EXISTS case_memories_tenant_conversation_fk,
  ADD CONSTRAINT case_memories_tenant_conversation_fk
    FOREIGN KEY (tenant_id, source_conversation_id)
    REFERENCES support_conversations (tenant_id, id)
    ON DELETE SET NULL (source_conversation_id);

ALTER TABLE support_decisions
  DROP CONSTRAINT IF EXISTS support_decisions_tenant_blocking_action_fk,
  ADD CONSTRAINT support_decisions_tenant_blocking_action_fk
    FOREIGN KEY (tenant_id, id, blocking_action_id)
    REFERENCES commerce_action_proposals (tenant_id, decision_id, id)
    ON DELETE SET NULL (blocking_action_id);
