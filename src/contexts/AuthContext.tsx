import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  agent: Agent | null;
  signIn: (pin: string, phoneNumber: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshAgent: () => Promise<void>;
}

interface Agent {
  id: string;
  full_name: string;
  phone_number: string;
  pin: string;
  ward_name: string;
  ward_number: string;
  verification_status: string;
  payment_status: string;
  last_report_at: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch agent data using PIN authentication
  const fetchAgentByPin = async (pin: string, phoneNumber: string): Promise<Agent | null> => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('pin', pin)
        .eq('phone_number', phoneNumber)
        .single();

      if (error || !data) return null;
      return data;
    } catch (error) {
      console.error('Error fetching agent:', error);
      return null;
    }
  };

  // PIN-based authentication (simplified for field agents)
  const signIn = async (pin: string, phoneNumber: string) => {
    try {
      // First, try to find the agent by PIN and phone
      const agentData = await fetchAgentByPin(pin, phoneNumber);
      
      if (!agentData) {
        return { error: new Error('Invalid PIN or phone number') };
      }

      if (agentData.verification_status !== 'verified') {
        return { error: new Error('Agent not verified') };
      }

      // Create a simple session for the agent
      await AsyncStorage.setItem('agentSession', JSON.stringify({
        agentId: agentData.id,
        phoneNumber: agentData.phone_number,
        pin: pin,
        loginTime: new Date().toISOString()
      }));

      setAgent(agentData);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem('agentSession');
    setAgent(null);
    setUser(null);
    setSession(null);
  };

  const refreshAgent = async () => {
    if (!agent) return;
    
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agent.id)
        .single();

      if (!error && data) {
        setAgent(data);
      }
    } catch (error) {
      console.error('Error refreshing agent data:', error);
    }
  };

  // Check for existing session on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedSession = await AsyncStorage.getItem('agentSession');
        
        if (storedSession) {
          const sessionData = JSON.parse(storedSession);
          const agentData = await fetchAgentByPin(sessionData.pin, sessionData.phoneNumber);
          
          if (agentData) {
            setAgent(agentData);
          } else {
            // Session invalid, clear it
            await AsyncStorage.removeItem('agentSession');
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Also setup regular Supabase auth for potential future features
  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      agent,
      loading,
      signIn,
      signOut,
      refreshAgent
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}