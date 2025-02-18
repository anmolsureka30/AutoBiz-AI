import { BaseAgent } from '../BaseAgent';
import { WorkflowStep } from '../../types';
import { HttpAgentConfig, HttpResponse, HttpError } from './types';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class HttpAgent extends BaseAgent {
  private readonly axiosInstance: AxiosInstance;
  private readonly defaultConfig: Partial<HttpAgentConfig> = {
    timeout: 30000,
    retryConfig: {
      maxRetries: 3,
      backoffFactor: 2,
      statusCodesToRetry: [408, 429, 500, 502, 503, 504],
    },
    validateStatus: (status: number) => status >= 200 && status < 300,
  };

  constructor(config: Partial<HttpAgentConfig> = {}) {
    super('HTTP');
    this.axiosInstance = axios.create({
      timeout: config.timeout || this.defaultConfig.timeout,
    });
  }

  async execute(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<HttpResponse> {
    try {
      const config = this.prepareConfig(step);
      const startTime = Date.now();

      const response = await this.executeWithRetry(config);

      const endTime = Date.now();
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
        data: response.data,
        timing: {
          startTime,
          endTime,
          duration: endTime - startTime,
        },
      };
    } catch (error) {
      return this.handleHttpError(error, step);
    }
  }

  async validate(step: WorkflowStep): Promise<boolean> {
    try {
      await super.validate(step);
      const config = step.config as Partial<HttpAgentConfig>;
      
      this.validateRequiredConfig(config as Record<string, unknown>, ['method', 'url']);

      if (config.method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method)) {
        throw new Error(`Invalid HTTP method: ${config.method}`);
      }

      if (config.url && !this.isValidUrl(config.url)) {
        throw new Error(`Invalid URL: ${config.url}`);
      }

      return true;
    } catch (error) {
      this.logger.error('HTTP step validation failed', { error, step });
      return false;
    }
  }

  private prepareConfig(step: WorkflowStep): AxiosRequestConfig {
    const config = { ...this.defaultConfig, ...step.config } as HttpAgentConfig;
    
    return {
      method: config.method.toLowerCase(),
      url: config.url,
      headers: config.headers,
      data: config.body,
      timeout: config.timeout,
      validateStatus: config.validateStatus,
    };
  }

  private async executeWithRetry(
    config: AxiosRequestConfig,
    attempt = 1
  ): Promise<any> {
    try {
      return await this.axiosInstance.request(config);
    } catch (error) {
      const retryConfig = (config as unknown as HttpAgentConfig).retryConfig || 
                         this.defaultConfig.retryConfig!;

      if (
        attempt < retryConfig.maxRetries &&
        this.shouldRetry(error, retryConfig.statusCodesToRetry)
      ) {
        const delay = this.calculateBackoff(attempt, retryConfig.backoffFactor);
        this.logger.info(`Retrying request (attempt ${attempt + 1}) after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(config, attempt + 1);
      }

      throw error;
    }
  }

  private shouldRetry(error: any, statusCodesToRetry: number[]): boolean {
    if (axios.isAxiosError(error) && error.response) {
      return statusCodesToRetry.includes(error.response.status);
    }
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
  }

  private calculateBackoff(attempt: number, factor: number): number {
    return Math.min(1000 * Math.pow(factor, attempt - 1), 30000);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private handleHttpError(error: unknown, step: WorkflowStep): never {
    const httpError: HttpError = new Error('HTTP request failed') as HttpError;
    
    if (axios.isAxiosError(error) && error.response) {
      httpError.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers as Record<string, string>,
        data: error.response.data,
        timing: {
          startTime: 0,
          endTime: 0,
          duration: 0,
        },
      };
      httpError.request = {
        method: error.config.method?.toUpperCase() || 'UNKNOWN',
        url: error.config.url || 'UNKNOWN',
        headers: error.config.headers as Record<string, string>,
        body: error.config.data,
      };
      httpError.code = error.code;
    }

    return this.handleError(httpError, step);
  }
} 