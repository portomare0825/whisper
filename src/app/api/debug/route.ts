import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Obtener columnas de la tabla avatars
    const { data: cols, error: colsError } = await supabase.rpc('execute_sql_temp', {
      sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'avatars';"
    }).catch(err => ({ data: null, error: err }));

    // 2. Consultar registros de avatars
    const { data: avatars, error: avatarsError } = await supabase
      .from('avatars')
      .select('*');

    return NextResponse.json({
      success: true,
      columns_via_rpc: cols,
      rpc_error: colsError ? (colsError.message || colsError) : null,
      avatars: avatars,
      avatars_error: avatarsError ? avatarsError.message : null
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
