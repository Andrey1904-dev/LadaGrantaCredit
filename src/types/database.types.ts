/**
 * TypeScript-типы схемы БД Supabase (формат `supabase gen types typescript`).
 * Схема описана в supabase/schema.sql. После изменения схемы в реальном
 * проекте типы можно перегенерировать командой:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
        Relationships: []
      }
      cars: {
        Row: {
          id: string
          user_id: string
          plate_number: string
          vin_number: string
          current_mileage: number
          initial_mileage: number
          insurance_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plate_number?: string
          vin_number?: string
          current_mileage?: number
          initial_mileage?: number
          insurance_until?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plate_number?: string
          vin_number?: string
          current_mileage?: number
          initial_mileage?: number
          insurance_until?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cars_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      loans: {
        Row: {
          id: string
          user_id: string
          total_amount: number
          interest_rate: number
          monthly_payment: number
          term_months: number
          start_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          total_amount: number
          interest_rate: number
          monthly_payment: number
          term_months: number
          start_date: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          total_amount?: number
          interest_rate?: number
          monthly_payment?: number
          term_months?: number
          start_date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'loans_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          category: 'fuel' | 'loan' | 'maintenance' | 'insurance' | 'other'
          date: string
          mileage_at_transaction: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          category: 'fuel' | 'loan' | 'maintenance' | 'insurance' | 'other'
          date?: string
          mileage_at_transaction?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          category?: 'fuel' | 'loan' | 'maintenance' | 'insurance' | 'other'
          date?: string
          mileage_at_transaction?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      maintenance: {
        Row: {
          id: string
          user_id: string
          date: string
          mileage: number
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          mileage?: number
          description?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          mileage?: number
          description?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'maintenance_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      transaction_category: 'fuel' | 'loan' | 'maintenance' | 'insurance' | 'other'
    }
    CompositeTypes: Record<string, never>
  }
}
