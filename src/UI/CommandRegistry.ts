import { Vector } from "../Core/Vector";

/**
 * Defines the shape of the RDDraw-like object that can execute commands.
 * Extracted as an interface to decouple the registry from the concrete class
 * while still providing strong typing for command implementations.
 */
export interface CommandHost {
  /**
   * Redraw the full scene. Commands are expected to request a redraw after
   * mutating repository state to keep the canvas and UI in sync.
   */
  drawAll(): void;

  /**
   * Low-level access to the last pointer position on the canvas. Some
   * commands need to know where the user last interacted with the canvas in
   * order to place new elements.
   */
  getPointer(): Vector;
}

/**
 * Context provided to command executors. The host is usually the active
 * `RDDraw` instance, but the interface keeps the registry reusable for
 * testing or future host implementations.
 */
export interface CommandContext<THost extends CommandHost> {
  host: THost;
  pointer: Vector;
}

/**
 * A lightweight command abstraction. Commands receive a context object and
 * can optionally express whether they require the current pointer position to
 * be valid before execution.
 */
export interface CommandDefinition<THost extends CommandHost> {
  id: string;
  description: string;
  requiresPointer?: boolean;
  execute(context: CommandContext<THost>): void;
}

/**
 * Central registry for UI commands. The registry knows how to add, retrieve,
 * and execute command definitions, enabling us to keep the main UI class
 * focused on high-level orchestration instead of switch statements.
 */
export class CommandRegistry<THost extends CommandHost> {
  private commands: Map<string, CommandDefinition<THost>> = new Map();

  register(command: CommandDefinition<THost>) {
    this.commands.set(command.id, command);
  }

  /**
   * Executes a command if it has been registered. Returns `false` when a
   * command identifier is unknown so callers can decide how to react.
   */
  execute(id: string, host: THost, pointer: Vector): boolean {
    const command = this.commands.get(id);
    if (!command) {
      return false;
    }

    if (command.requiresPointer && !pointer) {
      throw new Error(`Command '${id}' requires a pointer position.`);
    }

    command.execute({ host, pointer });
    return true;
  }

  list(): CommandDefinition<THost>[] {
    return Array.from(this.commands.values());
  }
}
