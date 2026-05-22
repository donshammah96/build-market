import Image from "next/image";
import { Card, CardContent, CardFooter, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ProductsType } from "@build/types";
import { auth } from "@clerk/nextjs/server";

export type OrderType = {
  _id: string;
  email: string;
  status: string;
  totalAmount: number;
};

const CardList = async ({ title }: { title: string }) => {
  let products: ProductsType = [];
  let orders: OrderType[] = [];

  const { getToken } = await auth();
  const token = await getToken();

  if (title === "Popular Products") {
    products = await fetch(
      `${process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL}/products?limit=5&popular=true`,
    ).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to fetch popular products!");
      }
      return res.json();
    });
  } else {
    orders = await fetch(
      `${process.env.NEXT_PUBLIC_ORDER_SERVICE_URL}/orders?limit=5`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    ).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to fetch orders!");
      }
      return res.json();
    });
  }

  return (
    <div className="">
      <h1 className="text-lg font-medium mb-6 text-(--admin-color-text-primary)">
        {title}
      </h1>
      <div className="flex flex-col gap-2">
        {title === "Popular Products"
          ? products.map((item: ProductsType[number]) => (
              <Card
                key={item.id}
                className="flex-row items-center justify-between gap-4 p-4 bg-(--admin-surface-card) hover:bg-(--admin-surface-card-hover) transition-colors shadow-(--admin-shadow-sm) border-(--admin-data-border) rounded-(--admin-radius-md)"
              >
                <div className="w-12 h-12 rounded-(--admin-radius-sm) relative overflow-hidden border border-(--admin-data-border)">
                  <Image
                    src={
                      Object.values(item.images as Record<string, string>)[0] ||
                      ""
                    }
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <CardContent className="flex-1 p-0">
                  <CardTitle className="text-sm font-medium text-(--admin-color-text-primary)">
                    {item.name}
                  </CardTitle>
                </CardContent>
                <CardFooter className="p-0 text-(--admin-color-text-primary) font-semibold">
                  ${item.price}K
                </CardFooter>
              </Card>
            ))
          : orders.map((item) => (
              <Card
                key={item._id}
                className="flex-row items-center justify-between gap-4 p-4 bg-(--admin-surface-card) hover:bg-(--admin-surface-card-hover) transition-colors shadow-(--admin-shadow-sm) border-(--admin-data-border) rounded-(--admin-radius-md)"
              >
                <CardContent className="flex-1 p-0">
                  <CardTitle className="text-sm font-medium text-(--admin-color-text-primary)">
                    {item.email}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-(--admin-status-pending-bg) text-(--admin-status-pending-fg) border-(--admin-status-pending-border)"
                  >
                    {item.status}
                  </Badge>
                </CardContent>
                <CardFooter className="p-0 text-(--admin-color-text-primary) font-semibold">
                  ${item.totalAmount / 100}
                </CardFooter>
              </Card>
            ))}
      </div>
    </div>
  );
};

export default CardList;
