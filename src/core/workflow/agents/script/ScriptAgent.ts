import { BaseAgent } from '../BaseAgent';
import { WorkflowStep } from '../../types';
import { ScriptAgentConfig, ScriptResult, ScriptError, ScriptLanguage } from './types';
import { VM } from 'vm2';
import { python } from 'pythonia';

export class ScriptAgent extends BaseAgent {
  private readonly defaultConfig: Partial<ScriptAgentConfig> = {
    timeout: 30000,
    memoryLimit: 512, // MB
    environmentVariables: {},
  };

  constructor(config: Partial<ScriptAgentConfig> = {}) {
    super('Script');
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  async execute(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<ScriptResult> {
    try {
      const config = this.prepareConfig(step);
      const startTime = Date.now();
      const consoleOutput = {
        logs: [] as string[],
        errors: [] as string[],
        warnings: [] as string[],
      };

      const result = await this.runScript(config, context, consoleOutput);
      const endTime = Date.now();
      const memoryUsage = process.memoryUsage();

      return {
        output: result,
        console: consoleOutput,
        timing: {
          startTime,
          endTime,
          duration: endTime - startTime,
        },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          peak: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
      };
    } catch (error) {
      return this.handleScriptError(error, step);
    }
  }

  async validate(step: WorkflowStep): Promise<boolean> {
    try {
      await super.validate(step);
      const config = step.config as Partial<ScriptAgentConfig>;
      
      this.validateRequiredConfig(config as Record<string, unknown>, ['language', 'code']);

      if (!this.isSupportedLanguage(config.language)) {
        throw new Error(`Unsupported script language: ${config.language}`);
      }

      // Basic syntax validation
      await this.validateSyntax(config.language!, config.code!);

      return true;
    } catch (error) {
      this.logger.error('Script validation failed', { error, step });
      return false;
    }
  }

  private prepareConfig(step: WorkflowStep): ScriptAgentConfig {
    return { ...this.defaultConfig, ...step.config } as ScriptAgentConfig;
  }

  private async runScript(
    config: ScriptAgentConfig,
    context: Record<string, unknown>,
    consoleOutput: ScriptResult['console']
  ): Promise<unknown> {
    switch (config.language) {
      case 'javascript':
      case 'typescript':
        return this.runJavaScript(config, context, consoleOutput);
      case 'python':
        return this.runPython(config, context, consoleOutput);
      default:
        throw new Error(`Unsupported language: ${config.language}`);
    }
  }

  private async runJavaScript(
    config: ScriptAgentConfig,
    context: Record<string, unknown>,
    consoleOutput: ScriptResult['console']
  ): Promise<unknown> {
    const vm = new VM({
      timeout: config.timeout,
      sandbox: {
        console: {
          log: (...args: unknown[]) => 
            consoleOutput.logs.push(args.map(String).join(' ')),
          error: (...args: unknown[]) => 
            consoleOutput.errors.push(args.map(String).join(' ')),
          warn: (...args: unknown[]) => 
            consoleOutput.warnings.push(args.map(String).join(' ')),
        },
        context,
        parameters: config.parameters,
        env: config.environmentVariables,
      },
    });

    return vm.run(config.code);
  }

  private async runPython(
    config: ScriptAgentConfig,
    context: Record<string, unknown>,
    consoleOutput: ScriptResult['console']
  ): Promise<unknown> {
    const py = await python();
    
    // Create Python script with context and parameters
    const scriptWithContext = `
import json
import sys

context = json.loads('''${JSON.stringify(context)}''')
parameters = json.loads('''${JSON.stringify(config.parameters)}''')
env = json.loads('''${JSON.stringify(config.environmentVariables)}''')

class Logger:
    def log(self, *args):
        print("LOG:", *args)
    def error(self, *args):
        print("ERROR:", *args)
    def warn(self, *args):
        print("WARN:", *args)

console = Logger()

${config.code}
    `;

    try {
      const result = await py.eval(scriptWithContext);
      return result.toJS();
    } finally {
      await py.destroy();
    }
  }

  private isSupportedLanguage(language?: ScriptLanguage): boolean {
    return ['javascript', 'typescript', 'python'].includes(language || '');
  }

  private async validateSyntax(
    language: ScriptLanguage,
    code: string
  ): Promise<void> {
    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          new Function(code);
          break;
        case 'python':
          // Basic Python syntax check using pythonia
          const py = await python();
          await py.compile(code, '<string>', 'exec');
          await py.destroy();
          break;
      }
    } catch (error) {
      throw new Error(`Syntax error in ${language} code: ${error.message}`);
    }
  }

  private handleScriptError(error: unknown, step: WorkflowStep): never {
    const scriptError: ScriptError = new Error('Script execution failed') as ScriptError;
    
    if (error instanceof Error) {
      scriptError.message = error.message;
      scriptError.stack = error.stack;
      
      // Extract line and column numbers if available
      const match = error.stack?.match(/(?:at |line )(\d+)(?::(\d+))?/);
      if (match) {
        scriptError.lineNumber = parseInt(match[1], 10);
        scriptError.columnNumber = match[2] ? parseInt(match[2], 10) : undefined;
      }
    }

    return this.handleError(scriptError, step);
  }
} 