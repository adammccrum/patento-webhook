-- Add composite indexes for common queries
CREATE INDEX CONCURRENTLY "idx_users_created_at" ON "User"("createdAt" DESC);
CREATE INDEX CONCURRENTLY "idx_audit_logs_user_product_created" ON "AuditLog"("userId", "productId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY "idx_audit_logs_product_action_created" ON "AuditLog"("productId", "action", "createdAt" DESC);

-- Add session lookup optimization
CREATE INDEX CONCURRENTLY "idx_sessions_expires" ON "Session"("expires");

-- Optimize verification token cleanup
CREATE INDEX CONCURRENTLY "idx_verification_tokens_expires_type" ON "VerificationToken"("expires", "type");

-- Add credits query optimization
CREATE INDEX CONCURRENTLY "idx_credits_updated_at" ON "Credits"("updatedAt" DESC);
