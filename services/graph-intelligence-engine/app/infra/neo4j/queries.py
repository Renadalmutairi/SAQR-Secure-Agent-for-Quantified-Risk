UPSERT_TOPOLOGY = """
MERGE (sender:Account {account_id: $sender_account_id})
MERGE (receiver:Account {account_id: $receiver_account_id})
MERGE (tx:Transaction {tx_id: $tx_id})
  ON CREATE SET tx.tx_type = $tx_type, tx.amount = $amount, tx.occurred_at = datetime($occurred_at)
MERGE (sender)-[:INITIATED]->(tx)
MERGE (tx)-[:RECEIVED_BY]->(receiver)
MERGE (sender)-[edge:TRANSFERS_TO]->(receiver)
"""
# Deliberately no ON CREATE SET here: edge stored-properties are initialized
# exactly once, by next_edge_properties_for_transaction(previous=None, ...) in
# Python. If this Cypher also pre-set interaction_count=0 etc, the edge would
# already have non-null properties by the time get_edge_stored_properties runs,
# so it would never look "new" - first_seen would never get set at all.

GET_EDGE_PROPERTIES = """
MATCH (:Account {account_id: $sender_account_id})-[edge:TRANSFERS_TO]->(:Account {account_id: $receiver_account_id})
RETURN edge.interaction_count AS interaction_count, edge.total_amount AS total_amount,
       edge.first_seen AS first_seen, edge.last_seen AS last_seen,
       edge.behavioral_similarity_ewma AS behavioral_similarity_ewma,
       edge.behavioral_confidence_ewma AS behavioral_confidence_ewma,
       edge.behavioral_risk_ewma AS behavioral_risk_ewma,
       edge.gap_count AS gap_count, edge.gap_mean AS gap_mean, edge.gap_m2 AS gap_m2,
       edge.amount_log_count AS amount_log_count, edge.amount_log_mean AS amount_log_mean,
       edge.amount_log_m2 AS amount_log_m2
"""

WRITE_EDGE_PROPERTIES = """
MATCH (:Account {account_id: $sender_account_id})-[edge:TRANSFERS_TO]->(:Account {account_id: $receiver_account_id})
SET edge.interaction_count = $interaction_count, edge.total_amount = $total_amount,
    edge.first_seen = datetime($first_seen), edge.last_seen = datetime($last_seen),
    edge.behavioral_similarity_ewma = $behavioral_similarity_ewma,
    edge.behavioral_confidence_ewma = $behavioral_confidence_ewma,
    edge.behavioral_risk_ewma = $behavioral_risk_ewma,
    edge.gap_count = $gap_count, edge.gap_mean = $gap_mean, edge.gap_m2 = $gap_m2,
    edge.amount_log_count = $amount_log_count, edge.amount_log_mean = $amount_log_mean,
    edge.amount_log_m2 = $amount_log_m2
"""

APPLY_CUSTOMER_SNAPSHOT = """
MERGE (customer:Customer {customer_id: $customer_id})
SET customer.behavioral_risk_score = $behavioral_risk_score,
    customer.confidence_score = $confidence_score,
    customer.similarity_score = $similarity_score,
    customer.profile_version = $profile_version,
    customer.behavioral_updated_at = datetime($behavioral_updated_at)
WITH customer
MERGE (account:Account {account_id: $account_id})
MERGE (customer)-[:OWNS]->(account)
"""

LOCAL_DEGREE_STATS = """
MATCH (a:Account {account_id: $account_id})
OPTIONAL MATCH (a)-[out:TRANSFERS_TO]->(:Account)
WITH a, count(out) AS fan_out, sum(coalesce(out.total_amount, 0.0)) AS out_weight
OPTIONAL MATCH (:Account)-[in:TRANSFERS_TO]->(a)
WITH fan_out, out_weight, count(in) AS fan_in, sum(coalesce(in.total_amount, 0.0)) AS in_weight
RETURN fan_in, fan_out, (fan_in + fan_out) AS degree, (in_weight + out_weight) AS weighted_degree
"""

LOCAL_CLUSTERING_COEFFICIENT = """
MATCH (a:Account {account_id: $account_id})-[:TRANSFERS_TO]-(neighbor:Account)
WITH DISTINCT neighbor.account_id AS nid
WITH collect(nid) AS neighbor_ids
WITH neighbor_ids, size(neighbor_ids) AS k
CALL {
  WITH neighbor_ids
  UNWIND neighbor_ids AS n1
  UNWIND neighbor_ids AS n2
  WITH n1, n2 WHERE n1 < n2
  MATCH (x:Account {account_id: n1})-[:TRANSFERS_TO]-(y:Account {account_id: n2})
  RETURN count(*) AS triangle_edges
}
RETURN k,
       CASE WHEN k > 1 THEN toFloat(triangle_edges) / (toFloat(k) * (k - 1) / 2.0) ELSE 0.0 END AS clustering_coefficient
"""

SHARED_BENEFICIARY_COUNT = """
MATCH (a:Account {account_id: $account_id})-[:TRANSFERS_TO]->(receiver:Account)
MATCH (other:Account)-[:TRANSFERS_TO]->(receiver)
WHERE other.account_id <> $account_id
RETURN count(DISTINCT other.account_id) AS shared_beneficiary_count
"""

GET_OUTGOING_EDGE_PROPERTIES = """
MATCH (:Account {account_id: $account_id})-[edge:TRANSFERS_TO]->(:Account)
RETURN edge.interaction_count AS interaction_count, edge.total_amount AS total_amount,
       edge.first_seen AS first_seen, edge.last_seen AS last_seen,
       edge.behavioral_similarity_ewma AS behavioral_similarity_ewma,
       edge.behavioral_confidence_ewma AS behavioral_confidence_ewma,
       edge.behavioral_risk_ewma AS behavioral_risk_ewma,
       edge.gap_count AS gap_count, edge.gap_mean AS gap_mean, edge.gap_m2 AS gap_m2,
       edge.amount_log_count AS amount_log_count, edge.amount_log_mean AS amount_log_mean,
       edge.amount_log_m2 AS amount_log_m2
"""

GET_NODE_COLD_PATH_RESULTS = """
MATCH (a:Account {account_id: $account_id})
RETURN a.community_id AS community_id, a.pagerank AS pagerank,
       a.betweenness AS betweenness, a.eigenvector AS eigenvector, a.embedding AS embedding
"""

GET_COMMUNITY_SIZE = """
MATCH (a:Account {community_id: $community_id})
RETURN count(a) AS community_size
"""

MARK_PENDING_EXPANSION = """
MATCH (a:Account {account_id: $account_id})
SET a.pending_expansion = true
"""

DRAIN_PENDING_EXPANSIONS = """
MATCH (a:Account {pending_expansion: true})
SET a.pending_expansion = false
RETURN a.account_id AS account_id
"""

EXPANDED_NEIGHBORHOOD = """
MATCH (a:Account {account_id: $account_id})
CALL apoc.path.subgraphNodes(a, {relationshipFilter: 'TRANSFERS_TO', minLevel: 1, maxLevel: $hop})
YIELD node
RETURN count(DISTINCT node) AS expanded_node_count
"""

# apoc isn't guaranteed present, so expand_neighborhood in graph_store.py uses a
# plain variable-length Cypher path instead of relying on this - kept only as
# a documented alternative if APOC is added later.

EXPANDED_NEIGHBORHOOD_PLAIN = """
MATCH (a:Account {account_id: $account_id})-[:TRANSFERS_TO*1..%d]-(n:Account)
RETURN count(DISTINCT n) AS expanded_node_count
"""

SPARSIFY_EDGES = """
MATCH (:Account)-[edge:TRANSFERS_TO]->(:Account)
WHERE edge.total_amount < $min_weight
   OR edge.last_seen < datetime($cutoff)
WITH edge LIMIT 10000
DELETE edge
RETURN count(edge) AS removed
"""

PROJECT_ACCOUNT_GRAPH = "CALL gds.graph.project($graph_name, 'Account', 'TRANSFERS_TO', {relationshipProperties: 'total_amount'})"
DROP_GRAPH_PROJECTION = "CALL gds.graph.drop($graph_name, false)"

RUN_LOUVAIN = """
CALL gds.louvain.write($graph_name, {writeProperty: 'community_id', relationshipWeightProperty: 'total_amount'})
YIELD communityCount
RETURN communityCount
"""

RUN_PAGERANK = """
CALL gds.pageRank.write($graph_name, {writeProperty: 'pagerank', relationshipWeightProperty: 'total_amount'})
"""

RUN_BETWEENNESS = "CALL gds.betweenness.write($graph_name, {writeProperty: 'betweenness'})"

RUN_EIGENVECTOR = """
CALL gds.eigenvector.write($graph_name, {writeProperty: 'eigenvector', relationshipWeightProperty: 'total_amount'})
"""

RUN_FASTRP = """
CALL gds.fastRP.write($graph_name, {embeddingDimension: $dimensions, writeProperty: 'embedding',
                                     relationshipWeightProperty: 'total_amount'})
"""

# Anomaly checks: bounded, cold-path-only, observations rather than verdicts.
# Reads GDS-computed values already written to node properties (degree stats
# computed fresh here are still O(1) per node, not a full traversal).

DETECT_HUB_ACCOUNTS = """
MATCH (a:Account)
OPTIONAL MATCH (a)-[r:TRANSFERS_TO]-()
WITH a, count(r) AS degree
WHERE degree >= $degree_threshold
RETURN a.account_id AS account_id, degree
ORDER BY degree DESC
LIMIT 50
"""

DETECT_FAN_IN_SPIKES = """
MATCH (a:Account)<-[r:TRANSFERS_TO]-(:Account)
WITH a, count(r) AS fan_in
WHERE fan_in >= $fan_threshold
RETURN a.account_id AS account_id, fan_in
ORDER BY fan_in DESC
LIMIT 50
"""

DETECT_FAN_OUT_SPIKES = """
MATCH (a:Account)-[r:TRANSFERS_TO]->(:Account)
WITH a, count(r) AS fan_out
WHERE fan_out >= $fan_threshold
RETURN a.account_id AS account_id, fan_out
ORDER BY fan_out DESC
LIMIT 50
"""

DETECT_BRIDGE_ACCOUNTS = """
MATCH (a:Account)
WHERE a.betweenness IS NOT NULL AND a.betweenness >= $betweenness_threshold
RETURN a.account_id AS account_id, a.betweenness AS betweenness
ORDER BY a.betweenness DESC
LIMIT 50
"""

DETECT_SHORT_CIRCULAR_CHAINS = """
MATCH path = (a:Account)-[:TRANSFERS_TO*3..5]->(a)
RETURN a.account_id AS account_id, length(path) AS chain_length
LIMIT 50
"""
