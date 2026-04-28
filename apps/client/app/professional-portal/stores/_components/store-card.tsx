import Link from "next/link";
import {
  Store as StoreIcon,
  Package,
  ShoppingCart,
  TrendingUp,
  Settings,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MyStoreWithStats } from "@/app/lib/domains/stores/contracts";

interface StoreCardProps {
  store: MyStoreWithStats;
}

export function StoreCard({ store }: StoreCardProps) {
  const isVerified = store.verified;
  const isPendingVerification = store.verificationStatus === "PENDING";
  const revenue = store.totalRevenue || 0;

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2.5">
              <StoreIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg line-clamp-1">
                {store.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {isVerified ? (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                ) : isPendingVerification ? (
                  <Badge
                    variant="outline"
                    className="text-amber-600 border-amber-200"
                  >
                    <Clock className="mr-1 h-3 w-3" />
                    Pending Verification
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {store.description || "No description provided."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
          <div className="space-y-1">
            <div className="flex items-center text-xs text-muted-foreground">
              <Package className="mr-1.5 h-3.5 w-3.5" />
              Products
            </div>
            <p className="font-semibold">{store.totalProducts}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center text-xs text-muted-foreground">
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
              Orders
            </div>
            <p className="font-semibold">{store.totalOrders}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Pending
            </div>
            <p className="font-semibold">{store.pendingOrders}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
              Revenue
            </div>
            <p className="font-semibold">
              KSh {revenue.toLocaleString("en-KE")}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/professional-portal/stores/${store.slug}`}>
            <Settings className="mr-2 h-4 w-4" />
            Manage Store
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
