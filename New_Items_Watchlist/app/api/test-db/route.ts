import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Log environment variables (without exposing sensitive data)
    console.log('Environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
      nodeEnv: process.env.NODE_ENV
    });

    // Check if environment variables are set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        details: {
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      }, { status: 500 });
    }

    // Try to create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test database connection with a simple query
    const { data, error, count } = await supabase
      .from('vendor_offers')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: error.message
      }, { status: 500 });
    }

    // Also test vendor_offers_latest_new view
    const { error: viewError, count: viewCount } = await supabase
      .from('vendor_offers_latest_new')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      stats: {
        vendor_offers_count: count,
        vendor_offers_latest_new_count: viewCount,
        viewError: viewError?.message
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasEnvVars: true
      }
    });

  } catch (error) {
    console.error('Test DB error:', error);
    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}