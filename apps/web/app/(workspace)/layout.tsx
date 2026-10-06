import { workspaceContext } from '../../lib/supabase';
import { Shell } from '../../components/Shell';
export const dynamic = 'force-dynamic';
export default async function Workspace({ children }: { children: React.ReactNode }) {
  const ctx = await workspaceContext();
  const { data: permissions } = await ctx.client
    .from('permissions')
    .select('domain')
    .eq('role', ctx.role);
  const { data: org } = await ctx.client
    .from('organizations_internal')
    .select('demo')
    .eq('id', ctx.tenant)
    .single();
  if (!org) throw new Error('TENANT_CONFIGURATION_UNAVAILABLE');
  return (
    <Shell
      domains={permissions?.map((p) => p.domain) || []}
      role={ctx.role}
      demo={org?.demo === true}
    >
      {children}
    </Shell>
  );
}
