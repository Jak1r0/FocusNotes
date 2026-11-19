import type { IntegrationState, TodoItem, UserSession } from './types'

export interface WeChatAuthProvider {
  signIn(): Promise<UserSession>
  signOut(): Promise<void>
  restoreSession(): Promise<UserSession | null>
}

export interface CloudSyncProvider {
  push(userId: string, changes: TodoItem[]): Promise<void>
  pull(userId: string, sinceRevision: number): Promise<TodoItem[]>
}

export interface SmartParserProvider {
  parse(input: string, now?: Date): Promise<import('./types').ParsedTodoDraft>
}

export class IntegrationRequiredError extends Error {
  constructor(feature: string) {
    super(`${feature}尚未配置，请先接入正式服务。`)
    this.name = 'IntegrationRequiredError'
  }
}

export class UnconfiguredWeChatAuth implements WeChatAuthProvider {
  async signIn(): Promise<UserSession> { throw new IntegrationRequiredError('微信登录') }
  async signOut(): Promise<void> { throw new IntegrationRequiredError('微信登录') }
  async restoreSession(): Promise<UserSession | null> { return null }
}

export class IntegrationRegistry {
  constructor(
    public readonly weChatAuth: WeChatAuthProvider = new UnconfiguredWeChatAuth(),
    public readonly cloudSync?: CloudSyncProvider,
    public readonly aiParser?: SmartParserProvider,
  ) {}

  status(feature: 'wechat' | 'sync' | 'ai'): IntegrationState {
    if (feature === 'wechat') return this.weChatAuth instanceof UnconfiguredWeChatAuth ? 'unconfigured' : 'ready'
    if (feature === 'sync') return this.cloudSync ? 'ready' : 'unconfigured'
    return this.aiParser ? 'ready' : 'unconfigured'
  }
}
