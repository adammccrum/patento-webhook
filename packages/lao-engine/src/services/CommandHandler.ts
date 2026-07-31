import { DomainEvent } from '../events';

/**
 * Base command handler pattern.
 * Each command handler:
 * 1. Validates the command
 * 2. Reconstructs aggregate state from event history
 * 3. Applies invariants
 * 4. Produces new events
 * 5. Persists events (via EventStore)
 *
 * Command handlers are the sole entry point for state mutations.
 * All state changes flow through events.
 */

export interface CommandResult {
  events: DomainEvent[];
  aggregateId: string;
}

export interface ICommandHandler<TCommand> {
  handle(command: TCommand): Promise<CommandResult>;
}

/**
 * CommandBus - routes commands to handlers and publishes resulting events.
 * Ensures:
 * - Idempotent command handling
 * - Event publishing
 * - Transaction semantics (all-or-nothing)
 */
export interface ICommandBus {
  send<TCommand>(command: TCommand, handler: ICommandHandler<TCommand>): Promise<CommandResult>;
}
