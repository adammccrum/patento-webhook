# IrisKey Platform - Operations Guide

**Version**: 2.6  
**Last Updated**: 2024-07-31  
**Status**: Production Ready

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Monitoring](#monitoring)
3. [Alerts and Response](#alerts-and-response)
4. [Scaling](#scaling)
5. [Backup and Recovery](#backup-and-recovery)
6. [Incident Management](#incident-management)
7. [Performance Tuning](#performance-tuning)
8. [Security Operations](#security-operations)

---

## Daily Operations

### Health Check Verification

```bash
# Check application health
curl https://yourdomain.com/health
# Expected: { status: "healthy", uptime: ..., checks: {...} }

# Check readiness (can accept traffic)
curl https://yourdomain.com/ready
# Expected: { ready: true, checks: {...} }

# Check liveness (process alive)
curl https://yourdomain.com/alive
# Expected: { alive: true, uptime: ... }
```

### Container Status Monitoring

```bash
# Check all services status
docker-compose ps

# Verify database connectivity
docker exec iriskey-postgres pg_isready -U postgres

# Verify Redis connectivity
docker exec iriskey-redis redis-cli ping

# Check application logs
docker-compose logs -f lao-web

# Check database logs
docker-compose logs -f postgres

# Check cache logs
docker-compose logs -f redis
```

### Background Job Monitoring

```bash
# Monitor queue status (via logs)
docker-compose logs -f lao-web | grep "Job\|queue"

# Check Redis queue status
docker exec iriskey-redis redis-cli KEYS "job:*"

# Monitor specific job type
docker exec iriskey-redis redis-cli HGETALL "job:SEND_EMAIL"
```

---

## Monitoring

### Key Metrics to Track

**Application Metrics**
- Response time (p50, p95, p99)
- Error rate (5xx, 4xx errors)
- Request throughput (requests/second)
- Active connections
- Memory usage
- CPU usage
- Disk I/O

**Database Metrics**
- Query latency (avg, p99)
- Connection pool utilization
- Slow query count
- Transaction duration
- Index usage
- Table size growth
- Lock contention

**Cache Metrics**
- Hit rate (%)
- Miss rate (%)
- Eviction rate
- Memory usage
- Key count by prefix

**Rate Limiting Metrics**
- Login attempts (blocked vs allowed)
- Registration attempts (blocked vs allowed)
- API rate limits hit count
- Rate limit by IP address

### Sentry Setup

1. **Create Sentry Project**
   ```bash
   # Visit https://sentry.io/signup/
   # Create organization: "IrisKey"
   # Create project: "LAO Platform"
   # Select platform: Node.js
   ```

2. **Configure Environment**
   ```env
   SENTRY_DSN=https://key@sentry.io/project-id
   SENTRY_ENVIRONMENT=production
   SENTRY_RELEASE=v1.0.0
   ```

3. **Monitor Dashboard**
   - https://sentry.io/organizations/your-org/issues/
   - Set up alerts for error spikes
   - Configure integrations: Slack, PagerDuty

### Structured Logging

Logs are emitted in JSON format for easy parsing:

```json
{
  "timestamp": "2024-07-31T12:00:00Z",
  "level": "INFO",
  "message": "User login successful",
  "context": {
    "userId": "uuid-123",
    "email": "user@example.com",
    "ipAddress": "203.0.113.1"
  },
  "duration": 245
}
```

Parse and filter logs:

```bash
# View only errors
docker-compose logs lao-web | jq 'select(.level == "ERROR")'

# View authentication events
docker-compose logs lao-web | jq 'select(.context.userId)'

# View slow requests (>1 second)
docker-compose logs lao-web | jq 'select(.duration > 1000)'

# Export to file
docker-compose logs lao-web | jq . > logs.jsonl
```

---

## Alerts and Response

### Alert Rules (Example for AlertManager/Prometheus)

```yaml
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        annotations:
          summary: "High error rate on {{ $labels.instance }}"
          action: "Check application logs and Sentry"

      - alert: HighResponseTime
        expr: histogram_quantile(0.99, http_request_duration_seconds) > 1
        annotations:
          summary: "High response time on {{ $labels.instance }}"
          action: "Check database performance and cache hit rate"

      - alert: RateLimitExceeded
        expr: rate_limit_hits_total[5m] > 100
        annotations:
          summary: "High rate limit hits"
          action: "Investigate traffic patterns and potentially increase limits"

      - alert: DatabaseConnectionPoolExhausted
        expr: db_connection_pool_available == 0
        annotations:
          summary: "Database connection pool exhausted"
          action: "Restart application or increase pool size"
```

### Response Procedures

**High Error Rate (>5% 5xx errors)**

1. Check Sentry dashboard for error patterns
2. Review application logs: `docker-compose logs lao-web`
3. Check database connectivity: `docker exec iriskey-postgres pg_isready`
4. Check Redis connectivity: `docker exec iriskey-redis redis-cli ping`
5. If intermittent: monitor for spikes
6. If persistent: initiate rollback procedure

**High Response Time (p99 > 1s)**

1. Check database performance:
   ```bash
   docker exec iriskey-postgres psql -U postgres -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
   ```

2. Check cache hit rate:
   ```bash
   docker exec iriskey-redis redis-cli INFO stats | grep hits
   ```

3. Check connection pool:
   ```bash
   docker exec iriskey-postgres psql -U postgres -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
   ```

4. Analyze slow queries and optimize indexes

**Rate Limit Attacks**

1. Identify attacker IP: `docker-compose logs lao-web | grep "rate limit exceeded"`
2. Increase limits temporarily if legitimate traffic surge
3. Consider blocking IP via firewall or WAF

**Database Issues**

1. Check available connections: `docker exec iriskey-postgres pg_isready -d lao`
2. Verify disk space: `docker exec iriskey-postgres df -h`
3. Check active queries: `docker exec iriskey-postgres psql -U postgres -c "SELECT pid, usename, query FROM pg_stat_activity;"`
4. Kill long-running queries if needed:
   ```bash
   docker exec iriskey-postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE duration > interval '5 min';"
   ```

---

## Scaling

### Horizontal Scaling (Multiple Application Instances)

```yaml
# docker-compose.yml
services:
  lao-web-1:
    build: .
    environment:
      # ... environment vars
    ports:
      - "3001:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  lao-web-2:
    build: .
    environment:
      # ... environment vars
    ports:
      - "3002:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  lao-web-3:
    build: .
    environment:
      # ... environment vars
    ports:
      - "3003:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - lao-web-1
      - lao-web-2
      - lao-web-3
```

### Database Scaling

**Read Replicas (50k-100k users)**

```sql
-- Primary: postgres:5432/lao
-- Replica: postgres-read:5432/lao

-- Configure replica
PRIMARY_CONNINFO='host=postgres port=5432 user=postgres password=postgres'
```

**Sharding (>100k users)**

Implement based on userId or productId:

```typescript
// apps/lao-web/src/lib/sharding.ts
const shardKey = userId % SHARD_COUNT;
const shard = SHARDS[shardKey];
const connection = `postgresql://user:pass@shard-${shard}:5432/lao`;
```

### Redis Scaling

**Redis Cluster (100k+ users)**

```bash
# Docker Compose with Redis Cluster
services:
  redis-node-1:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes
  
  redis-node-2:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes
  
  # ... more nodes
```

---

## Backup and Recovery

### Database Backups

```bash
# Full backup
docker exec iriskey-postgres pg_dump -U postgres lao > backup-$(date +%Y%m%d-%H%M%S).sql

# Point-in-time restore
docker exec iriskey-postgres pg_restore -U postgres -d lao backup.sql

# Automated daily backup
0 2 * * * docker exec iriskey-postgres pg_dump -U postgres lao > /backups/lao-$(date +\%Y\%m\%d).sql
```

### Redis Backups

```bash
# Create RDB snapshot
docker exec iriskey-redis redis-cli BGSAVE

# Backup RDB file
docker cp iriskey-redis:/data/dump.rdb ./redis-backup.rdb

# Restore from backup
docker cp ./redis-backup.rdb iriskey-redis:/data/dump.rdb
docker restart iriskey-redis
```

### Recovery Procedures

```bash
# Database recovery from backup
docker-compose down
docker exec iriskey-postgres pg_restore -d lao < backup.sql
docker-compose up -d

# Test recovery
curl https://yourdomain.com/health
```

---

## Incident Management

### Incident Classification

**Severity P1** (Critical)
- Application down or completely unavailable
- Data loss occurring
- Security breach in progress
- Widespread service degradation

**Severity P2** (High)
- Major feature unavailable
- Significant performance degradation
- Partial data loss
- Security vulnerability discovered

**Severity P3** (Medium)
- Minor feature unavailable
- Some users affected
- Performance issues (slow)
- Log of non-critical errors

**Severity P4** (Low)
- Cosmetic issues
- Documentation gaps
- Minor performance concerns

### Incident Response Timeline

```
T+0:00   Incident detected (alert/report)
T+0:05   Incident commander assigned
T+0:10   Initial investigation started
T+0:15   Issue identified
T+0:20   Mitigation strategy determined
T+0:30   Mitigation implemented
T+0:45   Monitoring confirms resolution
T+1:00   Incident closed, post-mortem scheduled
```

### Post-Mortem Template

```markdown
# Post-Mortem: [Incident Name]

## Timeline
- T+0:00: Incident detected
- T+0:15: Root cause identified
- T+0:30: Mitigation applied
- T+0:45: Confirmed resolved

## Root Cause
[Detailed explanation]

## Impact
- Duration: 15 minutes
- Users affected: ~500
- Revenue impact: $X

## Contributing Factors
1. [Factor 1]
2. [Factor 2]

## Resolution
[What was done]

## Prevention
1. [Action 1]
2. [Action 2]

## Follow-up
- [ ] Implement prevention #1
- [ ] Improve monitoring
- [ ] Update runbook
```

---

## Performance Tuning

### Database Query Optimization

```sql
-- Find slow queries
SELECT query, calls, mean_time, max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Enable query analysis
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Add index for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
```

### Connection Pool Tuning

```env
# Increase pool size for high traffic
DB_MAX_CONNECTIONS=50
DB_MIN_CONNECTIONS=10

# Adjust based on formula:
# max = (core_count * 2) + effective_spindle_count
# For 4-core system with SSD: (4 * 2) + 0 = 8
# For high concurrency: 20-30
```

### Cache Optimization

```bash
# Monitor cache efficiency
docker exec iriskey-redis redis-cli INFO stats

# Set aggressive TTLs for read-heavy data
# SESSION: 30 days
# USER_PROFILE: 5 minutes
# FEATURE_FLAG: 1 hour

# Monitor eviction policy
docker exec iriskey-redis redis-cli CONFIG GET maxmemory-policy
```

### Application Profiling

```bash
# Enable Node.js profiling
node --prof apps/lao-web/.next/standalone/server.js

# Process profiling data
node --prof-process isolate-*.log > profile.txt

# Monitor memory usage
node --max-old-space-size=2048 apps/lao-web/.next/standalone/server.js
```

---

## Security Operations

### Regular Security Reviews

**Monthly**
- Review audit logs for suspicious activity
- Check failed login attempts per user
- Verify rate limit effectiveness
- Review permission changes

**Quarterly**
- Penetration testing
- Dependency security updates
- API security review
- Compliance audit

**Annually**
- Full security audit
- Disaster recovery drill
- Access review and revocation

### Secret Rotation

```bash
# Rotate NEXTAUTH_SECRET
# 1. Generate new secret
openssl rand -base64 32

# 2. Update environment
export NEXTAUTH_SECRET=<new-secret>

# 3. Restart application
docker-compose restart lao-web

# 4. Monitor for session invalidation
# 5. After 24 hours, update persisted config
```

### Security Incident Response

**Suspected Breach**

1. Isolate affected systems
2. Preserve logs and evidence
3. Notify security team
4. Assess impact scope
5. Revoke compromised credentials
6. Monitor for continued unauthorized access
7. File incident report
8. Communicate with users if needed

---

**Last Updated**: 2024-07-31  
**Next Review**: 2024-10-31
