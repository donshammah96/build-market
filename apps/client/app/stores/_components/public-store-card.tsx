import Link from "next/link";
import Image from "next/image";
import { MapPin, Star, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { fromEnumKey } from "@/lib/links";
import type { StoreListItem } from "@/app/lib/domains/stores/contracts";

interface PublicStoreCardProps {
  store: StoreListItem;
}

export function PublicStoreCard({ store }: PublicStoreCardProps) {
  // Use the first image that is marked main, or fallback to the first image
  const mainImage =
    store.images?.find((img) => img.isMain) || store.images?.[0];
  const imageUrl = mainImage?.asset?.cdnUrl || "/images/placeholders/store.jpg";

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all hover:shadow-md group">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <Image
          src={imageUrl}
          alt={store.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        {store.verified && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-emerald-500/90 text-white hover:bg-emerald-500 border-none backdrop-blur-sm shadow-sm">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Verified
            </Badge>
          </div>
        )}
      </div>

      <CardHeader className="p-4 pb-2">
        <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
          <Link href={`/stores/${store.slug}`}>
            <span className="absolute inset-0 z-10" />
            {store.name}
          </Link>
        </h3>

        <div className="flex items-center text-sm text-muted-foreground mt-1 gap-3">
          <div className="flex items-center">
            <Star className="mr-1 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-medium text-foreground">
              {store.rating ? Number(store.rating).toFixed(1) : "New"}
            </span>
            {store.reviewCount > 0 && (
              <span className="ml-1 text-xs">({store.reviewCount})</span>
            )}
          </div>
          <div className="flex items-center truncate">
            <MapPin className="mr-1 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {store.city}, {store.county}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2 flex-1">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {store.description || `Browse quality materials from ${store.name}.`}
        </p>

        <div className="flex flex-wrap gap-1.5 mt-auto">
          {store.categories.slice(0, 3).map((category) => (
            <Badge
              key={category}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 font-normal"
            >
              {fromEnumKey(category)}
            </Badge>
          ))}
          {store.categories.length > 3 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 font-normal"
            >
              +{store.categories.length - 3} more
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 border-t bg-muted/20 flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          {store.professional?.user?.avatar ? (
            <div className="relative h-6 w-6 rounded-full overflow-hidden">
              <Image
                src={store.professional.user.avatar}
                alt="Seller"
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
              {(store.professional?.companyName || store.name).charAt(0)}
            </div>
          )}
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            By {store.professional?.companyName || "Verified Seller"}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
