import { ShippingWorkspacePage } from '@/components/shipping/workspace-page';
import { ShippingFilters } from '@/lib/shipping-workspace';
export default function Page({ searchParams }: { searchParams: Promise<ShippingFilters> }) {
    return <ShippingWorkspacePage section="delivery" searchParams={searchParams} />;
}
