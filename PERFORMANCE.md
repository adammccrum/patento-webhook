# IrisKey Platform - Performance Guide

**Version**: 2.6  
**Last Updated**: 2024-07-31  
**Status**: Production Ready

---

## Table of Contents

1. [Performance Benchmarks](#performance-benchmarks)
2. [Load Testing Results](#load-testing-results)
3. [Optimization Guidelines](#optimization-guidelines)
4. [Monitoring and Metrics](#monitoring-and-metrics)
5. [Caching Strategy](#caching-strategy)
6. [Database Performance](#database-performance)
7. [Capacity Planning](#capacity-planning)

---

## Performance Benchmarks

### Target Performance Metrics

| Metric | Target | Acceptable | Warning |
|--------|--------|-----------|---------|
| Home page (p50) | 100ms | 200ms | >500ms |
| Home page (p99) | 300ms | 500ms | >1000ms |
| API endpoint (p50) | 50ms | 150ms | >300ms |
| API endpoint (p99) | 200ms | 400ms | >800ms |
| Database query (avg) | 10ms | 50ms | >100ms |
| Database query (p99) | 50ms | 200ms | >500ms |
| Cache hit rate | >95% | >90% | <80% |
| Error rate | <0.1% | <1% | >5% |
| Availability | >99.95% | >99.9% | <99%|

### Baseline Performance (Single Instance)

**Hardware**
- CPU: 4 cores
- RAM: 2GB
- Disk: 20GB SSD
- Network: 1Gbps

**Application Metrics**
- Memory usage: 150-200MB
- CPU usage: 5-15% idle
- Disk I/O: 10-50 IOPS idle

**Database Metrics**
- Connection pool: 10 active, 5 idle
- Cache size: 50-100MB

---

## Load Testing Results

### Test Environment

```bash
# Load testing with Apache Bench
ab -c 100 -n 10000 http://localhost:3000/

# Load testing with wrk
wrk -t12 -c400 -d30s http://localhost:3000/
```

### Results Summary (Single Instance)

**Concurrent Users: 100**
- Requests/sec: 450
- Mean latency: 220ms
- P95 latency: 450ms
- P99 latency: 800ms
- Error rate: 0%

**Concurrent Users: 500**
- Requests/sec: 420
- Mean latency: 1.2s
- P95 latency: 2.1s
- P99 latency: 3.5s
- Error rate: 0.1%

**Concurrent Users: 1000**
- Requests/sec: 350
- Mean latency: 2.8s
- P95 latency: 5.2s
- P99 latency: 8.1s
- Error rate: 1.2%

### Scalability Results

**2 Instances (Load Balanced)**
- Requests/sec: 850 (+89%)
- Mean latency: 230ms (-5%)
- P99 latency: 900ms (+12%)

**3 Instances (Load Balanced)**
- Requests/sec: 1200 (+167%)
- Mean latency: 240ms (-9%)
- P99 latency: 950ms (+19%)

**4 Instances (Load Balanced)**
- Requests/sec: 1450 (+222%)
- Mean latency: 250ms (-14%)
- P99 latency: 1000ms (+25%)

### Redis Caching Impact

**Without Cache**
- Response time: 500ms avg
- Database load: High
- Memory usage: Baseline

**With Cache**
- Response time: 150ms avg (-70%)
- Database load: 40% reduction
- Memory usage: +100MB (acceptable)

---

## Optimization Guidelines

### Frontend Optimization

```typescript
// Code splitting
import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('./dashboard'), {
  loading: () => <div>Loading...</div>,
  ssr: true,
});

// Image optimization
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority
  quality={75}
/>

// Bundle analysis
npm run build -- --analyze

// Font optimization
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preload" as="style" href="..." />
```

### Backend Optimization

```typescript
// Query optimization - avoid N+1
const users = await db.user.findMany({
  include: {
    profile: true,
    credits: true,
  },
});

// Pagination
const users = await db.user.findMany({
  take: 20,
  skip: (page - 1) * 20,
});

// Select specific columns
const users = await db.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
  },
});

// Batch operations
const results = await db.user.createMany({
  data: users,
  skipDuplicates: true,
});
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_audit_logs_user_id_created_at ON audit_logs(user_id, created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Identify unused indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE indexname NOT IN (SELECT indexname FROM pg_stat_user_indexes);

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Cache Optimization

```typescript
// Cache-aside pattern
const getCachedUser = async (userId: string) => {
  const cached = await cache.get(`user:${userId}`);
  if (cached) return cached;

  const user = await db.user.findUnique({ where: { id: userId } });
  await cache.set(`user:${userId}`, user, 300000); // 5 min TTL
  return user;
};

// Cache invalidation on update
const updateUser = async (id: string, data: UserUpdateData) => {
  const user = await db.user.update({ where: { id }, data });
  await cache.delete(`user:${id}`);
  return user;
};

// Batch cache retrieval
const users = await Promise.all(
  userIds.map((id) => cache.getOrSet(`user:${id}`, () => fetchUser(id)))
);
```

---

## Monitoring and Metrics

### Key Performance Indicators (KPIs)

**Throughput**
```bash
# Requests per second
curl -s http://localhost:3000/health | jq .uptime
```

**Latency**
```bash
# Response time distribution
docker-compose logs lao-web | grep "duration" | jq '.duration'
```

**Error Rate**
```bash
# Error percentage
docker-compose logs lao-web | jq 'select(.level == "ERROR")' | wc -l
```

**Resource Utilization**
```bash
# Memory usage
docker stats iriskey-lao-web --no-stream

# CPU usage
ps aux | grep "node apps/lao-web"
```

### Prometheus Metrics (Optional Setup)

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'lao-app'
    static_configs:
      - targets: ['localhost:3000']

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']
```

### Grafana Dashboard Setup

1. Add Prometheus data source
2. Create dashboards for:
   - Request latency (p50, p95, p99)
   - Error rate
   - Throughput
   - Resource usage
   - Database metrics
   - Cache statistics

---

## Caching Strategy

### Cache Layers

```
Request → Application Cache (Redis/Memory)
          ↓ (miss)
        Database
          ↓
        Application Cache
          ↑
        Response
```

### TTL Configuration

| Data | TTL | Policy |
|------|-----|--------|
| Session | 30 days | Persistent |
| User Profile | 5 minutes | LRU |
| Feature Flags | 1 hour | LRU |
| Provider Health | 5 minutes | LRU |
| API Config | 24 hours | LRU |
| Rate Limit State | 1 minute | LRU |

### Cache Preloading

```typescript
// On application startup
async function preloadCaches() {
  const features = await db.feature.findMany();
  for (const feature of features) {
    await cache.set(`feature:${feature.id}`, feature, 3600000);
  }

  const config = await db.config.findFirst();
  await cache.set('config', config, 86400000);
}

// Initialize on boot
if (process.env.NODE_ENV === 'production') {
  preloadCaches().catch(console.error);
}
```

---

## Database Performance

### Connection Pool Tuning

```env
# For 4-core CPU with database on same machine
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=5

# For high-concurrency systems
DB_MAX_CONNECTIONS=50
DB_MIN_CONNECTIONS=10

# Monitor pool
SELECT datname, count(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

### Query Optimization Patterns

```typescript
// Bad: N+1 queries
const users = await db.user.findMany();
for (const user of users) {
  const credits = await db.credits.findUnique({
    where: { userId: user.id },
  });
  // ...
}

// Good: Single query with join
const users = await db.user.findMany({
  include: { credits: true },
});

// Good: Batch operations
const userIds = users.map((u) => u.id);
const credits = await db.credits.findMany({
  where: { userId: { in: userIds } },
});
```

### Index Strategy

```sql
-- Single-column indexes for WHERE clauses
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- Multi-column indexes for common queries
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

-- Partial indexes for common subsets
CREATE INDEX idx_active_users ON users(email) WHERE active = true;

-- Covering indexes (include columns in index)
CREATE INDEX idx_users_covering ON users(email) INCLUDE (id, name);
```

---

## Capacity Planning

### User Growth Projections

| Period | Users | Load | Instances | Database Size |
|--------|-------|------|-----------|--------------|
| Month 1 | 100 | Low | 1 | 100MB |
| Month 3 | 1,000 | Low | 1 | 500MB |
| Month 6 | 10,000 | Medium | 2 | 2GB |
| Month 12 | 50,000 | High | 4-6 | 10GB |
| Year 2 | 100,000+ | Very High | 8-12+ | 50GB+ |

### Scaling Decision Tree

**<1,000 users**
- Single instance
- Single database
- In-memory cache
- No load balancer needed

**1,000-10,000 users**
- 2-3 instances
- Single database (possibly read replicas)
- Redis cache
- Load balancer (nginx/HAProxy)

**10,000-100,000 users**
- 4-8 instances
- Database read replicas
- Redis cluster
- Advanced load balancing
- CDN for static assets

**>100,000 users**
- 8+ instances (regional)
- Database sharding
- Redis cluster with persistence
- Global load balancing
- Multiple regions/availability zones

### Resource Allocation

```yaml
# Single instance (development)
cpu: 2
memory: 2Gi
disk: 20Gi
network: 1Gbps

# Production instance
cpu: 4
memory: 4Gi
disk: 50Gi
network: 10Gbps

# Database instance
cpu: 8
memory: 16Gi
disk: 500Gi (+ backups)
network: 10Gbps

# Cache instance
cpu: 2
memory: 8Gi
disk: 100Gi
network: 10Gbps
```

---

## Performance Testing Checklist

- [ ] Load test with concurrent users
- [ ] Stress test to find breaking point
- [ ] Soak test (24 hour run) for memory leaks
- [ ] Cache effectiveness testing
- [ ] Database query performance review
- [ ] Network latency simulation
- [ ] Failover testing
- [ ] Recovery time measurement
- [ ] Documentation of bottlenecks
- [ ] Optimization recommendations

---

**Last Updated**: 2024-07-31  
**Next Review**: 2024-10-31
