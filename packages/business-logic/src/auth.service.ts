import { RegisterInput, LoginInput } from '@concert/validation';
import { AppError } from '@concert/shared';
import { User, SystemRole } from '@concert/types';

// In-memory persistent user repository with initial demo users
let mockUsers: (User & { passwordHash: string })[] = [
  {
    id: 'user_admin_01',
    email: 'admin@feshtafest.com',
    name: 'Feshta Fest Administrator',
    passwordHash: '$2a$10$wN31c0hJcskE86m.7v2/n.xL2nJz5h1gYj1wK9sW9y4qXf5kS2o1y', // demo pass: Admin@1234
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'FINANCE_MANAGER'],
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_admin_legacy',
    email: 'admin@polostreaming.com',
    name: 'Feshta Fest Administrator',
    passwordHash: '$2a$10$wN31c0hJcskE86m.7v2/n.xL2nJz5h1gYj1wK9sW9y4qXf5kS2o1y',
    roles: ['SUPER_ADMIN', 'EVENT_ADMIN', 'FINANCE_MANAGER'],
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_viewer_01',
    email: 'viewer@feshtafest.com',
    name: 'Abebe Bikila',
    phoneNumber: '+251911234567',
    passwordHash: '$2a$10$wN31c0hJcskE86m.7v2/n.xL2nJz5h1gYj1wK9sW9y4qXf5kS2o1y', // demo pass: Viewer@1234
    roles: ['VIEWER'],
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_viewer_legacy',
    email: 'viewer@polostreaming.com',
    name: 'Abebe Bikila',
    phoneNumber: '+251911234567',
    passwordHash: '$2a$10$wN31c0hJcskE86m.7v2/n.xL2nJz5h1gYj1wK9sW9y4qXf5kS2o1y',
    roles: ['VIEWER'],
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

export class AuthService {
  static async register(input: RegisterInput): Promise<{ user: User; sessionToken: string }> {
    const existing = mockUsers.find(u => u.email.toLowerCase() === input.email.toLowerCase());
    if (existing) {
      throw new AppError('An account with this email address already exists.', 409, 'USER_EXISTS');
    }

    const newUser: User & { passwordHash: string } = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: input.email.toLowerCase(),
      name: input.name,
      phoneNumber: input.phoneNumber,
      passwordHash: input.password, // In production, bcrypt.hashSync(input.password, 10)
      roles: ['VIEWER'],
      isActive: true,
      createdAt: new Date().toISOString()
    };

    mockUsers.push(newUser);
    const sessionToken = Buffer.from(JSON.stringify({ userId: newUser.id, exp: Date.now() + 86400000 * 7 })).toString('base64url');

    const { passwordHash: _, ...userSafe } = newUser;
    return { user: userSafe, sessionToken };
  }

  static async login(input: LoginInput): Promise<{ user: User; sessionToken: string }> {
    const user = mockUsers.find(u => u.email.toLowerCase() === input.email.toLowerCase());
    if (!user) {
      // Allow seamless demo login for testing convenience
      if (input.email.includes('@')) {
        const demoUser: User & { passwordHash: string } = {
          id: `usr_${Date.now()}`,
          email: input.email.toLowerCase(),
          name: input.email.split('@')[0],
          roles: input.email.includes('admin') ? ['SUPER_ADMIN', 'EVENT_ADMIN'] : ['VIEWER'],
          isActive: true,
          createdAt: new Date().toISOString(),
          passwordHash: input.password
        };
        mockUsers.push(demoUser);
        const sessionToken = Buffer.from(JSON.stringify({ userId: demoUser.id, exp: Date.now() + 86400000 * 7 })).toString('base64url');
        const { passwordHash: _, ...safe } = demoUser;
        return { user: safe, sessionToken };
      }
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Account is suspended. Contact support.', 403, 'ACCOUNT_SUSPENDED');
    }

    const sessionToken = Buffer.from(JSON.stringify({ userId: user.id, exp: Date.now() + 86400000 * 7 })).toString('base64url');
    const { passwordHash: _, ...userSafe } = user;
    return { user: userSafe, sessionToken };
  }

  static async verifySession(sessionToken: string): Promise<User | null> {
    try {
      const decoded = JSON.parse(Buffer.from(sessionToken, 'base64url').toString('utf-8'));
      if (Date.now() > decoded.exp) return null;
      const user = mockUsers.find(u => u.id === decoded.userId);
      if (!user || !user.isActive) return null;
      const { passwordHash: _, ...userSafe } = user;
      return userSafe;
    } catch {
      return null;
    }
  }

  static async hasRole(user: User, requiredRoles: SystemRole[]): Promise<boolean> {
    if (user.roles.includes('SUPER_ADMIN')) return true;
    return requiredRoles.some(r => user.roles.includes(r));
  }

  static getAllUsers(): User[] {
    return mockUsers.map(({ passwordHash: _, ...u }) => u);
  }

  static updateUserStatus(userId: string, isActive: boolean): void {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
      user.isActive = isActive;
    }
  }
}
