/**
 * SW Service Desk v1.0 - Contexto de Autenticação e Sessões RBAC
 * Organização: SW Cloud Solutions
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ requiresTwoFactor?: boolean; error?: string }>;
  logout: () => Promise<void>;
  quickSwitchRole: (role: UserRole) => Promise<void>;
  toggle2FA: (enabled: boolean) => Promise<{ secret?: string; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sw_sd_jwt'));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Se sessão inválida
        setUser(null);
        setToken(null);
        localStorage.removeItem('sw_sd_jwt');
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Se não há token gravado, faz login inicial automático como Diogo Pires (Técnico Sénior) para comodidade imediata
    if (!token) {
      quickSwitchRole('technician').finally(() => setLoading(false));
    } else {
      refreshUser();
    }
  }, []);

  const login = async (email: string, password: string, twoFactorCode?: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, twoFactorCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Erro ao iniciar sessão.' };
      }
      if (data.requiresTwoFactor) {
        return { requiresTwoFactor: true };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('sw_sd_jwt', data.token);
      return {};
    } catch (err: any) {
      return { error: 'Falha de comunicação com o servidor de autenticação.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
    setUser(null);
    setToken(null);
    localStorage.removeItem('sw_sd_jwt');
  };

  const quickSwitchRole = async (role: UserRole) => {
    let email = 'tech.diogo@swcloudsolutions.com';
    let pass = 'Tech123!@#';

    if (role === 'admin') {
      email = 'admin@swcloudsolutions.com';
      pass = 'Admin123!@#';
    } else if (role === 'manager') {
      email = 'manager@swcloudsolutions.com';
      pass = 'Manager123!@#';
    } else if (role === 'user') {
      email = 'colaborador@swcloudsolutions.com';
      pass = 'User123!@#';
    }

    setLoading(true);
    await login(email, pass);
    setLoading(false);
  };

  const toggle2FA = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/v1/auth/2fa/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      if (user) {
        setUser({ ...user, two_factor_enabled: enabled });
      }
      return { secret: data.secret };
    } catch (err: any) {
      return { error: 'Erro ao configurar 2FA.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        login,
        logout,
        quickSwitchRole,
        toggle2FA,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  return context;
};
