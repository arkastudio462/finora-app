export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: 'income' | 'expense';
          description: string;
          category: string;
          amount: number;
          payment_method: 'cash' | 'non_cash';
          image_path: string | null;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'income' | 'expense';
          description: string;
          category: string;
          amount: number;
          payment_method?: 'cash' | 'non_cash';
          image_path?: string | null;
          date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'income' | 'expense';
          description?: string;
          category?: string;
          amount?: number;
          payment_method?: 'cash' | 'non_cash';
          image_path?: string | null;
          date?: string;
          created_at?: string;
        };
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          amount: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          amount: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          category?: string;
          amount?: number;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
