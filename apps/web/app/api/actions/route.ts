import { NextResponse } from 'next/server';
import { commands } from '../../../../../packages/domain/commands';
import { context } from '../../../lib/supabase';
import { protect, fail } from '../../../lib/http';
export async function POST(request: Request) {
  try {
    protect(request);
    const input = commands.parse(await request.json());
    const { client, user, tenant } = await context();
    const { action, ...values } = input;
    let result;
    if (action === 'create_capacity')
      result = await client
        .from('capacity_calendar')
        .insert({ ...values, tenant_id: tenant, user_id: user.id })
        .select('id')
        .single();
    else if (action === 'create_absence')
      result = await client
        .from('absences')
        .insert({ ...values, tenant_id: tenant, user_id: user.id })
        .select('id')
        .single();
    else if (action === 'create_task')
      result = await client
        .from('tasks')
        .insert({ ...values, tenant_id: tenant, owner_id: user.id })
        .select('id')
        .single();
    else if (action === 'create_milestone')
      result = await client
        .from('milestones')
        .insert({ ...values, tenant_id: tenant })
        .select('id')
        .single();
    else if (action === 'create_risk')
      result = await client
        .from('risks')
        .insert({ ...values, tenant_id: tenant, owner_id: user.id })
        .select('id')
        .single();
    else if (action === 'create_issue') {
      const v = input as Extract<typeof input, { action: 'create_issue' }>;
      result = await client
        .from('issues')
        .insert({
          tenant_id: tenant,
          project_id: v.project_id,
          name: v.name,
          impact: v.impact,
          action: v.action_text,
        })
        .select('id')
        .single();
    } else if (action === 'create_expense')
      result = await client
        .from('expenses')
        .insert({ ...values, tenant_id: tenant })
        .select('id')
        .single();
    else if (action === 'update_task') {
      const v = input as Extract<typeof input, { action: 'update_task' }>;
      result = await client
        .from('tasks')
        .update({ status: v.status })
        .eq('id', v.id)
        .eq('tenant_id', tenant)
        .select('id')
        .single();
    } else result = await client.rpc(action, { t: tenant, ...values });
    if (result.error)
      throw new Error(result.error.code === '42501' ? 'PERMISSION_DENIED' : result.error.message);
    return NextResponse.json({
      id: typeof result.data === 'string' ? result.data : result.data?.id,
    });
  } catch (error) {
    return fail(error);
  }
}
