import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Manual stock control belongs to the platform owner. Super admins use the
    // dedicated /superadmin/inventory workflow, where the target tenant is
    // explicit and own-supplier receipts are auditable.
    return NextResponse.json(
      { error: 'Manual stock movements can only be recorded by the platform owner.' },
      { status: 403 },
    );
  } catch (error) {
    console.error('Error adjusting stock:', error);
    return NextResponse.json(
      { error: 'Failed to adjust stock' },
      { status: 500 }
    );
  }
}
